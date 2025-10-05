// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import {GenericFactory} from "evk/GenericFactory/GenericFactory.sol";

contract EVaultFactory is Script {
    function run() public returns (address eVaultFactory) {
        string memory outputScriptFileName = "02_EVaultFactory_output.json";

        // Read input from /script
        string memory json = vm.envString("INPUT_JSON");

        address eVaultImplementation = vm.parseJsonAddress(json, ".eVaultImplementation");

        vm.startBroadcast();
        eVaultFactory = execute(eVaultImplementation);
        vm.stopBroadcast();

        // Save output in /script
        string memory object = vm.serializeAddress("factory", "eVaultFactory", eVaultFactory);
        vm.writeJson(object, string.concat(vm.projectRoot(), "/script/", outputScriptFileName));
    }

    function deploy(address eVaultImplementation) public returns (address eVaultFactory) {
        vm.startBroadcast();
        eVaultFactory = execute(eVaultImplementation);
        vm.stopBroadcast();
    }

    function execute(address eVaultImplementation) public returns (address eVaultFactory) {
        eVaultFactory = address(new GenericFactory(msg.sender));
        GenericFactory(eVaultFactory).setImplementation(eVaultImplementation);
    }
}