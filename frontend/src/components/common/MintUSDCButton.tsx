'use client';

import * as React from 'react';
import { parseUnits } from 'ethers';
import { toast } from 'sonner';
import { useContracts } from '@/providers/ContractsProvider';
import { cn } from '@/lib/utils'; // opcional, para mergear className externo

// Fixed mint amount in UI units (e.g., "100")
const AMOUNT_UI = '100';

type Props = {
  endpoint?: string; // legacy
  className?: string;
  /** Optional: override min width in px (default 140) */
  minWidthPx?: number;
};

export default function MintUSDCButton({ className = '', minWidthPx = 140 }: Props) {
  const { usdc, usdcAddress, connectedAddress, refresh, usdcDecimals, chainId } = useContracts();
  const [loading, setLoading] = React.useState(false);

  const aDec = usdcDecimals ?? 6;
  const err = (e: any) => e?.shortMessage || e?.reason || e?.message || 'Transaction failed';

  const onClick = React.useCallback(async () => {
    if (!connectedAddress) {
      toast.error('Connect a wallet first');
      return;
    }
    if (!usdc || !usdcAddress) {
      toast.error('USDC contract not ready', { description: 'Missing contract or address.' });
      return;
    }

    setLoading(true);
    const t = toast.loading(`Minting ${AMOUNT_UI} USDC…`);
    try {
      const amount = parseUnits(AMOUNT_UI, aDec);

      let tx;
      try {
        tx = await (usdc as any).mintToSelf(amount);
      } catch {
        tx = await (usdc as any).mint(connectedAddress, amount);
      }

      const receipt = await tx.wait();
      const hash: string | undefined = receipt?.hash ?? tx?.hash;

      toast.success('Mint successful', {
        id: t,
        description: `Minted ${AMOUNT_UI} USDC${chainId ? ` on chain ${chainId}` : ''}`,
      });

      await refresh?.();
    } catch (e: any) {
      toast.error('Mint failed', { id: t, description: err(e) });
    } finally {
      setLoading(false);
    }
  }, [connectedAddress, usdc, usdcAddress, aDec, refresh, chainId]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!connectedAddress || !usdc || loading}
      style={{ minWidth: `${minWidthPx}px` }}
      className={cn(
        'inline-flex items-center justify-center',
        'h-9 px-3 rounded-md border border-primary/30 mono-text',
        'text-sm whitespace-nowrap',
        'bg-background hover:bg-primary/10',
        'disabled:opacity-50 transition-colors cursor-pointer',
        className,
      )}
      title={connectedAddress ? `Mint ${AMOUNT_UI} USDC` : 'Connect a wallet'}
    >
      {loading ? 'Minting…' : `Mint ${AMOUNT_UI} USDC`}
    </button>
  );
}
