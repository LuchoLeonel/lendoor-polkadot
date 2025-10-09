// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/* ========================= Implementación mínima ========================= */

import {IERC20} from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin-contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin-contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin-contracts/utils/ReentrancyGuard.sol";
import {IMarket} from "../Interfaces/IMarket.sol";

/**
 * @title Market (mínimo indispensable)
 * @notice Mercado de crédito sin colateral con IRM y credit lines. El Senior (sUSDC) es el único LP.
 * - Deuda en formato escalado: principalScaled (base de acumulador = 1e18)
 * - interestAccumulator (WAD, 1e18 = sin interés). debt = principalScaled * acc / 1e18
 * - totalBorrows = totalPrincipalScaled * acc / 1e18
 * - cash: liquidez disponible (assets) en el mercado
 */
contract Market is IMarket, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ===== Config ===== */
    IERC20 public immutable asset;        // p.ej., USDC
    address public seniorVault;           // sUSDC: único proveedor de liquidez
    IIRM    public irm;
    ICreditLineManager public clm;

    /* ===== Interés (WAD) ===== */
    uint256 public override interestAccumulator; // WAD, inicia en 1e18
    uint64  public lastAccrual;                 // timestamp último accrue

    /* ===== Liquidez / Deuda ===== */
    uint256 public override cash;               // assets libres en el contrato
    uint256 public totalPrincipalScaled;        // suma de principalScaled de todos

    mapping(address => uint256) public principalScaledOf; // borrower => principalScaled

    /* ===== Constantes ===== */
    uint256 private constant WAD = 1e18;

    constructor(IERC20 _asset, address _seniorVault, address _irm, address _clm) {
        require(address(_asset) != address(0) && _seniorVault != address(0) && _irm != address(0) && _clm != address(0), "zero");
        asset = _asset;
        seniorVault = _seniorVault;
        irm = IIRM(_irm);
        clm = ICreditLineManager(_clm);
        interestAccumulator = WAD; // 1.0
        lastAccrual = uint64(block.timestamp);
    }

    /* ======================= Modifiers ======================= */

    modifier onlySenior() {
        require(msg.sender == seniorVault, "not senior");
        _;
    }

    /* ===================== LP (Senior) ===================== */

    /// @notice El Senior deposita liquidez en el mercado.
    function supplyFromSenior(uint256 assets) external override onlySenior nonReentrant {
        if (assets == 0) return;
        asset.safeTransferFrom(msg.sender, address(this), assets);
        cash += assets;
        emit SuppliedFromSenior(assets);
    }

    /// @notice El Senior retira liquidez del mercado.
    function withdrawToSenior(uint256 assets) external override onlySenior nonReentrant {
        if (assets == 0) return;
        require(cash >= assets, "insufficient cash");
        cash -= assets;
        asset.safeTransfer(msg.sender, assets);
        emit WithdrawnToSenior(assets);
    }

    /* ===================== Borrowers ===================== */

    /// @notice Prestamo a borrower (solo credit-lines aprobado por CLM).
    function borrow(uint256 assets, address receiver) external override nonReentrant returns (uint256) {
        require(assets > 0, "zero");
        _accrue(); // asegura tasas frescas

        address borrower = msg.sender;
        require(clm.isAllowed(borrower), "not allowed");

        // Headroom: deuda actual + nuevo monto <= crédito
        uint256 currentDebt = _debtAssetsOf(borrower);
        uint256 limit = clm.getCreditLimit(borrower);
        require(currentDebt + assets <= limit, "limit");

        require(cash >= assets, "no liquidity");

        // principalScaled += assets / acc
        uint256 deltaScaled = Math.mulDiv(assets, WAD, interestAccumulator, Math.Rounding.Ceil);
        principalScaledOf[borrower] += deltaScaled;
        totalPrincipalScaled      += deltaScaled;

        cash -= assets;
        asset.safeTransfer(receiver, assets);

        emit Borrowed(borrower, receiver, assets);
        return assets;
    }

    /// @notice Repago de deuda (puede pagar un tercero con onBehalfOf).
    function repay(uint256 assets, address onBehalfOf) external override nonReentrant returns (uint256) {
        if (assets == 0) return 0;
        _accrue();

        uint256 debt = _debtAssetsOf(onBehalfOf);
        if (debt == 0) return 0;

        uint256 pay = assets > debt ? debt : assets;

        // pull tokens
        asset.safeTransferFrom(msg.sender, address(this), pay);

        // reduce principalScaled: delta = pay / acc
        uint256 deltaScaled = Math.mulDiv(pay, WAD, interestAccumulator, Math.Rounding.Ceil);
        uint256 ps = principalScaledOf[onBehalfOf];
        if (deltaScaled > ps) deltaScaled = ps;

        principalScaledOf[onBehalfOf] = ps - deltaScaled;
        totalPrincipalScaled          -= deltaScaled;

        cash += pay;
        emit Repaid(msg.sender, onBehalfOf, pay);
        return pay;
    }

    /* ===================== Accounting ===================== */

    /// @notice Acumula interés global (idempotente y barato).
    function accrue() external override {
        _accrue();
    }

    function _accrue() internal {
        uint64 nowTs = uint64(block.timestamp);
        uint64 dt = nowTs - lastAccrual;
        if (dt == 0) return;

        uint256 borrows = totalBorrows(); // usa acc actual (ok, porque multiplicamos con el acc previo)
        uint256 supply  = cash + borrows;

        // Utilización en WAD: borrows / supply (manejar supply=0)
        uint256 util = supply == 0 ? 0 : Math.mulDiv(borrows, WAD, supply);

        // r en WAD por segundo
        uint256 r = irm.ratePerSecond(util);

        // acc *= (1 + r*dt)
        // => acc = acc * (WAD + r*dt) / WAD
        uint256 growth = WAD + r * dt;
        interestAccumulator = Math.mulDiv(interestAccumulator, growth, WAD);

        lastAccrual = nowTs;
        emit Accrued(interestAccumulator, lastAccrual, r);
    }

    /// @notice Balances esperados para que el Senior calcule PnL en su harvest.
    function expectedBalances() external view override returns (
        uint256 totalSupplyAssets,
        uint256 totalBorrowAssets,
        uint256 liquidity
    ) {
        uint256 acc = interestAccumulator;
        uint256 borrows = Math.mulDiv(totalPrincipalScaled, acc, WAD);
        uint256 liq = cash;
        return (liq + borrows, borrows, liq);
    }

    /// @notice Deuda actual de un borrower en assets.
    function positionOf(address borrower) external view override returns (uint256 debtAssets) {
        return _debtAssetsOf(borrower);
    }

    function _debtAssetsOf(address borrower) internal view returns (uint256) {
        uint256 acc = interestAccumulator;
        uint256 ps = principalScaledOf[borrower];
        if (ps == 0) return 0;
        return Math.mulDiv(ps, acc, WAD);
    }

    function totalBorrows() public view override returns (uint256) {
        return Math.mulDiv(totalPrincipalScaled, interestAccumulator, WAD);
    }

    function cash() external view override returns (uint256) {
        return cash;
    }

    function interestAccumulator() external view override returns (uint256) {
        return interestAccumulator;
    }

    function interestRate() external view override returns (uint256 ratePerSecondWad) {
        uint256 borrows = totalBorrows();
        uint256 supply  = cash + borrows;
        uint256 util = supply == 0 ? 0 : Math.mulDiv(borrows, WAD, supply);
        return irm.ratePerSecond(util);
    }

    /* ===================== Risk / Loss ===================== */

    /// @notice Marca pérdida irrecuperable en un borrower (no mueve cash; reduce deuda).
    /// @dev El Senior verá este write-down como pérdida en su próximo harvest (via expectedBalances()).
    function writeDown(address borrower, uint256 lossAssets) external override onlyOwner {
        if (lossAssets == 0) return;
        _accrue();

        uint256 debt = _debtAssetsOf(borrower);
        if (debt == 0) return;

        uint256 loss = lossAssets > debt ? debt : lossAssets;

        // reducir principalScaled en proporción a la pérdida
        uint256 deltaScaled = Math.mulDiv(loss, WAD, interestAccumulator, Math.Rounding.Ceil);
        uint256 ps = principalScaledOf[borrower];
        if (deltaScaled > ps) deltaScaled = ps;

        principalScaledOf[borrower] = ps - deltaScaled;
        totalPrincipalScaled       -= deltaScaled;

        emit WrittenDown(borrower, loss);
    }

    /* ===================== Admin ===================== */

    function setIRM(address newIRM) external override onlyOwner {
        require(newIRM != address(0), "zero");
        irm = IIRM(newIRM);
    }

    function setCreditLineManager(address newCLM) external override onlyOwner {
        require(newCLM != address(0), "zero");
        clm = ICreditLineManager(newCLM);
    }

    function setSeniorVault(address newSenior) external override onlyOwner {
        require(newSenior != address(0), "zero");
        seniorVault = newSenior;
    }
}