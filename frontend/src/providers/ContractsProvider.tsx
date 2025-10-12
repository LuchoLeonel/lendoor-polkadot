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
import { BrowserProvider, Contract, ethers, type Eip1193Provider } from 'ethers';
import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';

// ABIs
import EVaultAdapterJson from '@/contracts/EVaultAdapter.json';
import IRMJson from '@/contracts/IRM.json';
import JUSDCJson from '@/contracts/JUSDC.json';
import SUSDCJson from '@/contracts/SUSDC.json';
import LendMarketJson from '@/contracts/LendMarket.json';
import RiskManagerShimJson from '@/contracts/RiskManagerShim.json';
import CreditLimitManagerJson from '@/contracts/CreditLimitManager.json';

// Env addrs
const LEND_MARKET_ADDRESS = import.meta.env.VITE_LEND_MARKET as `0x${string}` | undefined;
const IRM_ADDRESS = import.meta.env.VITE_IRM as `0x${string}` | undefined;
const JUSDC_ADDRESS = import.meta.env.VITE_JUSDC as `0x${string}` | undefined;
const SUSDC_ADDRESS = import.meta.env.VITE_SUSDC as `0x${string}` | undefined;
const RISK_MANAGER_SHIM_ADDRESS = import.meta.env.VITE_RISK_MANAGER_SHIM as `0x${string}` | undefined;
const EVAULT_ADAPTER_ADDRESS = import.meta.env.VITE_EVAULT_ADAPTER as `0x${string}` | undefined;
const USDC_ADDRESS = import.meta.env.VITE_USDC as `0x${string}` | undefined;
const CREDIT_MANAGER_ADDRESS = import.meta.env.VITE_CREDIT_MANAGER_ADDRESS as `0x${string}` | undefined;

// Optional network check
const EXPECTED_CHAIN_ID: number | null = null;
const USE_WINDOW_PROVIDER_FALLBACK = true;

type C = Contract;

type ContractsContextType = {
  ready: boolean;

  lendMarket: C | null;
  lendMarketAddress: `0x${string}` | null;

  irm: C | null;
  irmAddress: `0x${string}` | null;

  jUSDC: C | null;
  jUSDCAddress: `0x${string}` | null;

  sUSDC: C | null;
  sUSDCAddress: `0x${string}` | null;

  riskManagerShim: C | null;
  riskManagerShimAddress: `0x${string}` | null;

  evaultAdapter: C | null;
  evaultAdapterAddress: `0x${string}` | null;

  creditManager: C | null;
  creditManagerAddress: `0x${string}` | null;

  usdc: C | null;
  usdcAddress: `0x${string}` | null;
  usdcDecimals: number | null;

  signer: ethers.Signer | null;
  connectedAddress: string | null;
  chainId: number | null;

  refresh: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const ContractsContext = createContext<ContractsContextType | null>(null);

// Minimal ERC20 interface for USDC-like tokens
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function transfer(address,uint256) returns (bool)',
  'function transferFrom(address,address,uint256) returns (bool)',
  'function mint(address,uint256)',
];

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

  const [lendMarket, setLendMarket] = useState<C | null>(null);
  const [irm, setIRM] = useState<C | null>(null);
  const [jUSDC, setJUSDC] = useState<C | null>(null);
  const [sUSDC, setSUSDC] = useState<C | null>(null);
  const [riskManagerShim, setRiskManagerShim] = useState<C | null>(null);
  const [evaultAdapter, setEVaultAdapter] = useState<C | null>(null);
  const [creditManager, setCreditManager] = useState<C | null>(null);
  const [usdc, setUSDC] = useState<C | null>(null);

  const [usdcDecimals, setUsdcDecimals] = useState<number | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const eip1193Ref = useRef<Eip1193Provider | null>(null);
  const listenersSetRef = useRef(false);

  const disconnect = useCallback(async () => {
    setReady(false);

    setLendMarket(null);
    setIRM(null);
    setJUSDC(null);
    setSUSDC(null);
    setRiskManagerShim(null);
    setEVaultAdapter(null);
    setCreditManager(null);
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

      // Resolve provider
      let eip1193: Eip1193Provider | null = null;
      if (isLoggedIn && primaryWallet) eip1193 = await getDynamicEip1193(primaryWallet);
      if (!eip1193 && USE_WINDOW_PROVIDER_FALLBACK) eip1193 = await pickAuthorizedWindowProvider();
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
        // optionally gate UI elsewhere
      }

      // Signer if already authorized
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

      const sp: any = tmpSigner ?? ethersProvider;

      // Normalize ABIs
      const abi = (j: any) => (j?.abi ?? j);

      // Instances (null-safe by address)
      const cLendMarket       = LEND_MARKET_ADDRESS       ? new Contract(LEND_MARKET_ADDRESS,       abi(LendMarketJson),      sp) : null;
      const cIRM              = IRM_ADDRESS               ? new Contract(IRM_ADDRESS,               abi(IRMJson),             sp) : null;
      const cJUSDC            = JUSDC_ADDRESS             ? new Contract(JUSDC_ADDRESS,             abi(JUSDCJson),           sp) : null;
      const cSUSDC            = SUSDC_ADDRESS             ? new Contract(SUSDC_ADDRESS,             abi(SUSDCJson),           sp) : null;
      const cRiskManagerShim  = RISK_MANAGER_SHIM_ADDRESS ? new Contract(RISK_MANAGER_SHIM_ADDRESS, abi(RiskManagerShimJson), sp) : null;
      const cEVaultAdapter    = EVAULT_ADAPTER_ADDRESS    ? new Contract(EVAULT_ADAPTER_ADDRESS,    abi(EVaultAdapterJson),   sp) : null;
      const cCreditManager    = CREDIT_MANAGER_ADDRESS    ? new Contract(CREDIT_MANAGER_ADDRESS,    abi(CreditLimitManagerJson), sp) : null;

      let cUSDC: C | null = null;
      let dec: number | null = null;
      if (USDC_ADDRESS) {
        cUSDC = new Contract(USDC_ADDRESS, ERC20_ABI, sp);
        try { dec = Number(await cUSDC.decimals()); } catch { dec = null; }
      }

      // Save
      setSigner(tmpSigner);
      setConnectedAddress(addr);
      setChainId(currentChainId);

      setLendMarket(cLendMarket);
      setIRM(cIRM);
      setJUSDC(cJUSDC);
      setSUSDC(cSUSDC);
      setRiskManagerShim(cRiskManagerShim);
      setEVaultAdapter(cEVaultAdapter);
      setCreditManager(cCreditManager);
      setUSDC(cUSDC);
      setUsdcDecimals(dec);

      setReady(true);

      // Rebuild on account/chain changes
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

      lendMarket,
      lendMarketAddress: (LEND_MARKET_ADDRESS ?? null) as `0x${string}` | null,

      irm,
      irmAddress: (IRM_ADDRESS ?? null) as `0x${string}` | null,

      jUSDC,
      jUSDCAddress: (JUSDC_ADDRESS ?? null) as `0x${string}` | null,

      sUSDC,
      sUSDCAddress: (SUSDC_ADDRESS ?? null) as `0x${string}` | null,

      riskManagerShim,
      riskManagerShimAddress: (RISK_MANAGER_SHIM_ADDRESS ?? null) as `0x${string}` | null,

      evaultAdapter,
      evaultAdapterAddress: (EVAULT_ADAPTER_ADDRESS ?? null) as `0x${string}` | null,

      creditManager,
      creditManagerAddress: (CREDIT_MANAGER_ADDRESS ?? null) as `0x${string}` | null,

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
      lendMarket,
      irm,
      jUSDC,
      sUSDC,
      riskManagerShim,
      evaultAdapter,
      creditManager,
      usdc,
      usdcDecimals,
      signer,
      connectedAddress,
      chainId,
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
