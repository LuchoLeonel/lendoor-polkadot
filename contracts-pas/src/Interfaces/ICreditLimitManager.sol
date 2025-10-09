// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICreditLineManager {
    function isAllowed(address borrower) external view returns (bool);
    /// @notice Límite máximo de deuda en assets (no en shares).
    function getCreditLimit(address borrower) external view returns (uint256);
}
