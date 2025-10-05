// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

interface IVaultConfigurator {
    struct InitParams {
        uint64 version;
        address owner;
        bytes vaultParams;
        uint64 delegatorIndex;
        bytes delegatorParams;
        bool withSlasher;
        uint64 slasherIndex;
        bytes slasherParams;
    }

    function create(InitParams calldata params)
        external
        returns (address vault, address delegator, address slasher);
}

contract CreateVault is Script {
    // --- Structs locales que replican el layout esperado para abi.encode ---

    // Vault v1 / baseParams (no tokenizado)
    struct VaultBaseParams {
        address collateral;
        address burner;
        uint48 epochDuration;
        bool depositWhitelist;
        bool isDepositLimit;
        uint256 depositLimit;
        address defaultAdminRoleHolder;
        address depositWhitelistSetRoleHolder;
        address depositorWhitelistRoleHolder;
        address isDepositLimitSetRoleHolder;
        address depositLimitSetRoleHolder;
    }

    // Vault v2 (tokenizado) -> toma baseParams + name/symbol
    struct VaultTokenizedParams {
        VaultBaseParams baseParams;
        string name;
        string symbol;
    }

    // Delegator (NetworkRestakeDelegator = index 0)
    struct DelegatorBaseParams {
        address defaultAdminRoleHolder;
        address hook;
        address hookSetRoleHolder;
    }

    struct NetworkRestakeDelegatorParams {
        DelegatorBaseParams baseParams;
        address[] networkLimitSetRoleHolders;
        address[] operatorNetworkSharesSetRoleHolders;
    }

    // Slasher (index 0 = Slasher común)
    struct SlasherBaseParams {
        bool isBurnerHook;
    }

    struct SlasherInit {
        SlasherBaseParams baseParams;
    }

    // VetoSlasher (index 1)
    struct VetoSlasherInit {
        SlasherBaseParams baseParams;
        uint48 vetoDuration;
        uint16 resolverSetEpochsDelay;
    }

    function run() external {
        // === Lee variables de entorno ===
        // Sepolia VaultConfigurator (la que pasaste)
        address CONFIG = vm.envAddress("CONFIG"); // 0xD2191FE92987171691d552C219b8caEf186eb9cA (Sepolia)
        address OWNER  = vm.envAddress("OWNER");  // tu EOA o multisig owner del vault
        uint64 VERSION = uint64(vm.envUint("VERSION")); // 1 = v1, 2 = v2 (tokenizado)

        // Vault base params
        address COLLATERAL = vm.envAddress("COLLATERAL");   // USDC/mock (6 dec)
        address BURNER     = vm.envAddress("BURNER");       // puede ser 0x...dead
        uint48  EPOCH      = uint48(vm.envUint("EPOCH"));   // 86400=1d / 604800=7d
        bool    WL         = vm.envBool("DEPOSIT_WHITELIST");
        bool    IS_LIMIT   = vm.envBool("IS_DEPOSIT_LIMIT");
        uint256 LIMIT      = vm.envUint("DEPOSIT_LIMIT");

        // Roles (si no querés complicarte, seteá todos = OWNER)
        address ROLE1 = vm.envAddress("ROLE1"); // defaultAdminRoleHolder
        address ROLE2 = vm.envAddress("ROLE2"); // depositWhitelistSetRoleHolder
        address ROLE3 = vm.envAddress("ROLE3"); // depositorWhitelistRoleHolder
        address ROLE4 = vm.envAddress("ROLE4"); // isDepositLimitSetRoleHolder
        address ROLE5 = vm.envAddress("ROLE5"); // depositLimitSetRoleHolder

        // Tokenized name/symbol (solo si VERSION=2)
        string memory NAME   = vm.envOr("NAME", string("Symbiotic Vault USDC"));
        string memory SYMBOL = vm.envOr("SYMBOL", string("svUSDC"));

        // Delegator
        uint64  DELEGATOR_INDEX = uint64(vm.envUint("DELEGATOR_INDEX")); // 0=NetworkRestake
        address HOOK            = vm.envAddress("HOOK");                 // 0x0 si no usás hook

        // Slasher
        bool    WITH_SLASHER  = vm.envBool("WITH_SLASHER");
        uint64  SLASHER_INDEX = uint64(vm.envUint("SLASHER_INDEX")); // 0=Slasher, 1=Veto
        bool    IS_BURNER_HOOK = vm.envBool("IS_BURNER_HOOK");
        uint48  VETO_DURATION  = uint48(vm.envUint("VETO_DURATION"));       // si Veto
        uint16  RESOLVER_DELAY = uint16(vm.envUint("RESOLVER_DELAY"));       // si Veto

        vm.startBroadcast();

        // --- arma vaultParams ---
        bytes memory vaultParams;
        {
            VaultBaseParams memory base = VaultBaseParams({
                collateral: COLLATERAL,
                burner: BURNER,
                epochDuration: EPOCH,
                depositWhitelist: WL,
                isDepositLimit: IS_LIMIT,
                depositLimit: LIMIT,
                defaultAdminRoleHolder: ROLE1,
                depositWhitelistSetRoleHolder: ROLE2,
                depositorWhitelistRoleHolder: ROLE3,
                isDepositLimitSetRoleHolder: ROLE4,
                depositLimitSetRoleHolder: ROLE5
            });

            if (VERSION == 2) {
                VaultTokenizedParams memory tok = VaultTokenizedParams({
                    baseParams: base,
                    name: NAME,
                    symbol: SYMBOL
                });
                vaultParams = abi.encode(tok);
            } else {
                // VERSION == 1
                vaultParams = abi.encode(base);
            }
        }

        // --- arma delegatorParams (para NetworkRestake index=0) ---
        bytes memory delegatorParams;
        {
            address[] memory one = new address[](1);
            one[0] = OWNER;

            NetworkRestakeDelegatorParams memory d = NetworkRestakeDelegatorParams({
                baseParams: DelegatorBaseParams({
                    defaultAdminRoleHolder: OWNER,
                    hook: HOOK,
                    hookSetRoleHolder: OWNER
                }),
                networkLimitSetRoleHolders: one,
                operatorNetworkSharesSetRoleHolders: one
            });
            delegatorParams = abi.encode(d);
        }

        // --- arma slasherParams ---
        bytes memory slasherParams;
        if (WITH_SLASHER) {
            if (SLASHER_INDEX == 1) {
                VetoSlasherInit memory v = VetoSlasherInit({
                    baseParams: SlasherBaseParams({isBurnerHook: IS_BURNER_HOOK}),
                    vetoDuration: VETO_DURATION,
                    resolverSetEpochsDelay: RESOLVER_DELAY
                });
                slasherParams = abi.encode(v);
            } else {
                // SLASHER_INDEX == 0
                SlasherInit memory s = SlasherInit({
                    baseParams: SlasherBaseParams({isBurnerHook: IS_BURNER_HOOK})
                });
                slasherParams = abi.encode(s);
            }
        } else {
            slasherParams = bytes("");
            SLASHER_INDEX = 0;
        }

        // --- crea el vault ---
        IVaultConfigurator.InitParams memory p = IVaultConfigurator.InitParams({
            version: VERSION,
            owner: OWNER,
            vaultParams: vaultParams,
            delegatorIndex: DELEGATOR_INDEX,
            delegatorParams: delegatorParams,
            withSlasher: WITH_SLASHER,
            slasherIndex: SLASHER_INDEX,
            slasherParams: slasherParams
        });

        (address vault_, address delegator_, address slasher_) = IVaultConfigurator(CONFIG).create(p);

        console2.log("Vault       :", vault_);
        console2.log("Delegator   :", delegator_);
        console2.log("Slasher     :", slasher_);

        vm.stopBroadcast();
    }
}