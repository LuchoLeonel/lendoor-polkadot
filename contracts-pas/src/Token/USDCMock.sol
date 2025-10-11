// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin-contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC (Public Mint, 6 decimals)
 * @notice USDC-like test token with a mint function open to anyone.
 * @dev    Use ONLY on testnet/dev! In production, protect the mint with roles.
 */
contract USDCMock is ERC20 {
    constructor() ERC20("USD Coin (Mock)", "USDC") {}

    /// @dev USDC uses 6 decimals.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Public mint (anyone can mint).
    /// @param to     Address that will receive the tokens
    /// @param amount Amount with 6 decimals (e.g. 100 USDC = 100_000000)
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Convenience for a faucet: mints to msg.sender.
    function mintToSelf(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}