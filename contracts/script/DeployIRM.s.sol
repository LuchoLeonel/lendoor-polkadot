// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol"; // trae el vm

interface IIRM {
    error E_IRMUpdateUnauthorized();

    function computeInterestRate(address vault, uint256, uint256) external returns (uint256);

    function computeInterestRateView(address vault, uint256, uint256) external view returns (uint256);
}

contract TestIRMFixedAPR is IIRM {
    uint256 public immutable ratePerSecondRay;
    uint256 private constant _SECONDS_PER_YEAR = 365 days;

    constructor(uint256 aprBps) {
        // aprBps in basis points, example: 10000 = 100% APR
        ratePerSecondRay = (aprBps * 1e27) / 10_000 / _SECONDS_PER_YEAR;
    }

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

contract DeployIRM is Script {
    function run() external {
        vm.startBroadcast();
        // 10000 bps = 100% APR
        new TestIRMFixedAPR(10000);
        vm.stopBroadcast();
    }
}