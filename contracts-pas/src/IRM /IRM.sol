// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIRM} from "../Interfaces/IIRM.sol";

/// @title IRM (Fixed APR)
/// @notice Simple constant Interest Rate Model:
///         takes an APR (in bps) at construction and exposes a per-second rate in RAY (1e27).
/// @dev    Compatible with Euler-style IRM interfaces: the state-changing (mutant) rate
///         function may only be called by the vault itself for safety.
contract IRM is IIRM {
    /// @notice Per-second interest rate in RAY (1e27).
    /// @dev    Example: for 1% APR, ratePerSecondRay ≈ 0.01 / 31,536,000 * 1e27 ≈ 3.170979198e17.
    uint256 public immutable ratePerSecondRay;

    /// @dev Number of seconds in a 365-day year (Euler convention).
    uint256 private constant SECONDS_PER_YEAR = 365 days; // 31,536,000

    /// @param aprBps APR expressed in basis points. Example:
    ///               - 100  = 1.00% APR
    ///               - 500  = 5.00% APR
    ///               - 1000 = 10.00% APR
    constructor(uint256 aprBps) {
        // APR (fraction) = aprBps / 10_000
        // per-second rate in RAY: (APR_fraction * 1e27) / SECONDS_PER_YEAR
        ratePerSecondRay = (aprBps * 1e27) / 10_000 / SECONDS_PER_YEAR;
    }

    /// @notice Mutable/authorized path to fetch the current per-second rate (RAY).
    /// @dev    For security (Euler convention), only the vault itself can call this function.
    /// @param vault   The authorized vault address (must equal msg.sender).
    /// @param /* u */ Unused utilization param (kept for interface compatibility).
    /// @param /* r */ Unused reserve/cash param (kept for interface compatibility).
    /// @return rate   The per-second interest rate in RAY (1e27).
    function computeInterestRate(address vault, uint256 /* u */, uint256 /* r */)
        external
        view
        override
        returns (uint256 rate)
    {
        if (msg.sender != vault) revert E_IRMUpdateUnauthorized();
        return ratePerSecondRay;
    }

    /// @notice View-only path to fetch the per-second rate (RAY), callable by anyone.
    /// @dev    Mirrors the authorized version but without the caller check.
    /// @param /* vault */ Ignored (kept for interface compatibility).
    /// @param /* u */     Ignored (kept for interface compatibility).
    /// @param /* r */     Ignored (kept for interface compatibility).
    /// @return rate       The per-second interest rate in RAY (1e27).
    function computeInterestRateView(address /* vault */, uint256 /* u */, uint256 /* r */)
        external
        view
        override
        returns (uint256 rate)
    {
        return ratePerSecondRay;
    }
}