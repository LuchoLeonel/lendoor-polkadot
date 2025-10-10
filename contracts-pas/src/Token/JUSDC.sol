// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC4626} from "@openzeppelin-contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20}  from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import {ERC20}   from "@openzeppelin-contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin-contracts/access/Ownable.sol";
/**
 * @title JUSDC (Junior sUSDC Vault)
 * @notice ERC-4626 (OZ v5.4) whose asset is the Senior token (sUSDC). Minimal holder of sUSDC.
 * @dev    No waterfall/locks here; can be extended later.
 */
contract JUSDC is ERC4626, Ownable {
    constructor(IERC20 sUSDC_, address owner_)
        ERC20("Junior sUSDC Vault", "jUSDC") // initialize ERC20 (base of ERC4626)
        ERC4626(sUSDC_)                       // ERC4626 v5.4: only asset in constructor
        Ownable(owner_)                       // set initial owner
    {}
}