// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin-contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin-contracts//token/ERC20/extensions/ERC4626.sol";
import {Ownable} from "@openzeppelin-contracts//access/Ownable.sol";
import {IMarket} from "../Interfaces/IMarket.sol";

/**
 * @title SUSDC (Senior USDC Vault)
 * @notice Minimal ERC-4626 vault whose asset is USDC. On deposit/withdraw,
 *         it forwards/pulls liquidity to/from the credit Market.
 * @dev    No waterfall logic here. totalAssets() = liquidity + borrows reported by Market,
 *         plus any idle USDC left in the vault (normally ~0).
 */
contract SUSDC is ERC20, ERC4626, Ownable {
    /// @notice Credit market where senior liquidity is parked/withdrawn.
    IMarket public market;

    constructor(IERC20 usdc_, address owner_)
        ERC20("Senior USDC Vault", "sUSDC")
        ERC4626(usdc_)      // underlying asset = USDC
        Ownable(owner_)     // OZ v5 requires initial owner in constructor
    {}

    /* ------------------------------ Admin ------------------------------ */

    /// @notice Set/replace the credit market contract.
    function setMarket(address market_) external onlyOwner {
        require(market_ != address(0), "market=0");
        market = IMarket(market_);
    }

    /* ------------------------ ERC-4626 overrides ----------------------- */

    /**
     * @dev After ERC-4626 has pulled USDC from the depositor and minted shares,
     *      forward those USDC to the Market (push pattern).
     *      Our Market.supplyFromSenior() expects the vault to approve + transferFrom.
     */
    function _afterDeposit(uint256 assets, uint256 /*shares*/) internal override {
        if (assets > 0) {
            asset().approve(address(market), assets);
            market.supplyFromSenior(assets);
        }
    }

    /**
     * @dev Before ERC-4626 sends USDC back to the receiver, pull the required
     *      liquidity from the Market.
     */
    function _beforeWithdraw(uint256 assets, uint256 /*shares*/) internal override {
        if (assets > 0) {
            market.withdrawToSenior(assets);
            // ERC-4626 will transfer USDC to the receiver afterwards.
        }
    }

    /**
     * @dev Senior AUM = Market (liquidity + borrows) + any idle USDC held by this vault.
     *      If market is not set yet, count only idle.
     */
    function totalAssets() public view override returns (uint256) {
        if (address(market) == address(0)) {
            return asset().balanceOf(address(this));
        }
        (uint256 totalSupplyAssets,,) = market.expectedBalances();
        // Include local idle balance (should be ~0 most of the time).
        return totalSupplyAssets + asset().balanceOf(address(this));
    }

    /* ------------------------------ Helpers ---------------------------- */

    /// @notice Minimal "harvest": just accrues interest at Market level (no waterfall here).
    function harvest() external {
        market.accrue();
        // In a waterfall-enabled version you'd compute PnL vs a snapshot
        // and mint/burn junior accordingly from here.
    }
}