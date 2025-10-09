// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ICreditLimitManager
/// @notice Full interface (includes admin functions) for CreditLimitManager
interface ICreditLimitManager {
    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    /// @notice Emitted when the owner changes
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    /// @notice Emitted when a user's credit line (score/limit) is set
    event LineSet(address indexed account, uint8 score, uint256 limit);

    /// @notice Emitted when a user's credit line is cleared
    event LineCleared(address indexed account);

    /*//////////////////////////////////////////////////////////////
                                VIEWS
    //////////////////////////////////////////////////////////////*/
    /// @notice Current owner of the contract
    function owner() external view returns (address);

    /// @notice User's credit limit in asset units (e.g., USDC uses 6 decimals)
    /// @param account The address of the user
    /// @return The maximum borrowable amount for the user, in asset units
    function creditLimit(address account) external view returns (uint256);

    /// @notice User's credit score (0..255)
    /// @param account The address of the user
    /// @return The score assigned to the user
    function scoreOf(address account) external view returns (uint8);

    /*//////////////////////////////////////////////////////////////
                                ADMIN
    //////////////////////////////////////////////////////////////*/
    /// @notice Transfers ownership to a new address
    /// @param newOwner The new owner address
    function setOwner(address newOwner) external;

    /// @notice Sets the score and credit limit for a user
    /// @param account The user address
    /// @param score   The score to assign (0..255)
    /// @param limit   The credit limit in asset units (e.g., USDC 6 decimals)
    function setLine(address account, uint8 score, uint256 limit) external;

    /// @notice Batch version of setLine for multiple users
    struct LineUpdate { address account; uint8 score; uint256 limit; }
    /// @param ups Array of updates to apply
    function batchSetLines(LineUpdate[] calldata ups) external;

    /// @notice Clears a user's credit line (equivalent to setting limit to 0)
    /// @param account The user address to clear
    function clearLine(address account) external;
}