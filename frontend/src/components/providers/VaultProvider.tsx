'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { BrowserProvider, Contract, ethers } from 'ethers';
import type { Eip1193Provider } from 'ethers';
import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import IEVault from '@/contracts/IEVault.json';
import * as IEVC from '@/contracts/IEVC.json';

// ====== ENV (Vite) ======
const EVAULT_ADDRESS = import.meta.env.VITE_EVAULT as `0x${string}` | undefined;
const EVAULT_JUNIOR_ADDRESS = import.meta.env.VITE_EVAULT_JUNIOR as `0x${string}` | undefined;
const EVAULT_CONTROLLER_ADDRESS = import.meta.env.VITE_EVAULT_CONTROLLER as `0x${string}` | undefined;
const USDC_ADDRESS   = import.meta.env.VITE_USDC   as `0x${string}` | undefined;

const EXPECTED_CHAIN_ID: number | null = null; // ej 8453
const USE_WINDOW_PROVIDER_FALLBACK = true;

// ====== ABI mínimo ERC20 ======
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function transfer(address,uint256) returns (bool)',
  'function transferFrom(address,address,uint256) returns (bool)',
];

type EVaultContract = Contract;
type ERC20Contract  = Contract;
type ControllerContract = Contract; 

type VaultContextType = {
  ready: boolean;
  // vault
  evault: EVaultContract | null;
  evaultAddress: `0x${string}` | null;

  evaultJunior: EVaultContract | null;
  evaultJuniorAddress: `0x${string}` | null;

  // controller
  controller: ControllerContract | null;       
  controllerAddress: `0x${string}` | null; 

  // usdc
  usdc: ERC20Contract | null;
  usdcAddress: `0x${string}` | null;
  usdcDecimals: number | null;

  signer: ethers.Signer | null;
  connectedAddress: string | null;
  chainId: number | null;

  refresh: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const VaultContext = createContext<VaultContextType | null>(null);

// ---- helpers ----
async function getDynamicEip1193(primaryWallet: any): Promise<Eip1193Provider | null> {
  if (!primaryWallet?.getEthereumProvider) return null;
  try {
    const eth = await primaryWallet.getEthereumProvider();
    return (eth ?? null) as Eip1193Provider | null;
  } catch (e) {
    console.warn('getDynamicEip1193 error:', e);
    return null;
  }
}

function pickWindowEvmProvider(
  prefer: 'metamask' | 'coinbase' | 'phantom' | 'any' = 'metamask'
): Eip1193Provider | null {
  if (typeof window === 'undefined') return null;
  const eth: any = (window as any).ethereum;
  if (!eth) return null;
  const list = eth.providers ?? [eth];

  const byPref =
    (prefer === 'metamask' && list.find((p: any) => p.isMetaMask)) ||
    (prefer === 'coinbase' && list.find((p: any) => p.isCoinbaseWallet)) ||
    (prefer === 'phantom' && list.find((p: any) => p.isPhantom)) ||
    null;

  return byPref ?? list.find((p: any) => p.isMetaMask) ?? list[0] ?? null;
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const { primaryWallet, sdkHasLoaded } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();

  const [ready, setReady] = useState(false);

  const [evault, setEVault] = useState<EVaultContract | null>(null);
  const [evaultJunior, setEVaultJunior] = useState<EVaultContract | null>(null); 


  const [controller, setController] = useState<ControllerContract | null>(null);

  const [usdc, setUSDC]     = useState<ERC20Contract | null>(null);
  const [usdcDecimals, setUsdcDecimals] = useState<number | null>(null);

  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const eip1193Ref = useRef<Eip1193Provider | null>(null);
  const listenersSetRef = useRef(false);

  const disconnect = useCallback(async () => {
    setReady(false);
    setEVault(null);
    setEVaultJunior(null);
    setController(null);
    setUSDC(null);
    setUsdcDecimals(null);
    setSigner(null);
    setConnectedAddress(null);
    setChainId(null);
    eip1193Ref.current = null;
    listenersSetRef.current = false;
  }, []);

  const build = useCallback(async () => {
    if (!sdkHasLoaded) {
      console.debug('[Vault] sdkHasLoaded=false → skip build');
      return;
    }

    try {
      setReady(false);

      // 1) elegir provider
      let eip1193: Eip1193Provider | null = null;

      if (isLoggedIn && primaryWallet) {
        eip1193 = await getDynamicEip1193(primaryWallet);
      }
      if (!eip1193 && USE_WINDOW_PROVIDER_FALLBACK) {
        eip1193 = pickWindowEvmProvider('metamask');
        if (!eip1193) return;
      }
      if (!eip1193) {
        console.debug('[Vault] sin EIP-1193 por ahora');
        return;
      }

      eip1193Ref.current = eip1193;

      // 2) ethers provider + signer
      const ethersProvider = new BrowserProvider(eip1193);
      const net = await ethersProvider.getNetwork();
      const currentChainId = Number(net.chainId);
      const tmpSigner = await ethersProvider.getSigner();
      const addr = await tmpSigner.getAddress();

      if (EXPECTED_CHAIN_ID !== null && currentChainId !== EXPECTED_CHAIN_ID) {
        console.warn(`[Vault] ChainId inesperado ${currentChainId} (esperado ${EXPECTED_CHAIN_ID})`);
      }

      // 3) contratos
      // 3a) EVault
        const abi = (IEVault as any).abi ?? IEVault;
      let cVault: EVaultContract | null = null;
      if (!EVAULT_ADDRESS) {
        console.error('[Vault] Falta EVAULT_ADDRESS (VITE_EVAULT)');
      } else {
        cVault = new Contract(EVAULT_ADDRESS, abi, tmpSigner);
      }

      let cVaultJunior: EVaultContract | null = null;
        if (!EVAULT_JUNIOR_ADDRESS) {
        console.warn('[Vault] Falta EVAULT_JUNIOR_ADDRESS (VITE_EVAULT_JUNIOR)');
        } else {
        cVaultJunior = new Contract(EVAULT_JUNIOR_ADDRESS, abi, tmpSigner);
        }

      const controllerAbi = (IEVC as any).abi ?? IEVC;
      let cController: ControllerContract | null = null;
      if (!EVAULT_CONTROLLER_ADDRESS) {
        console.warn('[Vault] Falta EVAULT_CONTROLLER_ADDRESS (VITE_EVAULT_CONTROLLER)');
      } else {
        cController = new Contract(EVAULT_CONTROLLER_ADDRESS, controllerAbi, tmpSigner);
      }

      // 3b) USDC (ERC20)
      let cUsdc: ERC20Contract | null = null;
      let dec: number | null = null;
      if (!USDC_ADDRESS) {
        console.warn('[Vault] Falta USDC_ADDRESS (VITE_USDC). Se omite USDC.');
      } else {
        cUsdc = new Contract(USDC_ADDRESS, ERC20_ABI, tmpSigner);
        try {
          dec = Number(await cUsdc.decimals());
        } catch {
          dec = null; // si por algo falla leer decimales, seguimos igual
        }
      }

      // 4) estado
      setSigner(tmpSigner);
      setConnectedAddress(addr);
      setChainId(currentChainId);
      setEVault(cVault);
      setEVaultJunior(cVaultJunior);
      setController(cController);
      setUSDC(cUsdc);
      setUsdcDecimals(dec);
      setReady(true);

      // 5) listeners (una sola vez)
      if (
        !listenersSetRef.current &&
        'on' in eip1193 &&
        typeof (eip1193 as any).on === 'function'
      ) {
        const handleAccountsChanged = async () => { await build(); };
        const handleChainChanged = async () => { await build(); };

        (eip1193 as any).on('accountsChanged', handleAccountsChanged);
        (eip1193 as any).on('chainChanged', handleChainChanged);
        listenersSetRef.current = true;
      }

      console.debug('[Vault] READY ✅', {
        addr,
        chainId: currentChainId,
        evaultAddress: EVAULT_ADDRESS,
        evaultJuniorAddress: EVAULT_JUNIOR_ADDRESS,
        controllerAddress: EVAULT_CONTROLLER_ADDRESS, 
        usdcAddress: USDC_ADDRESS,
        usdcDecimals: dec,
      });
    } catch (err) {
      console.error('VaultProvider build() error:', err);
      await disconnect();
    }
  }, [sdkHasLoaded, isLoggedIn, primaryWallet, disconnect]);

  useEffect(() => {
    void build();
  }, [build, sdkHasLoaded, isLoggedIn, primaryWallet]);

  const value: VaultContextType = useMemo(
    () => ({
      ready,
      evault,
      evaultAddress: (EVAULT_ADDRESS ?? null) as `0x${string}` | null,

      evaultJunior, 
      evaultJuniorAddress: (EVAULT_JUNIOR_ADDRESS ?? null) as `0x${string}` | null,

      controller, 
      controllerAddress: (EVAULT_CONTROLLER_ADDRESS ?? null) as `0x${string}` | null,

      usdc,
      usdcAddress: (USDC_ADDRESS ?? null) as `0x${string}` | null,
      usdcDecimals,

      signer,
      connectedAddress,
      chainId,

      refresh: build,
      disconnect,
    }),
    [
      ready,
      evault,
      evaultJunior, 
      controller,  
      signer,
      connectedAddress,
      chainId,
      usdc,
      usdcDecimals,
      build,
      disconnect,
    ]
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault debe usarse dentro de <VaultProvider>');
  return ctx;
}
