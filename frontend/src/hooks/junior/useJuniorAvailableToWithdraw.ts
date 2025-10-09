'use client'

import * as React from 'react'
import { Contract, formatUnits } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'
import { DECIMALS } from '@/lib/utils' // your demo display precision (e.g. 4)

const JWRAP_ABI = [
  'function maxWithdraw(address owner) view returns (uint256)', // returns e-shares (sUSDC) in base units
  'function decimals() view returns (uint8)',                   // on-chain decimals of sUSDC (e-shares)
] as const

type Options = { pollMs?: number }

/**
 * Reads max e-shares (sUSDC) withdrawable from the junior wrapper,
 * scales to human using on-chain decimals, then rescale for UI with DECIMALS.
 * Example: on-chain 6, UI 4 → multiply by 10^(6-4)=100. So 0.2922 → 29.22.
 */
export function useJuniorAvailableToWithdraw({ pollMs = 30_000 }: Options = {}) {
  const { evault, evaultJuniorAddress, connectedAddress } = useContracts()

  const [rawSShares, setRawSShares] = React.useState<bigint | null>(null) // raw base units (on-chain)
  const [sDec, setSDec] = React.useState<number | null>(null)             // on-chain decimals
  const [uiAmount, setUiAmount] = React.useState<number | null>(null)     // rescaled for UI (DECIMALS)
  const [loading, setLoading] = React.useState(false)

  // Provider/runner for read-only calls
  const runner = React.useMemo(
    () => (evault as any)?.runner ?? (evault as any)?.provider ?? null,
    [evault],
  )

  const read = React.useCallback(async () => {
    if (!evaultJuniorAddress || !connectedAddress || !runner) return
    setLoading(true)
    try {
      const j = new Contract(evaultJuniorAddress, JWRAP_ABI as any, runner)

      // 1) Raw amount in base units (sUSDC e-shares)
      const sOut: bigint = await j.maxWithdraw(connectedAddress)
      setRawSShares(sOut)

      // 2) On-chain decimals for sUSDC (e-shares)
      const onChainDec = Number(await j.decimals())
      setSDec(onChainDec)

      // 3) Human (on-chain) units
      const humanStr = formatUnits(sOut, onChainDec)
      const humanNum = Number(humanStr)

      // 4) Rescale to UI decimals: multiply by 10^(onChainDec - DECIMALS)
      if (Number.isFinite(humanNum)) {
        const delta = onChainDec - DECIMALS
        const scale = Math.pow(10, delta)
        setUiAmount(humanNum * scale)
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
  }, [evaultJuniorAddress, connectedAddress, runner])

  React.useEffect(() => {
    void read()
    if (!pollMs) return
    const id = setInterval(() => void read(), pollMs)
    return () => clearInterval(id)
  }, [read, pollMs])

  // Display with your UI precision (DECIMALS) and the correct token label
  const display =
    uiAmount == null
      ? '—'
      : `${new Intl.NumberFormat(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: DECIMALS,
        }).format(uiAmount)} sUSDC`

  return { rawSShares, sDecimals: sDec, uiAmount, display, loading, refresh: read }
}
