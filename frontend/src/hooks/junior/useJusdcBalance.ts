'use client';

import * as React from 'react';
import { useContracts } from '@/providers/ContractsProvider';
import { DECIMALS_USDC, DECIMALS_4616 } from '@/lib/utils'; // exportadas por vos

type Result = {
  /** USDC en UI units (DECIMALS_USDC) */
  raw: bigint | null;
  /** jUSDC shares on-chain (18) */
  jShares: bigint | null;
  /** sUSDC shares on-chain (18) */
  sShares: bigint | null;
  /** USDC formateado a 2dp (sobre DECIMALS_USDC) */
  display: string;
  loading: boolean;
  refresh: () => Promise<void>;
};

// rescale between decimals (e.g., 6 -> 4). Redondea hacia abajo si reduce.
function scaleDecimals(value: bigint, fromDec: number, toDec: number): bigint {
  const f = BigInt(fromDec);
  const t = BigInt(toDec);
  if (t === f) return value;
  if (t > f) return value * 10n ** (t - f);
  return value / 10n ** (f - t);
}

// 2dp rounding sobre cualquier base de decimales (UI)
function format2dp(amount: bigint, decimals: number): string {
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const scaled = (abs * 100n + base / 2n) / base; // round half up
  const units = scaled / 100n;
  const frac = (scaled % 100n).toString().padStart(2, '0');
  return `${neg ? '-' : ''}${units.toString()}.${frac}`;
}

/**
 * jUSDC → sUSDC → USDC(6) → USDC(UI: DECIMALS_USDC)
 */
export function useJusdcBalance(pollMs = 10_000): Result {
  const { jUSDC, sUSDC, connectedAddress } = useContracts();

  const [jShares, setJShares] = React.useState<bigint | null>(null);   // 18
  const [sShares, setSShares] = React.useState<bigint | null>(null);   // 18
  const [raw, setRaw] = React.useState<bigint | null>(null);           // USDC UI (DECIMALS_USDC)
  const [display, setDisplay] = React.useState('—');
  const [loading, setLoading] = React.useState(false);

  const read = React.useCallback(async () => {
    if (!jUSDC || !sUSDC || !connectedAddress) {
      setJShares(null);
      setSShares(null);
      setRaw(null);
      setDisplay('—');
      return;
    }

    setLoading(true);
    try {
      // 1) jUSDC shares (18)
      const balJ: bigint = await (jUSDC as any).balanceOf(connectedAddress);
      setJShares(balJ);

      if (balJ === 0n) {
        setSShares(0n);
        setRaw(0n);
        setDisplay('0.00');
        return;
      }

      // 2) j → s (18)
      const sFromJ: bigint = await (jUSDC as any).convertToAssets(balJ);
      setSShares(sFromJ);

      // 3) s → USDC (6 on-chain)
      const usdc6: bigint = await (sUSDC as any).convertToAssets(sFromJ);

      // 4) USDC(6) → USDC(UI: DECIMALS_USDC)
      const usdcUi: bigint = scaleDecimals(usdc6, 6, DECIMALS_USDC);
      setRaw(usdcUi);

      const pretty = usdcUi > 0n ? format2dp(usdcUi, DECIMALS_USDC) : '0.00';
      setDisplay(prev => (prev === pretty ? prev : pretty));
    } catch {
      setJShares(null);
      setSShares(null);
      setRaw(null);
      setDisplay('—');
    } finally {
      setLoading(false);
    }
  }, [jUSDC, sUSDC, connectedAddress]);

  React.useEffect(() => {
    void read();
    if (!pollMs) return;
    const id = setInterval(() => void read(), pollMs);
    return () => clearInterval(id);
  }, [read, pollMs]);

  return { raw, jShares, sShares, display, loading, refresh: read };
}
