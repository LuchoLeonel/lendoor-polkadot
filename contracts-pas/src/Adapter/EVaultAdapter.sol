// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin-contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC4626} from "@openzeppelin-contracts/interfaces/IERC4626.sol";

import {ILendMarket} from "../Interfaces/ILendMarket.sol";
import {ICreditLimitManager} from "../Interfaces/ICreditLimitManager.sol";

contract EVaultAdapter {
    IERC4626 public immutable s;   // sUSDC (vault senior, ERC4626)
    IERC4626 public immutable j;   // jUSDC (vault junior, ERC4626)
    ILendMarket  public immutable mkt; // Market
    IERC20   public immutable usdc;
    address  public immutable irm;
    address  public immutable riskManagerShim;

    constructor(
        address _s,
        address _j,
        address _mkt,
        address _usdc,
        address _irm,
        address _riskManagerShim
    ) {
        s = IERC4626(_s);
        j = IERC4626(_j);
        mkt = ILendMarket(_mkt);
        usdc = IERC20(_usdc);
        irm = _irm;
        riskManagerShim = _riskManagerShim;
    }

    /* ---------- EVault surface ---------- */

    // Use IERC20Metadata to read decimals from the shares token (sUSDC)
    function decimals() external view returns (uint8) {
        return IERC20Metadata(address(s)).decimals();
    }

    function asset() external view returns (address) {
        return s.asset();
    }

    function balanceOf(address account) external view returns (uint256) {
        return IERC20(address(s)).balanceOf(account); // senior shares
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        if (spender == address(this)) spender = address(s);
        return usdc.allowance(owner, spender);
    }

    function convertToAssets(uint256 shares) external view returns (uint256) {
        return s.convertToAssets(shares);
    }

    function convertToJuniorAssets(uint256 jShares) external view returns (uint256) {
        return j.convertToAssets(jShares); // j's asset is sUSDC
    }

    function availableCashAssets() external view returns (uint256) {
        (,, uint256 liq) = mkt.expectedBalances();
        return liq;
    }

    function maxWithdraw(address owner_) external view returns (uint256) {
        return s.maxWithdraw(owner_);
    }

    function psSeniorRay() external view returns (uint256) {
        uint8 d = IERC20Metadata(address(s)).decimals();
        uint256 one = 10 ** d;
        uint256 pps = s.convertToAssets(one);
        return pps * 1e27 / one;
    }

    function psJuniorRay() external view returns (uint256) {
        uint8 d = IERC20Metadata(address(j)).decimals();
        uint256 one = 10 ** d;
        uint256 pps = j.convertToAssets(one);
        return pps * 1e27 / one;
    }

    function interestRateModel() external view returns (address) { return irm; }
    function MODULE_RISKMANAGER() external view returns (address) { return riskManagerShim; }

    function debtOf(address account) external view returns (uint256) {
        return mkt.positionOf(account);
    }

    // 4626
    function deposit(uint256 assets, address receiver) external returns (uint256) {
        return s.deposit(assets, receiver);
    }
    function withdraw(uint256 assets, address receiver, address owner_) external returns (uint256) {
        return s.withdraw(assets, receiver, owner_);
    }

    // Borrow/repay → Market
    function borrow(uint256 assets, address receiver) external returns (uint256) {
        return mkt.borrow(assets, receiver);
    }
    function repay(uint256 assets, address onBehalfOf) external returns (uint256) {
        return mkt.repay(assets, onBehalfOf);
    }

    // “Demote” junior → redeem jUSDC for sUSDC
    function demoteToSenior(uint256 jShares, address to) external returns (uint256 sUsdcOut) {
        sUsdcOut = j.redeem(jShares, to, msg.sender);
    }

    function previewWithdrawJunior(uint256 jShares) external view returns (uint256) {
        return j.convertToAssets(jShares);
    }
}


