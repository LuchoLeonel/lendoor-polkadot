// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin-contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin-contracts/token/ERC20/extensions/ERC4626.sol";
import {Ownable} from "@openzeppelin-contracts/access/Ownable.sol";
import {IMarket} from "./Interfaces/IMarket.sol";

contract SUSDC is ERC4626, Ownable {
    IMarket public market;

    constructor(IERC20 usdc_, address owner_)
        ERC20("Senior USDC Vault", "sUSDC") 
        ERC4626(usdc_)                    
        Ownable(owner_)
    {}

    function setMarket(address market_) external onlyOwner {
        require(market_ != address(0), "market=0");
        market = IMarket(market_);
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        super._deposit(caller, receiver, assets, shares);
        if (assets > 0) {
            IERC20(asset()).approve(address(market), assets);
            market.supplyFromSenior(assets);
        }
    }

    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal override {
        if (assets > 0) {
            market.withdrawToSenior(assets);
        }
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    function totalAssets() public view override returns (uint256) {
        if (address(market) == address(0)) {
            return IERC20(asset()).balanceOf(address(this));
        }
        (uint256 totalSupplyAssets,,) = market.expectedBalances();
        return totalSupplyAssets + IERC20(asset()).balanceOf(address(this));
    }

    function harvest() external {
        market.accrue();
    }
}