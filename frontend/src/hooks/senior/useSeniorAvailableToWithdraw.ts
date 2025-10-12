'use client'

import * as React from 'react'
import { formatUnits } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'
import { DECIMALS_USDC } from '@/lib/utils' // UI precision (e.g., 4)

type Options = { pollMs?: number }

/** Safely rescale bigint between decimal systems (floors on downscale). */
function scaleDecimals(value: bigint, fromDec: number, toDec: number): bigint {
  const f = BigInt(fromDec)
  const t = BigInt(toDec)
  if (t === f) return value
  return t > f ? value * 10n ** (t - f) : value / 10n ** (f - t)
}

/**
 * Senior (sUSDC) withdrawable amount for the connected user.
 * Primary source: sUSDC.maxWithdraw(user) → underlying USDC (on-chain decimals, usually 6).
 * If that returns 0, we diagnose using:
 *  - sUSDC.balanceOf(user) → shares
 *  - sUSDC.convertToAssets(shares) → theoretical assets
 *  - LendMarket.expectedBalances().liquidity → pool cash
 * Then we take soft = min(theoretical assets, cash) and label the reason.
 */
export function useSeniorAvailableToWithdraw({ pollMs = 30_000 }: Options = {}) {
  const { sUSDC, lendMarket, connectedAddress, usdcDecimals } = useContracts()
  const dec = usdcDecimals ?? 6 // on-chain USDC decimals

  const [rawUSDC, setRawUSDC] = React.useState<bigint | null>(null) // USDC on-chain (dec)
  const [uiAmount, setUiAmount] = React.useState<number | null>(null) // USDC UI (DECIMALS_USDC)
  const [diagnosis, setDiagnosis] = React.useState<
    'ok' | 'no-liquidity' | 'no-balance' | 'controller-or-disabled' | 'unknown'
  >('unknown')
  const [loading, setLoading] = React.useState(false)

  // On-chain -> UI (single rescale using bigint; then to number for display)
  const toUi = React.useCallback(
    (raw: bigint): number | null => {
      try {
        const uiBase = scaleDecimals(raw, dec, DECIMALS_USDC)
        const asNum = Number(formatUnits(uiBase, DECIMALS_USDC))
        return Number.isFinite(asNum) ? asNum : null
      } catch {
        return null
      }
    },
    [dec],
  )

  const read = React.useCallback(async () => {
    if (!sUSDC || !connectedAddress) return
    setLoading(true)
    try {
      // 1) Hard limit in underlying assets
      const max: bigint = await (sUSDC as any).maxWithdraw(connectedAddress)
      if (max > 0n) {
        setRawUSDC(max)
        setUiAmount(toUi(max))
        setDiagnosis('ok')
        return
      }

      // 2) Fallback diagnostics
      const shares: bigint = await (sUSDC as any).balanceOf(connectedAddress)
      if (shares === 0n) {
        setRawUSDC(0n)
        setUiAmount(0)
        setDiagnosis('no-balance')
        return
      }

      const assetsFromShares: bigint = await (sUSDC as any).convertToAssets(shares)

      // Pool liquidity from LendMarket (also in asset units)
      let cash: bigint | null = null
      try {
        if (lendMarket) {
          const [, , liq]: [bigint, bigint, bigint] = await (lendMarket as any).expectedBalances()
          cash = liq
        }
      } catch {
        cash = null
      }

      const soft = cash == null ? assetsFromShares : (assetsFromShares < cash ? assetsFromShares : cash)

      setRawUSDC(soft)
      setUiAmount(toUi(soft))
      if (cash === 0n) setDiagnosis('no-liquidity')
      else if (soft > 0n && max === 0n) setDiagnosis('controller-or-disabled')
      else setDiagnosis('unknown')
    } catch {
      setRawUSDC(0n)
      setUiAmount(0)
      setDiagnosis('unknown')
    } finally {
      setLoading(false)
    }
  }, [sUSDC, lendMarket, connectedAddress, toUi])

  React.useEffect(() => {
    void read()
    if (!pollMs) return
    const id = setInterval(() => void read(), pollMs)
    return () => clearInterval(id)
  }, [read, pollMs])

  const display =
    uiAmount == null
      ? '—'
      : `${new Intl.NumberFormat(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: DECIMALS_USDC,
        }).format(uiAmount)} USDC`

  return { rawUSDC, uiAmount, decimals: dec, display, loading, refresh: read, diagnosis }
}
