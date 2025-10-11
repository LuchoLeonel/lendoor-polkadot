// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from  "forge-std/Script.sol";

import {MockUSDC} from "../src/Token/MockUSDC.sol";
import {SUSDC}    from "../src/Token/SUSDC.sol";
import {JUSDC}    from "../src/Token/JUSDC.sol";
import {LendMarket} from "../src/Market/LendMarket.sol";
import {IRM} from "../src/interestRateModel/IRM.sol";
import {CreditLimitManager} from "../src/CreditLimitManager/CreditLimitManager.sol";
import {EVaultAdapter} from "../src/Adapter/EVaultAdapter.sol";
import {console2} from "forge-std/console2.sol";

contract DeployAll is Script {
    // Parámetros de despliegue (puedes setearlos vía env)
    uint256 public aprBps;     // p.ej. 800 = 8% APR
    address public owner;      // owner de todo

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        aprBps = vm.envOr("APR_BPS", uint256(800)); // default 8%
        owner  = vm.envAddress("OWNER");            // required

        vm.startBroadcast(pk);

        // 1) Subir USDC mock
        MockUSDC usdc = new MockUSDC();

        // 2) Subir IRM (modelo de tasa) y CLM (líneas de crédito)
        IRM irm = new IRM(aprBps);
        CreditLimitManager clm = new CreditLimitManager(owner);

        // 3) Subir sUSDC (vault senior)
        SUSDC s = new SUSDC(usdc, owner);

        // 4) Subir Market (pasa el sUSDC como seniorVault inicial)
        //    Nota: setear owner para Ownable del market
        LendMarket mkt = new LendMarket(
            usdc,
            address(s),        // seniorVault
            address(irm),
            address(clm),
            owner              // Ownable(owner)
        );

        // 5) Wirear sUSDC → Market
        s.setMarket(address(mkt));

        // 6) (Opcional pero útil) Subir jUSDC y conectarlo
        JUSDC j = new JUSDC(s, owner);

        // 7) Subir Adapter (para compat con ABI viejo del front)
        EVaultAdapter adapter = new EVaultAdapter(
            address(s),
            address(j),
            address(mkt),
            address(usdc),
            address(irm),
            address(clm) // usamos CLM como “risk manager address” para el front
        );

        vm.stopBroadcast();

        console2.log("==== Deploy resumen ====");
        console2.log("Owner           :", owner);
        console2.log("USDC            :", address(usdc));
        console2.log("IRM             :", address(irm));
        console2.log("CLM             :", address(clm));
        console2.log("sUSDC (Senior)  :", address(s));
        console2.log("Market          :", address(mkt));
        console2.log("jUSDC (Junior)  :", address(j));
        console2.log("EVaultAdapter   :", address(adapter));
    }
}