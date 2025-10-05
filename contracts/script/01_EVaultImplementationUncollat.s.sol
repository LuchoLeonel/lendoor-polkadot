// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import {Base} from "evk/EVault/shared/Base.sol";
import {BalanceForwarder} from "evk/EVault/modules/BalanceForwarder.sol";
import {Borrowing} from "evk/EVault/modules/Borrowing.sol";
import {Governance} from "evk/EVault/modules/Governance.sol";
import {Initialize} from "evk/EVault/modules/Initialize.sol";
import {Liquidation} from "evk/EVault/modules/Liquidation.sol";
import {Token} from "evk/EVault/modules/Token.sol";
import {Vault} from "lendoor/Vault/Vault.sol";
import {Dispatch} from "evk/EVault/Dispatch.sol";
import {EVault} from "evk/EVault/EVault.sol";


import {RiskManagerUncollat} from "../src/Vault/RiskManagerUncollat.sol";

contract EVaultImplementationUncollat is Script {
    function run()
        public
        returns (
            address moduleBalanceForwarder,
            address moduleBorrowing,
            address moduleGovernance,
            address moduleInitialize,
            address moduleLiquidation,
            address moduleRiskManager,
            address moduleToken,
            address moduleVault,
            address implementation
        )
    {
        Base.Integrations memory integrations;

        // Read input JSON from /script
        string memory outFile = "script/01_EVaultImplementation_output.json";
        string memory json = vm.envString("INPUT_JSON");

        integrations.evc              = vm.parseJsonAddress(json, ".evc");
        integrations.protocolConfig   = vm.parseJsonAddress(json, ".protocolConfig");
        integrations.sequenceRegistry = vm.parseJsonAddress(json, ".sequenceRegistry");
        integrations.balanceTracker   = vm.parseJsonAddress(json, ".balanceTracker");
        integrations.permit2          = vm.parseJsonAddress(json, ".permit2");

        vm.startBroadcast();
        Dispatch.DeployedModules memory m;
        (m, implementation) = execute(integrations); 
        vm.stopBroadcast();

        moduleBalanceForwarder = m.balanceForwarder;
        moduleBorrowing        = m.borrowing;
        moduleGovernance       = m.governance;
        moduleInitialize       = m.initialize;
        moduleLiquidation      = m.liquidation;
        moduleRiskManager      = m.riskManager;
        moduleToken            = m.token;
        moduleVault            = m.vault;

        // Write output JSON in /script
        string memory outPath = outFile;

        string memory mods;
        mods = vm.serializeAddress("modules", "balanceForwarder", m.balanceForwarder);
        mods = vm.serializeAddress("modules", "borrowing",        m.borrowing);
        mods = vm.serializeAddress("modules", "governance",       m.governance);
        mods = vm.serializeAddress("modules", "initialize",       m.initialize);
        mods = vm.serializeAddress("modules", "liquidation",      m.liquidation);
        mods = vm.serializeAddress("modules", "riskManagerUncollat", m.riskManager);
        mods = vm.serializeAddress("modules", "token",            m.token);
        mods = vm.serializeAddress("modules", "vault",            m.vault);

        string memory root;
        root = vm.serializeAddress("root", "eVaultImplementation", implementation);
        root = vm.serializeString("root", "modules", mods);
        vm.writeJson(root, outPath);
    }

    function deploy(Base.Integrations memory integrations)
        public
        returns (Dispatch.DeployedModules memory m, address implementation)
    {
        vm.startBroadcast();
        (m, implementation) = execute(integrations); 
        vm.stopBroadcast();
    }

    function execute(Base.Integrations memory integrations)
        public
        returns (Dispatch.DeployedModules memory m, address implementation)
    {
        m = Dispatch.DeployedModules({
            balanceForwarder: address(new BalanceForwarder(integrations)),
            borrowing:        address(new Borrowing(integrations)),
            governance:       address(new Governance(integrations)),
            initialize:       address(new Initialize(integrations)),
            liquidation:      address(new Liquidation(integrations)),
            riskManager:      address(new RiskManagerUncollat(integrations)),
            token:            address(new Token(integrations)),
            vault:            address(new Vault(integrations))
        });

        implementation = address(new EVault(integrations, m));
    }
}