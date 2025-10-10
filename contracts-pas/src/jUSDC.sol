// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC4626} from "@openzeppelin-contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20}  from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin-contracts/access/Ownable.sol";

/**
 * @title jUSDC (Junior)
 * @notice ERC-4626 cuyo asset = sUSDC. No deploya fondos; es holder directo del senior.
 *         La primera pérdida la sufre porque sUSDC quema sus shares en report(loss).
 */
contract JUSDC is ERC4626, Ownable {
    constructor(IERC20 sUSDC)
        ERC20("jUSDC", "jUSDC")
        ERC4626(sUSDC) // asset = sUSDC token
    {}
    // Aquí podrías agregar: cap de subordinación, lock/cooldown, ventanas, whitelist, etc.
}