// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IMarket
/// @notice Credit market (not a vault). Manages debt, interest and liquidity.
interface ILendMarket {
    /* ===== LP (Senior) ===== */
    function supplyFromSenior(uint256 assets) external;
    function withdrawToSenior(uint256 assets) external;

    /* ===== Borrowers ===== */
    function borrow(uint256 assets, address receiver) external returns (uint256);
    function repay(uint256 assets, address onBehalfOf) external returns (uint256);

    /* ===== Accounting ===== */
    function accrue() external;
    function expectedBalances() external view returns (
        uint256 totalSupplyAssets,
        uint256 totalBorrowAssets,
        uint256 liquidity
    );
    function positionOf(address borrower) external view returns (uint256 debtAssets);
    function totalBorrows() external view returns (uint256);
    function cash() external view returns (uint256);
    function interestAccumulator() external view returns (uint256);
    function interestRate() external view returns (uint256 ratePerSecondWad);

    /* ===== Risk / Loss ===== */
    function writeDown(address borrower, uint256 lossAssets) external;

    /* ===== Admin ===== */
    function setIRM(address newIRM) external;
    function setCreditLineManager(address newCLM) external;
    function setSeniorVault(address newSenior) external;

    /* ===== Events ===== */
    event Accrued(uint256 acc, uint64 lastAccrual, uint256 rateWad);
    event SuppliedFromSenior(uint256 assets);
    event WithdrawnToSenior(uint256 assets);
    event Borrowed(address indexed borrower, address indexed receiver, uint256 assets);
    event Repaid(address indexed payer, address indexed onBehalfOf, uint256 assets);
    event WrittenDown(address indexed borrower, uint256 lossAssets);
}