// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Interface that EVault expects
interface IIRM {
    error E_IRMUpdateUnauthorized();

    function computeInterestRate(address vault, uint256 cash, uint256 borrows) external returns (uint256);
    function computeInterestRateView(address vault, uint256 cash, uint256 borrows) external view returns (uint256);
}