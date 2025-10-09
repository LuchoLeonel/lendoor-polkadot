'use client'

import * as React from 'react'
import { Contract, formatUnits } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'
import { DECIMALS } from '@/lib/utils' // UI/demo precision (e.g. 4)

type Options = { pollMs?: number }

const EVAULT_ABI = [
  'function maxWithdraw(address) view returns (uint256)',     // assets (USDC, on-chain decimals)
  'function balanceOf(address) view returns (uint256)',       // senior shares (sUSDC)
  'function convertToAssets(uint256) view returns (uint256)', // shares -> USDC
  'function availableCashAssets() view returns (uint256)',    // pool reserves in USDC
] as const

export function useSeniorAvailableToWithdraw({ pollMs = 30_000 }: Options = {}) {
  const { evault, evaultAddress, connectedAddress, usdcDecimals } = useContracts()
  const dec = usdcDecimals ?? 6

  const [rawUSDC, setRawUSDC] = React.useState<bigint | null>(null)
  const [uiAmount, setUiAmount] = React.useState<number | null>(null)
  const [diagnosis, setDiagnosis] = React.useState<
    'ok' | 'no-liquidity' | 'no-balance' | 'controller-or-disabled' | 'unknown'
  >('unknown')
  const [loading, setLoading] = React.useState(false)

  // Re-scale raw (on-chain) assets to UI units using DECIMALS.
  const toUi = React.useCallback(
    (raw: bigint): number | null => {
      try {
        const human = Number(formatUnits(raw, dec))          // e.g., 0.7022
        if (!Number.isFinite(human)) return null
        const scale = Math.pow(10, dec - DECIMALS)           // e.g., 10^(6-4)=100
        return human * scale                                 // e.g., 70.22
      } catch {
        return null
      }
    },
    [dec],
  )

  const runner = React.useMemo(
    () => (evault as any)?.runner ?? (evault as any)?.provider ?? null,
    [evault],
  )

  const read = React.useCallback(async () => {
    if (!evaultAddress || !connectedAddress || !runner) return
    setLoading(true)
    try {
      const v = new Contract(evaultAddress, EVAULT_ABI as any, runner)

      // 1) Hard limit from the contract
      const max: bigint = await v.maxWithdraw(connectedAddress)
      if (max > 0n) {
        setRawUSDC(max)
        setUiAmount(toUi(max))
        setDiagnosis('ok')
        return
      }

      // 2) Diagnostics when hard limit is 0
      const shares: bigint = await v.balanceOf(connectedAddress)
      if (shares === 0n) {
        setRawUSDC(0n)
        setUiAmount(0)
        setDiagnosis('no-balance')
        return
      }

      const assetsFromShares: bigint = await v.convertToAssets(shares)
      const cash: bigint = await v.availableCashAssets()
      const soft = assetsFromShares < cash ? assetsFromShares : cash

      setRawUSDC(soft)
      setUiAmount(toUi(soft))
      if (cash === 0n) setDiagnosis('no-liquidity')
      else if (soft > 0n) setDiagnosis('controller-or-disabled')
      else setDiagnosis('unknown')
    } catch {
      setRawUSDC(0n)
      setUiAmount(0)
      setDiagnosis('unknown')
    } finally {
      setLoading(false)
    }
  }, [evaultAddress, connectedAddress, runner, toUi])

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
          maximumFractionDigits: DECIMALS,
        }).format(uiAmount)} USDC`

  return { rawUSDC, uiAmount, decimals: dec, display, loading, refresh: read, diagnosis }
}
