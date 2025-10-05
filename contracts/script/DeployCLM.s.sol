// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {CreditLimitManager} from "../src/Vault/CreditLimitManager.sol";

contract DeployCLM is Script {
    function run() external {
        vm.startBroadcast(); 
        new CreditLimitManager(msg.sender);
        vm.stopBroadcast();
    }
}