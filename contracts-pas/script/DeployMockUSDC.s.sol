// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {USDCMock} from "../src/Token/USDCMock.sol";

contract DeployMockUSDC is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        USDCMock usdc = new USDCMock();

        vm.stopBroadcast();

        console2.log("MockUSDC:", address(usdc));
        console2.log("Decimals:", usdc.decimals());
    }
}