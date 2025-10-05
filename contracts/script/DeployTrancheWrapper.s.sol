// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC4626} from "../lib/openzeppelin-contracts/contracts/interfaces/IERC4626.sol";
import {SymbioticTrancheVault} from "../src/Symbiotic/SymbioticTrancheVault.sol";

interface IERC20Like {
    function decimals() external view returns (uint8);
}

contract DeployTrancheWrapper is Script {
    function run() external {
        // ENV:
        // ERC4626_VAULT = address del vault ERC4626 that uses asset()
        // OWNER         = owner del wrapper (tu EOA o multisig)
        address ERC4626_VAULT = vm.envAddress("ERC4626_VAULT");
        address OWNER         = vm.envAddress("OWNER");

        vm.startBroadcast();

        SymbioticTrancheVault wrapper = new SymbioticTrancheVault(
            IERC4626(ERC4626_VAULT),
            OWNER
        );

        console2.log("Wrapper deployed at:", address(wrapper));
        console2.log("ERC4626 vault:", ERC4626_VAULT);
        console2.log("Underlying asset (asset() of vault):", address(IERC4626(ERC4626_VAULT).asset()));
        console2.log("pps SNR (1e6):", wrapper.ppsSenior());
        console2.log("pps JNR (1e6):", wrapper.ppsJunior());

        vm.stopBroadcast();
    }
}