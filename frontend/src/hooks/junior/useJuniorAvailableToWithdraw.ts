'use client'

import * as React from 'react'
import { Contract, formatUnits } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'
import { DECIMALS_4616 } from '@/lib/utils' // UI scale for ERC-4626 shares

const ERC20_DEC_ABI = ['function decimals() view returns (uint8)'] as const

type Options = { pollMs?: number }

/**
 * Reads the maximum sUSDC (assets) withdrawable from the junior vault (jUSDC),
 * then rescales that on-chain amount (typically 18 decimals) into UI units (DECIMALS_4616).
 *
 * jUSDC.maxWithdraw(owner) returns ASSETS (sUSDC), not j-shares.
 * - rawSShares: sUSDC amount in on-chain base units (usually 18)
 * - uiAmount:   human number scaled to DECIMALS_4616 for UI
 */
export function useJuniorAvailableToWithdraw({ pollMs = 30_000 }: Options = {}) {
  const { jUSDC, sUSDC, connectedAddress } = useContracts()

  const [rawSShares, setRawSShares] = React.useState<bigint | null>(null) // sUSDC assets (on-chain units)
  const [sDec, setSDec] = React.useState<number | null>(null)             // on-chain decimals of sUSDC
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

      // 2) Resolve on-chain decimals for sUSDC
      let onChainDec: number | null = null
      try {
        if (sUSDC) {
          onChainDec = Number(await (sUSDC as any).decimals())
        } else if (runner) {
          const assetAddr: string = await (jUSDC as any).asset()
          const token = new Contract(assetAddr, ERC20_DEC_ABI as any, runner)
          onChainDec = Number(await token.decimals())
        }
      } catch {
        onChainDec = null
      }
      setSDec(onChainDec)

      // 3) Compute UI amount (scale on-chain -> UI DECIMALS_4616)
      if (onChainDec != null) {
        // human = sOut / 10^onChainDec
        const humanStr = formatUnits(sOut, onChainDec)
        const humanNum = Number(humanStr)
        if (Number.isFinite(humanNum)) {
          // ui = human * 10^(onChainDec - DECIMALS_4616)
          const delta = onChainDec - DECIMALS_4616
          const scale = Math.pow(10, delta)
          setUiAmount(humanNum * scale)
        } else {
          setUiAmount(null)
        }
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

  // Display with UI precision (DECIMALS_4616) and token label
  const display =
    uiAmount == null
      ? '—'
      : `${new Intl.NumberFormat(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: DECIMALS_4616,
        }).format(uiAmount)} sUSDC`

  return { rawSShares, sDecimals: sDec, uiAmount, display, loading, refresh: read }
}
