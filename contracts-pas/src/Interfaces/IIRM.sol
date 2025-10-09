// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IIRM
/// @notice Interface for Interest Rate Models compatible with Euler-style vault calls.
/// @dev    The model returns a per-second interest rate in RAY (1e27).
interface IIRM {
    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    /// @notice Thrown when a non-vault caller tries to use the authorized path.
    error E_IRMUpdateUnauthorized();

    /*//////////////////////////////////////////////////////////////
                               VIEWS
    //////////////////////////////////////////////////////////////*/
    /// @notice Authorized (vault-only) path to read the current per-second rate in RAY.
    /// @dev    Implementations may enforce msg.sender == vault for safety.
    /// @param vault The vault address that is authorized to query this path.
    /// @param u     (Optional) Utilization or any model-specific input (kept for compatibility).
    /// @param r     (Optional) Reserves/cash or any model-specific input (kept for compatibility).
    /// @return ratePerSecondRay Interest rate per second, scaled to RAY (1e27).
    function computeInterestRate(address vault, uint256 u, uint256 r)
        external
        view
        returns (uint256 ratePerSecondRay);

    /// @notice View-only (public) path to read the current per-second rate in RAY.
    /// @dev    Should return the same value as the authorized path but without caller checks.
    /// @param vault The vault address (may be ignored by fixed-rate models).
    /// @param u     (Optional) Utilization or any model-specific input.
    /// @param r     (Optional) Reserves/cash or any model-specific input.
    /// @return ratePerSecondRay Interest rate per second, scaled to RAY (1e27).
    function computeInterestRateView(address vault, uint256 u, uint256 r)
        external
        view
        returns (uint256 ratePerSecondRay);
}