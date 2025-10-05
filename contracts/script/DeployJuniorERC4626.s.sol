// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {IEVault} from "evk/EVault/IEVault.sol";
import {JuniorERC4626} from "../src/Wrapper/JuniorERC4626.sol";

contract DeployJuniorERC4626 is Script {
    function run() public returns (address wrapper) {
        string memory outputFile = "JuniorERC4626_output.json";
        string memory json = vm.envString("INPUT_JSON");

        address evault = vm.parseJsonAddress(json, ".evault");
        string memory name_   = vm.parseJsonString(json, ".name");
        string memory symbol_ = vm.parseJsonString(json, ".symbol");

        vm.startBroadcast();
        wrapper = execute(evault, name_, symbol_);
        vm.stopBroadcast();

        string memory obj = vm.serializeAddress("wrapper", "juniorERC4626", wrapper);
        vm.writeJson(obj, string.concat(vm.projectRoot(), "/script/", outputFile));
    }

    function deploy(address evault, string memory name_, string memory symbol_)
        public
        returns (address wrapper)
    {
        vm.startBroadcast();
        wrapper = execute(evault, name_, symbol_);
        vm.stopBroadcast();
    }

    function execute(address evault, string memory name_, string memory symbol_)
        public
        returns (address wrapper)
    {
        wrapper = address(new JuniorERC4626(evault, name_, symbol_));
    }
}