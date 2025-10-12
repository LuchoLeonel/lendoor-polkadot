'use client';

import * as React from 'react';
import { useContracts } from '@/providers/ContractsProvider';
import { DECIMALS_USDC } from '@/lib/utils'; // USDC UI decimals (e.g., 4)

type Result = {
  /** Underlying USDC in UI units (DECIMALS_USDC) */
  raw: bigint | null;
  /** sUSDC share balance (on-chain, 18 decimals) */
  shares: bigint | null;
  /** Human format (2dp) of USDC (scaled to DECIMALS_USDC) */
  display: string;
  loading: boolean;
  refresh: () => Promise<void>;
};

// Rescale bigint between decimals (e.g., 6 -> 4). Floors on downscale.
function scaleDecimals(value: bigint, fromDec: number, toDec: number): bigint {
  const f = BigInt(fromDec);
  const t = BigInt(toDec);
  if (t === f) return value;
  if (t > f) return value * 10n ** (t - f);
  return value / 10n ** (f - t);
}

// Round half-up to 2dp over arbitrary UI decimals
function format2dp(amount: bigint, decimals: number): string {
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const scaled = (abs * 100n + base / 2n) / base;
  const units = scaled / 100n;
  const frac = (scaled % 100n).toString().padStart(2, '0');
  return `${neg ? '-' : ''}${units.toString()}.${frac}`;
}

/**
 * sUSDC:
 *  - shares = balanceOf(user)               // 18
 *  - assets6 = convertToAssets(shares)      // USDC 6
 *  - raw = scaleDecimals(assets6, 6, DECIMALS_USDC)
 */
export function useSusdcBalance(pollMs = 10_000): Result {
  const { sUSDC, connectedAddress } = useContracts();

  const [shares, setShares] = React.useState<bigint | null>(null);
  const [raw, setRaw] = React.useState<bigint | null>(null); // USDC UI (DECIMALS_USDC)
  const [display, setDisplay] = React.useState<string>('—');
  const [loading, setLoading] = React.useState(false);

  const read = React.useCallback(async () => {
    if (!sUSDC || !connectedAddress) {
      setShares(null);
      setRaw(null);
      setDisplay('—');
      return;
    }

    setLoading(true);
    try {
      const balShares: bigint = await (sUSDC as any).balanceOf(connectedAddress);
      setShares(balShares);

      if (balShares === 0n) {
        setRaw(0n);
        setDisplay('0.00');
        return;
      }

      // Convert shares -> USDC(6)
      const assets6: bigint = await (sUSDC as any).convertToAssets(balShares);
      // USDC(6) -> USDC(UI)
      const assetsUi = scaleDecimals(assets6, 6, DECIMALS_USDC);
      setRaw(assetsUi);

      const pretty = assetsUi > 0n ? format2dp(assetsUi, DECIMALS_USDC) : '0.00';
      setDisplay(prev => (prev === pretty ? prev : pretty));
    } catch {
      setShares(null);
      setRaw(null);
      setDisplay('—');
    } finally {
      setLoading(false);
    }
  }, [sUSDC, connectedAddress]);

  React.useEffect(() => {
    void read();
    if (!pollMs) return;
    const id = setInterval(() => void read(), pollMs);
    return () => clearInterval(id);
  }, [read, pollMs]);

  return { raw, shares, display, loading, refresh: read };
}
