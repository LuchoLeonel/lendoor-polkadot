// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20}   from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin-contracts/interfaces/IERC4626.sol";
import {IMarket}  from "../Interfaces/IMarket.sol";
import {IIRM}     from "../Interfaces/IIRM.sol";
import {ICreditLimitManager} from "../Interfaces/ICreditLimitManager.sol";

/// @title EVaultCompat
/// @notice Fachada compatible con el ABI viejo de Lendoor, enroutando a Market + sUSDC + jUSDC.
contract EVaultAdapter {
    IERC4626 public immutable sUSDC;   // Senior vault (asset = USDC)
    IERC4626 public immutable jUSDC;   // Junior vault (asset = sUSDC)
    IERC20   public immutable USDC;    // Underlying
    IMarket  public immutable market;  // Motor de crédito
    IIRM     public immutable irm;     // Interest model
    ICreditLimitManager public immutable clm; // “RiskManager” compat

    uint256 private constant WAD = 1e18;
    uint256 private constant RAY = 1e27;

    constructor(
        address _sUSDC,
        address _jUSDC,
        address _usdc,
        address _market,
        address _irm,
        address _clm
    ) {
        require(_sUSDC!=address(0)&&_jUSDC!=address(0)&&_usdc!=address(0)&&_market!=address(0)&&_irm!=address(0)&&_clm!=address(0), "zero");
        sUSDC  = IERC4626(_sUSDC);
        jUSDC  = IERC4626(_jUSDC);
        USDC   = IERC20(_usdc);
        market = IMarket(_market);
        irm    = IIRM(_irm);
        clm    = ICreditLimitManager(_clm);
    }

    /* ------------------ ERC20-like (desde el “EVault”) ------------------ */
    // El frontend antiguo esperaba leer del EVault:
    function decimals() external view returns (uint8) {
        // Exponemos los decimals del token de shares senior (como hacía su EVault)
        // Si antes se esperaba otra cosa, ajusta aquí.
        return IERC20(address(sUSDC)).decimals();
    }

    function asset() external view returns (address) {
        return sUSDC.asset(); // = USDC
    }

    // balanceOf/allowance/approve: el UI antiguo las llamaba en EVault,
    // pero realmente necesita hacerlo sobre USDC y/o sobre sUSDC.
    // Mínimo: NO las expongas aquí para no confundir approvals.
    // Si el UI te obliga, puedes proxyear a USDC o a sUSDC pero es riesgoso.

    /* -------------------- Tasas / precios (compat) -------------------- */

    function convertToAssets(uint256 shares) external view returns (uint256) {
        return sUSDC.convertToAssets(shares); // sUSDC shares -> USDC
    }

    function convertToJuniorAssets(uint256 jShares) external view returns (uint256) {
        // jUSDC.asset() = sUSDC; devuelve sUSDC-shares (no USDC)
        return jUSDC.convertToAssets(jShares);
    }

    function availableCashAssets() external view returns (uint256) {
        // efectivo disponible en el market
        return market.cash();
    }

    function maxWithdraw(address owner) external view returns (uint256) {
        return sUSDC.maxWithdraw(owner);
    }

    function psSeniorRay() external view returns (uint256) {
        // pps en WAD -> a RAY
        uint256 ppsWad = sUSDC.convertToAssets(WAD);
        return ppsWad * (RAY / WAD);
    }

    function psJuniorRay() external view returns (uint256) {
        // pps del junior en unidades de sUSDC-share (no USDC)
        uint256 ppsWad = jUSDC.convertToAssets(WAD);
        return ppsWad * (RAY / WAD);
    }

    function interestRateModel() external view returns (address) {
        return address(irm);
    }

    function MODULE_RISKMANAGER() external view returns (address) {
        // Compat: devolvemos el CLM como “RiskManager”
        return address(clm);
    }

    function debtOf(address account) external view returns (uint256) {
        return market.positionOf(account); // deuda en assets (USDC)
    }

    /* ---------------------- Flux de usuario (compat) ---------------------- */

    // DEPÓSITO: el UI viejo llamaba EVault.deposit(assets, receiver)
    // reenviamos al sUSDC (que realmente custodia shares)
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        // requiere pre-aprobación de USDC -> EVaultCompat (o directamente a sUSDC si prefieres routerless)
        USDC.transferFrom(msg.sender, address(this), assets);
        USDC.approve(address(sUSDC), assets);
        shares = sUSDC.deposit(assets, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        shares = sUSDC.withdraw(assets, receiver, owner);
    }

    function borrow(uint256 assets, address receiver) external returns (uint256) {
        return market.borrow(assets, receiver);
    }

    function repay(uint256 assets, address onBehalfOf) external returns (uint256) {
        // requiere approve USDC -> EVaultCompat
        USDC.transferFrom(msg.sender, address(this), assets);
        USDC.approve(address(market), assets);
        return market.repay(assets, onBehalfOf);
    }

    /* ---------------------- Demote junior (compat) ---------------------- */

    function previewWithdrawJunior(uint256 jShares) external view returns (uint256 sShares) {
        // cuántas sUSDC-shares obtengo si canjeo jShares
        sShares = jUSDC.previewRedeem(jShares);
    }

    function demoteToSenior(uint256 jShares, address receiver) external returns (uint256 sSharesOut) {
        // 1) Usuario debe aprobar jUSDC -> EVaultCompat por jShares
        // 2) Canjeamos jUSDC por sUSDC-shares
        sSharesOut = jUSDC.redeem(jShares, receiver, msg.sender);
        // Resultado: el receiver recibe sUSDC shares (no USDC).
    }
}