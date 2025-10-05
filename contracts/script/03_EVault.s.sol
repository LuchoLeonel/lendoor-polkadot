// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import {GenericFactory} from "evk/GenericFactory/GenericFactory.sol";
import {EulerRouter} from "euler-price-oracle/EulerRouter.sol";
import {EulerRouterFactory} from "erf/EulerRouterFactory.sol";

contract EVaultDeployer is Script {
    function run() public returns (address oracleRouter, address eVault) {
        // 1) Read the json input from /script
        string memory json = vm.envString("INPUT_JSON");

        address eVaultFactory      = vm.parseJsonAddress(json, ".eVaultFactory");
        bool upgradable            = vm.parseJsonBool(json, ".upgradable");
        address asset              = vm.parseJsonAddress(json, ".asset");
        address unitOfAccount      = vm.parseJsonAddress(json, ".unitOfAccount"); // 1:1  = asset
        address oracle             = vm.parseJsonAddress(json, ".oracle");        // adapter or address(0) if you use a supported identity

        // Optional: deploy and configure router
        bool deployRouterForOracle = vm.parseJsonBool(json, ".deployRouterForOracle");
        address oracleRouterFactory = address(0);
        if (deployRouterForOracle) {
            oracleRouterFactory = vm.parseJsonAddress(json, ".oracleRouterFactory");
        }

        vm.startBroadcast();

        if (deployRouterForOracle) {
            // 2) Deploy the router and configure the path (asset, unitOfAccount) -> oracleAdapter
            EulerRouter _router = EulerRouter(EulerRouterFactory(oracleRouterFactory).deploy(tx.origin));
            _router.govSetConfig(asset, unitOfAccount, oracle); // warning: 'oracle' here must be the correct adapter
            oracleRouter = address(_router);
        }

        // 3) Create the eVault proxy
        eVault = address(
            GenericFactory(eVaultFactory).createProxy(
                address(0), // implementation is taken from the factory
                upgradable,
                abi.encodePacked(asset, deployRouterForOracle ? oracleRouter : oracle, unitOfAccount)
            )
        );

        vm.stopBroadcast();

        // 4) Save output
        string memory outPath = string.concat(vm.projectRoot(), "/script/07_EVault_output.json");
        string memory obj = vm.serializeAddress("eVault", "eVault", eVault);
        if (deployRouterForOracle) {
            obj = vm.serializeAddress("eVault", "oracleRouter", oracleRouter);
        }
        vm.writeJson(obj, outPath);
    }
}