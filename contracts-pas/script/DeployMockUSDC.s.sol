// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {MockUSDC} from "../src/Token/MockUSDC.sol";

contract DeployMockUSDC is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        MockUSDC usdc = new MockUSDC();

        vm.stopBroadcast();

        console2.log("MockUSDC:", address(usdc));
        console2.log("Decimals:", usdc.decimals());
    }
}