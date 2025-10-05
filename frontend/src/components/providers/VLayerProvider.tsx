'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { keccak256, toBytes, type Abi, type Address, type Hash } from 'viem';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { vlayerClient } from '@/lib/vlayerTeleporterClient';

// ─────────────────────────────────────────────────────────────────────────────
// Config (ENV + defaults)
const CHAIN_ID = Number('1');

// ABIs
import proverSpec from '@/contracts/AverageBalance.json';
const AVERAGE_BALANCE_ABI = (proverSpec as any).abi as unknown as Abi;

// Hash del ABI (muchos SDKs esperan un branded hash del ABI/programa)
const AVERAGE_BALANCE_ABI_HASH = keccak256(
  toBytes(JSON.stringify(AVERAGE_BALANCE_ABI))
) as Hash;

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
type Proof = any;

export type AverageBalanceResult = {
  proof: Proof;
  owner: Address;
  avgBalance: bigint;
};

type GenericProveArgs = {
  // ya no mandamos address del contrato; usamos abiHash
  proverAbi: Abi;
  functionName: string;
  args?: ReadonlyArray<unknown>;
  chainId?: number;
};

type VLayerContextType = {
  isReady: boolean;
  userAddress?: Address;
  loading: boolean;
  error?: string;

  lastProof?: Hash;      // guardo el hash plano
  lastResult?: unknown;

  disconnect: () => Promise<void>;

  prove: (params: GenericProveArgs) => Promise<Hash>;
  waitForResult: (hash: Hash | string) => Promise<unknown>;

  proveAverageBalance: (owner?: Address) => Promise<AverageBalanceResult>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Context
const VLayerContext = createContext<VLayerContextType | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
export const VLayerProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { user, handleLogOut } = useDynamicContext();

  const [isReady, setIsReady] = useState(false);
  const [userAddress, setUserAddress] = useState<Address | undefined>();
  const [loading, setLoading] = useState(false);
  const [lastProof, setLastProof] = useState<Hash | undefined>();
  const [lastResult, setLastResult] = useState<unknown | undefined>();
  const [error, setError] = useState<string | undefined>();

  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const addr = user?.verifiedCredentials?.[0]?.address as Address | undefined;
    setUserAddress(addr);

    // listo si tengo chain id y abi hash
    setIsReady(Boolean(AVERAGE_BALANCE_ABI_HASH) && Number.isFinite(CHAIN_ID));

    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.verifiedCredentials]);

  const disconnect = useCallback(async () => {
    try {
      await handleLogOut();
    } catch {
      // noop
    } finally {
      if (!mounted.current) return;
      setUserAddress(undefined);
      setIsReady(Boolean(AVERAGE_BALANCE_ABI_HASH) && Number.isFinite(CHAIN_ID));
      setLastProof(undefined);
      setLastResult(undefined);
      setError(undefined);
      setLoading(false);
    }
  }, [handleLogOut]);

  // Hace prove y devuelve el hash plano
  const prove = useCallback(
    async (params: GenericProveArgs): Promise<Hash> => {
      const {
        proverAbi,
        functionName,
        args = [],
        chainId = CHAIN_ID,
      } = params;

      if (!functionName) throw new Error('functionName requerido');
      if (!proverAbi) throw new Error('proverAbi requerido');

      setLoading(true);
      setError(undefined);

      try {
        // NOTA: varios SDKs esperan 'abiHash' o 'programHash'.
        // Si el tuyo usa 'programHash', cambiá la key acá.
        const branded = await vlayerClient.prove<typeof AVERAGE_BALANCE_ABI, typeof functionName>({
          abiHash: AVERAGE_BALANCE_ABI_HASH,      // ⬅️ clave: branded hash del ABI
          proverAbi: proverAbi as unknown as Abi, // corta inferencia profunda
          functionName: functionName as any,      // evita branded del nombre
          args: args as readonly unknown[],       // readonly, sin spread
          chainId,
        } as any);

        // El retorno es BrandedHash<T,F>. Extraigo .hash y lo tipéo plano.
        const hash = (branded as { hash: Hash }).hash;
        setLastProof(hash);
        return hash;
      } catch (e: any) {
        const msg = e?.message ?? 'Error desconocido en vlayerClient.prove';
        setError(msg);
        throw e;
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [],
  );

  const waitForResult = useCallback(async (hash: Hash | string): Promise<unknown> => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await vlayerClient.waitForProvingResult({ hash: hash as any });
      setLastResult(result);
      return result;
    } catch (e: any) {
      const msg = e?.message ?? 'Error esperando el resultado de la prueba';
      setError(msg);
      throw e;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  // Caso concreto: averageBalanceOf(address)
  const proveAverageBalance = useCallback(
    async (owner?: Address): Promise<AverageBalanceResult> => {
      const target = (owner ?? userAddress) as Address | undefined;
      if (!target) throw new Error('No hay owner/address para calcular el average balance');

      const proofHash = await prove({
        proverAbi: AVERAGE_BALANCE_ABI,
        functionName: 'averageBalanceOf',
        args: [target] as const,   // tupla readonly evita inferencias raras
      });

      const result: any = await waitForResult(proofHash);
      const avg = BigInt(result?.[2] ?? 0n); // ajustá índice según tu backend

      return {
        proof: result,
        owner: target,
        avgBalance: avg,
      };
    },
    [prove, waitForResult, userAddress],
  );

  const value = useMemo<VLayerContextType>(
    () => ({
      isReady,
      userAddress,
      loading,
      error,
      lastProof,
      lastResult,
      disconnect,
      prove,
      waitForResult,
      proveAverageBalance,
    }),
    [
      isReady,
      userAddress,
      loading,
      error,
      lastProof,
      lastResult,
      disconnect,
      prove,
      waitForResult,
      proveAverageBalance,
    ],
  );

  return <VLayerContext.Provider value={value}>{children}</VLayerContext.Provider>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
export const useVLayer = () => {
  const ctx = useContext(VLayerContext);
  if (!ctx) throw new Error('useVLayer debe usarse dentro de <VLayerProvider>');
  return ctx;
};
