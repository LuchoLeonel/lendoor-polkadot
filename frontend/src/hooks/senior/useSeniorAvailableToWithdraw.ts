'use client'

import * as React from 'react'
import { formatUnits } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'
import { DECIMALS_USDC } from '@/lib/utils' // UI precision (e.g., 4)

type Options = { pollMs?: number }

/**
 * Senior (sUSDC) withdrawable amount for the connected user.
 * Primary source: sUSDC.maxWithdraw(user) → underlying USDC (on-chain decimals).
 * If that returns 0, we diagnose using:
 *  - sUSDC.balanceOf(user) → shares
 *  - sUSDC.convertToAssets(shares) → theoretical assets
 *  - LendMarket.expectedBalances().liquidity → pool cash
 * Then we take soft = min(theoretical assets, cash) and label the reason.
 */
export function useSeniorAvailableToWithdraw({ pollMs = 30_000 }: Options = {}) {
  const { sUSDC, lendMarket, connectedAddress, usdcDecimals } = useContracts()
  const dec = usdcDecimals ?? 6

  const [rawUSDC, setRawUSDC] = React.useState<bigint | null>(null) // USDC in on-chain decimals (typically 6)
  const [uiAmount, setUiAmount] = React.useState<number | null>(null) // scaled for UI (DECIMALS_USDC)
  const [diagnosis, setDiagnosis] = React.useState<
    'ok' | 'no-liquidity' | 'no-balance' | 'controller-or-disabled' | 'unknown'
  >('unknown')
  const [loading, setLoading] = React.useState(false)

  // Scale raw on-chain assets → UI units using DECIMALS_USDC
  const toUi = React.useCallback(
    (raw: bigint): number | null => {
      try {
        const human = Number(formatUnits(raw, dec)) // e.g., 0.7022
        if (!Number.isFinite(human)) return null
        const scale = Math.pow(10, dec - DECIMALS_USDC) // e.g., 10^(6-4)=100
        return human * scale // e.g., 70.22
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
      // 1) Hard limit: max withdrawable in underlying assets
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

      // Pool liquidity from LendMarket if available
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
