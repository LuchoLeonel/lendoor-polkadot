'use client'

import * as React from 'react'
import { Contract, formatUnits } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'
import { DECIMALS_4616 } from '@/lib/utils' // UI scale for ERC-4626 shares

const ERC20_DEC_ABI = ['function decimals() view returns (uint8)'] as const

type Options = { pollMs?: number }

/** Safely rescale bigint between decimal systems (floors on downscale). */
function scaleDecimals(value: bigint, fromDec: number, toDec: number): bigint {
  const f = BigInt(fromDec)
  const t = BigInt(toDec)
  if (t === f) return value
  return t > f ? value * 10n ** (t - f) : value / 10n ** (f - t)
}

/**
 * Reads max sUSDC (assets) withdrawable from the junior vault (jUSDC),
 * then rescales on-chain amount (sUSDC decimals, usually 18) into UI units (DECIMALS_4616).
 *
 * jUSDC.maxWithdraw(owner) returns ASSETS (sUSDC), not j-shares.
 * - rawSShares: sUSDC amount in on-chain base units
 * - uiAmount:   human number scaled to DECIMALS_4616 for UI
 */
export function useJuniorAvailableToWithdraw({ pollMs = 30_000 }: Options = {}) {
  const { jUSDC, sUSDC, connectedAddress } = useContracts()

  const [rawSShares, setRawSShares] = React.useState<bigint | null>(null) // sUSDC assets (on-chain)
  const [sDec, setSDec] = React.useState<number | null>(null)             // sUSDC on-chain decimals
  const [uiAmount, setUiAmount] = React.useState<number | null>(null)     // scaled to UI (DECIMALS_4616)
  const [loading, setLoading] = React.useState(false)

  // Prefer jUSDC runner; fallback to provider
  const runner = React.useMemo(
    () => ((jUSDC as any)?.runner ?? (jUSDC as any)?.provider) || null,
    [jUSDC],
  )

  const read = React.useCallback(async () => {
    if (!jUSDC || !connectedAddress) return
    setLoading(true)
    try {
      // 1) Raw max withdraw in sUSDC assets (on-chain units)
      const sOut: bigint = await (jUSDC as any).maxWithdraw(connectedAddress)
      setRawSShares(sOut)

      // 2) sUSDC decimals (prefer direct call on the contract we already have)
      let onChainDec: number | null = null
      try {
        if (sUSDC) {
          onChainDec = Number(await (sUSDC as any).decimals())
        } else if (runner) {
          // Fallback: jUSDC.asset() → decimals()
          const assetAddr: string = await (jUSDC as any).asset()
          const token = new Contract(assetAddr, ERC20_DEC_ABI as any, runner)
          onChainDec = Number(await token.decimals())
        }
      } catch {
        onChainDec = null
      }
      setSDec(onChainDec)

      // 3) On-chain → UI (DECIMALS_4616)  ✅ no double scaling
      if (onChainDec != null) {
        // Convert bigint amount from on-chain decimals to UI decimals
        const uiBase: bigint = scaleDecimals(sOut, onChainDec, DECIMALS_4616)
        // To number for display
        const uiNum = Number(formatUnits(uiBase, DECIMALS_4616))
        setUiAmount(Number.isFinite(uiNum) ? uiNum : null)
      } else {
        setUiAmount(null)
      }
    } catch {
      setRawSShares(null)
      setSDec(null)
      setUiAmount(null)
    } finally {
      setLoading(false)
    }
  }, [jUSDC, sUSDC, connectedAddress, runner])

  React.useEffect(() => {
    void read()
    if (!pollMs) return
    const id = setInterval(() => void read(), pollMs)
    return () => clearInterval(id)
  }, [read, pollMs])

  // Display with UI precision (DECIMALS_4616) and the correct token label
  const display =
    uiAmount == null
      ? '—'
      : `${new Intl.NumberFormat(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: DECIMALS_4616,
        }).format(uiAmount)} sUSDC`

  return { rawSShares, sDecimals: sDec, uiAmount, display, loading, refresh: read }
}
