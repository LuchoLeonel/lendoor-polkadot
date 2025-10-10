// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IEVaultAdapter {
    // --- ERC20 / ERC4626 surface que espera el front viejo ---
    function decimals() external view returns (uint8);
    function asset() external view returns (address);
    function balanceOf(address) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);

    function convertToAssets(uint256 shares) external view returns (uint256);
    function maxWithdraw(address owner) external view returns (uint256);

    // --- Extensiones específicas del ABI anterior ---
    function convertToJuniorAssets(uint256 jShares) external view returns (uint256);
    function availableCashAssets() external view returns (uint256);
    function psSeniorRay() external view returns (uint256);
    function psJuniorRay() external view returns (uint256);
    function interestRateModel() external view returns (address);
    function MODULE_RISKMANAGER() external view returns (address);
    function debtOf(address account) external view returns (uint256);

    // --- Flujos ---
    function deposit(uint256 assets, address receiver) external returns (uint256);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256);
    function borrow(uint256 assets, address receiver) external returns (uint256);
    function repay(uint256 assets, address onBehalfOf) external returns (uint256);

    // --- Junior “demote” helpers del ABI viejo ---
    function demoteToSenior(uint256 jShares, address to) external returns (uint256 sUsdcOut);
    function previewWithdrawJunior(uint256 jShares) external view returns (uint256 sUsdcOut);
}