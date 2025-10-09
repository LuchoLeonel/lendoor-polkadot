// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Interface that EVault expects
interface IIRM {
    error E_IRMUpdateUnauthorized();

    function computeInterestRate(address vault, uint256 cash, uint256 borrows) external returns (uint256);
    function computeInterestRateView(address vault, uint256 cash, uint256 borrows) external view returns (uint256);
}

/// @title TestIRMFixedAPR.sol
/// @notice Constant IRM: sets an APR and returns the rate per second in RAY (1e27)
contract TestIRMFixedAPR is IIRM {
    // SPY in RAY (1e27), e.g. ~3.170979198e17 for 1% APR
    uint256 public immutable ratePerSecondRay;

    uint256 private constant SECONDS_PER_YEAR = 365 days; // 31,536,000

    /// @param aprBps APR in basis points (bps). E.g: 100 = 1% APR, 500 = 5% APR.
    constructor(uint256 aprBps) {
        // ratePerSecondRay = (APR * 1e27) / secondsPerYear
        // APR (fraction) = aprBps / 10_000
        ratePerSecondRay = (aprBps * 1e27) / 10_000 / SECONDS_PER_YEAR;
        ratePerSecondRay = (aprBps * 1e27) / 10_000 / SECONDS_PER_YEAR;

    }

    /// @dev For security, same as Euler's IRMs:
    ///      only the vault itself can call the "mutant" version
    function computeInterestRate(address vault, uint256, uint256)
        external
        view
        override
        returns (uint256)
    {
        if (msg.sender != vault) revert E_IRMUpdateUnauthorized();
        return ratePerSecondRay;
    }

    function computeInterestRateView(address, uint256, uint256)
        external
        view
        override
        returns (uint256)
    {
        return ratePerSecondRay;
    }
}