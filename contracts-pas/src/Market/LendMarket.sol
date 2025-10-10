// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/* ========================= Imports ========================= */
import {IERC20} from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin-contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin-contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin-contracts/utils/ReentrancyGuard.sol";
import {IMarket} from "../Interfaces/IMarket.sol";
import {IIRM} from "../Interfaces/IIRM.sol";
import {ICreditLimitManager} from "../Interfaces/ICreditLimitManager.sol";

/**
 * @title Market (mínimo indispensable)
 * @notice Mercado de crédito sin colateral con IRM y credit lines. El Senior (sUSDC) es el único LP.
 * - Deuda escalada: principalScaled (base = WAD)
 * - _acc (WAD) es el interest accumulator (1e18 = 1.0)
 * - totalBorrows = totalPrincipalScaled * _acc / WAD
 * - _cash: liquidez en assets mantenida en este contrato
 */
contract Market is IMarket, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ===== Config ===== */
    IERC20 public immutable asset;          // p.ej., USDC
    address public seniorVault;             // sUSDC: único LP
    IIRM public irm;                        // IRM devuelve RAY en computeInterestRateView
    ICreditLimitManager public clm;         // gestor de líneas de crédito

    /* ===== Interés (WAD) ===== */
    uint256 private _acc;                   // interest accumulator en WAD
    uint64  public lastAccrual;             // timestamp último accrue

    /* ===== Liquidez / Deuda ===== */
    uint256 private _cash;                  // liquidez disponible en assets
    uint256 public totalPrincipalScaled;    // suma de principalScaled

    mapping(address => uint256) public principalScaledOf; // borrower => principalScaled

    /* ===== Constantes ===== */
    uint256 private constant WAD = 1e18;
    uint256 private constant RAY = 1e27;

    constructor(
        IERC20 _asset,
        address _seniorVault,
        address _irm,
        address _clm,
        address _owner
    ) Ownable(_owner) {
        require(address(_asset) != address(0) && _seniorVault != address(0) && _irm != address(0) && _clm != address(0), "zero");
        asset = _asset;
        seniorVault = _seniorVault;
        irm = IIRM(_irm);
        clm = ICreditLimitManager(_clm);
        _acc = WAD; // 1.0
        lastAccrual = uint64(block.timestamp);
    }

    /* ======================= Modifiers ======================= */

    modifier onlySenior() {
        require(msg.sender == seniorVault, "not senior");
        _;
    }

    /* ===================== LP (Senior) ===================== */

    function supplyFromSenior(uint256 assets) external override onlySenior nonReentrant {
        if (assets == 0) return;
        asset.safeTransferFrom(msg.sender, address(this), assets);
        _cash += assets;
        emit SuppliedFromSenior(assets);
    }

    function withdrawToSenior(uint256 assets) external override onlySenior nonReentrant {
        if (assets == 0) return;
        require(_cash >= assets, "insufficient cash");
        _cash -= assets;
        asset.safeTransfer(msg.sender, assets);
        emit WithdrawnToSenior(assets);
    }

    /* ===================== Borrowers ===================== */

    function borrow(uint256 assets, address receiver) external override nonReentrant returns (uint256) {
        require(assets > 0, "zero");
        _accrue();

        address borrower = msg.sender;

        // Autorización mínima: tener límite > 0 y no excederlo
        uint256 limit = clm.creditLimit(borrower);
        require(limit > 0, "not allowed");

        uint256 currentDebt = _debtAssetsOf(borrower);
        require(currentDebt + assets <= limit, "limit");

        require(_cash >= assets, "no liquidity");

        // principalScaled += assets / _acc
        uint256 deltaScaled = Math.mulDiv(assets, WAD, _acc, Math.Rounding.Ceil);
        principalScaledOf[borrower] += deltaScaled;
        totalPrincipalScaled        += deltaScaled;

        _cash -= assets;
        asset.safeTransfer(receiver, assets);

        emit Borrowed(borrower, receiver, assets);
        return assets;
    }

    function repay(uint256 assets, address onBehalfOf) external override nonReentrant returns (uint256) {
        if (assets == 0) return 0;
        _accrue();

        uint256 debt = _debtAssetsOf(onBehalfOf);
        if (debt == 0) return 0;

        uint256 pay = assets > debt ? debt : assets;

        asset.safeTransferFrom(msg.sender, address(this), pay);

        // reduce principalScaled: delta = pay / _acc
        uint256 deltaScaled = Math.mulDiv(pay, WAD, _acc, Math.Rounding.Ceil);
        uint256 ps = principalScaledOf[onBehalfOf];
        if (deltaScaled > ps) deltaScaled = ps;

        principalScaledOf[onBehalfOf] = ps - deltaScaled;
        totalPrincipalScaled          -= deltaScaled;

        _cash += pay;
        emit Repaid(msg.sender, onBehalfOf, pay);
        return pay;
    }

    /* ===================== Accounting ===================== */

    function accrue() external override { _accrue(); }

    function _accrue() internal {
        uint64 nowTs = uint64(block.timestamp);
        uint64 dt = nowTs - lastAccrual;
        if (dt == 0) return;

        uint256 borrows = totalBorrows();
        uint256 supply  = _cash + borrows;
        uint256 util = supply == 0 ? 0 : Math.mulDiv(borrows, WAD, supply);

        // IRM en RAY → convertir a WAD
        uint256 rRay = irm.computeInterestRateView(address(this), util, 0);
        uint256 rWad = rRay / 1e9; // RAY->WAD

        // _acc *= (1 + r*dt)
        uint256 growth = WAD + rWad * dt;
        _acc = Math.mulDiv(_acc, growth, WAD);

        lastAccrual = nowTs;
        emit Accrued(_acc, lastAccrual, rWad);
    }

    function expectedBalances() external view override returns (
        uint256 totalSupplyAssets,
        uint256 totalBorrowAssets,
        uint256 liquidity
    ) {
        uint256 borrows = Math.mulDiv(totalPrincipalScaled, _acc, WAD);
        uint256 liq = _cash;
        return (liq + borrows, borrows, liq);
    }

    function positionOf(address borrower) external view override returns (uint256 debtAssets) {
        return _debtAssetsOf(borrower);
    }

    function _debtAssetsOf(address borrower) internal view returns (uint256) {
        uint256 ps = principalScaledOf[borrower];
        if (ps == 0) return 0;
        return Math.mulDiv(ps, _acc, WAD);
    }

    function totalBorrows() public view override returns (uint256) {
        return Math.mulDiv(totalPrincipalScaled, _acc, WAD);
    }

    /* ===== Getters que pide la interfaz sin colisiones de nombres ===== */
    function cash() external view override returns (uint256) { return _cash; }
    function interestAccumulator() external view override returns (uint256) { return _acc; }

    function interestRate() external view override returns (uint256 ratePerSecondWad) {
        uint256 borrows = totalBorrows();
        uint256 supply  = _cash + borrows;
        uint256 util = supply == 0 ? 0 : Math.mulDiv(borrows, WAD, supply);
        uint256 rRay = irm.computeInterestRateView(address(this), util, 0);
        return rRay / 1e9; // RAY->WAD
    }

    /* ===================== Risk / Loss ===================== */

    function writeDown(address borrower, uint256 lossAssets) external override onlyOwner {
        if (lossAssets == 0) return;
        _accrue();

        uint256 debt = _debtAssetsOf(borrower);
        if (debt == 0) return;

        uint256 loss = lossAssets > debt ? debt : lossAssets;

        uint256 deltaScaled = Math.mulDiv(loss, WAD, _acc, Math.Rounding.Ceil);
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
        clm = ICreditLimitManager(newCLM);
    }

    function setSeniorVault(address newSenior) external override onlyOwner {
        require(newSenior != address(0), "zero");
        seniorVault = newSenior;
    }
}