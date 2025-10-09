'use client';

import {
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

const EVAULT_ADDRESS = import.meta.env.VITE_EVAULT as `0x${string}` | undefined;
const EVAULT_JUNIOR_ADDRESS = import.meta.env.VITE_EVAULT_JUNIOR as `0x${string}` | undefined;
const EVAULT_CONTROLLER_ADDRESS = import.meta.env.VITE_EVAULT_CONTROLLER as `0x${string}` | undefined;
const USDC_ADDRESS = import.meta.env.VITE_USDC as `0x${string}` | undefined;

const EXPECTED_CHAIN_ID: number | null = null;
const USE_WINDOW_PROVIDER_FALLBACK = true;

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
type ERC20Contract = Contract;
type ControllerContract = Contract;

type ContractsContextType = {
  ready: boolean;
  evault: EVaultContract | null;
  evaultAddress: `0x${string}` | null;
  evaultJunior: EVaultContract | null;
  evaultJuniorAddress: `0x${string}` | null;
  controller: ControllerContract | null;
  controllerAddress: `0x${string}` | null;
  usdc: ERC20Contract | null;
  usdcAddress: `0x${string}` | null;
  usdcDecimals: number | null;
  signer: ethers.Signer | null;
  connectedAddress: string | null;
  chainId: number | null;
  refresh: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const ContractsContext = createContext<ContractsContextType | null>(null);

async function getDynamicEip1193(primaryWallet: any): Promise<Eip1193Provider | null> {
  if (!primaryWallet?.getEthereumProvider) return null;
  try {
    const eth = await primaryWallet.getEthereumProvider();
    return (eth ?? null) as Eip1193Provider | null;
  } catch {
    return null;
  }
}

async function pickAuthorizedWindowProvider(): Promise<Eip1193Provider | null> {
  if (typeof window === 'undefined') return null;
  const ethAny: any = (window as any).ethereum;
  if (!ethAny) return null;
  const list = ethAny.providers ?? [ethAny];
  const pick =
    list.find((p: any) => p.isMetaMask) ||
    list.find((p: any) => p.isCoinbaseWallet) ||
    list[0] ||
    null;
  if (!pick?.request) return null;
  try {
    const accounts: string[] = await pick.request({ method: 'eth_accounts' });
    return accounts?.length ? (pick as Eip1193Provider) : null;
  } catch {
    return null;
  }
}

export function ContractsProvider({ children }: { children: ReactNode }) {
  const { primaryWallet, sdkHasLoaded } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();

  const [ready, setReady] = useState(false);
  const [evault, setEVault] = useState<EVaultContract | null>(null);
  const [evaultJunior, setEVaultJunior] = useState<EVaultContract | null>(null);
  const [controller, setController] = useState<ControllerContract | null>(null);
  const [usdc, setUSDC] = useState<ERC20Contract | null>(null);
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
    if (!sdkHasLoaded) return;

    try {
      setReady(false);

      let eip1193: Eip1193Provider | null = null;

      if (isLoggedIn && primaryWallet) {
        eip1193 = await getDynamicEip1193(primaryWallet);
      }

      if (!eip1193 && USE_WINDOW_PROVIDER_FALLBACK) {
        eip1193 = await pickAuthorizedWindowProvider();
      }

      if (!eip1193) {
        await disconnect();
        setReady(true);
        return;
      }

      eip1193Ref.current = eip1193;

      const ethersProvider = new BrowserProvider(eip1193);
      const net = await ethersProvider.getNetwork();
      const currentChainId = Number(net.chainId);
      if (EXPECTED_CHAIN_ID !== null && currentChainId !== EXPECTED_CHAIN_ID) {
        /* no-op */
      }

      let tmpSigner: ethers.Signer | null = null;
      let addr: string | null = null;
      try {
        const accounts: string[] = await (eip1193 as any).request({ method: 'eth_accounts' });
        if (accounts?.length) {
          tmpSigner = await ethersProvider.getSigner();
          addr = await tmpSigner.getAddress();
        }
      } catch {
        tmpSigner = null;
        addr = null;
      }

      const ieVaultAbi = (IEVault as any).abi ?? IEVault;
      const ctrlAbi = (IEVC as any).abi ?? IEVC;
      const signerOrProvider: any = tmpSigner ?? ethersProvider;

      const cVault = EVAULT_ADDRESS ? new Contract(EVAULT_ADDRESS, ieVaultAbi, signerOrProvider) : null;
      const cVaultJunior = EVAULT_JUNIOR_ADDRESS ? new Contract(EVAULT_JUNIOR_ADDRESS, ieVaultAbi, signerOrProvider) : null;
      const cController = EVAULT_CONTROLLER_ADDRESS ? new Contract(EVAULT_CONTROLLER_ADDRESS, ctrlAbi, signerOrProvider) : null;

      let cUsdc: ERC20Contract | null = null;
      let dec: number | null = null;
      if (USDC_ADDRESS) {
        cUsdc = new Contract(USDC_ADDRESS, ERC20_ABI, signerOrProvider);
        try {
          dec = Number(await cUsdc.decimals());
        } catch {
          dec = null;
        }
      }

      setSigner(tmpSigner);
      setConnectedAddress(addr);
      setChainId(currentChainId);
      setEVault(cVault);
      setEVaultJunior(cVaultJunior);
      setController(cController);
      setUSDC(cUsdc);
      setUsdcDecimals(dec);
      setReady(true);

      if (!listenersSetRef.current && 'on' in eip1193 && typeof (eip1193 as any).on === 'function') {
        const handleAccountsChanged = async () => { await build(); };
        const handleChainChanged = async () => { await build(); };
        (eip1193 as any).on('accountsChanged', handleAccountsChanged);
        (eip1193 as any).on('chainChanged', handleChainChanged);
        listenersSetRef.current = true;
      }
    } catch {
      await disconnect();
      setReady(true);
    }
  }, [sdkHasLoaded, isLoggedIn, primaryWallet, disconnect]);

  useEffect(() => {
    void build();
  }, [build, sdkHasLoaded, isLoggedIn, primaryWallet]);

  const value: ContractsContextType = useMemo(
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
    ],
  );

  return <ContractsContext.Provider value={value}>{children}</ContractsContext.Provider>;
}

export function useContracts() {
  const ctx = useContext(ContractsContext);
  if (!ctx) throw new Error('useContracts must be used within <ContractsProvider>');
  return ctx;
}

/* Final notes:
   - No eth_requestAccounts is called. It only reads eth_accounts and stays passive if empty.
*/