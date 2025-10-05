// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC4626} from "../../lib/openzeppelin-contracts/contracts/interfaces/IERC4626.sol";

interface IJuniorERC4626 is IERC4626 {
    /// @notice Underlying EVault used by the wrapper
    function evault() external view returns (address);
    // Optional: specific helpers, if you want to expose them as a public API
    function previewPromote(uint256 assets) external view returns (uint256 jShares);
    function previewDemote(uint256 shares) external view returns (uint256 assets);
}