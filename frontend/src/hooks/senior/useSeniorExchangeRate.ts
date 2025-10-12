'use client'

import * as React from 'react'
import { Contract } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'

const ERC20_DEC_ABI = ['function decimals() view returns (uint8)'] as const

type Options = { pollMs?: number }

/**
 * sUSDC/USDC -> display “1/<USDC per 1 sUSDC>”
 * Flow: 1 s-share -> sUSDC.convertToAssets -> USDC(underlying)
 */
export function useSeniorExchangeRate({ pollMs = 30_000 }: Options = {}) {
  const { sUSDC, usdcDecimals } = useContracts()
  const [rate, setRate] = React.useState<number | null>(null) // USDC per 1 sUSDC
  const [loading, setLoading] = React.useState(false)

  // Prefer runner if present (ethers v6), fallback to provider
  const runner = React.useMemo(
    () => ((sUSDC as any)?.runner ?? (sUSDC as any)?.provider) || null,
    [sUSDC],
  )

  const read = React.useCallback(async () => {
    if (!sUSDC) return
    setLoading(true)
    try {
      // sUSDC share decimals (typically 18)
      const sDec: number = Number(await (sUSDC as any).decimals())

      // USDC decimals: use from context if available; otherwise resolve from sUSDC.asset()
      let aDec = usdcDecimals ?? 6
      if (usdcDecimals == null && runner) {
        const assetAddr: string = await (sUSDC as any).asset()
        const token = new Contract(assetAddr, ERC20_DEC_ABI as any, runner)
        aDec = Number(await token.decimals())
      }

      // 1 sUSDC share in base units
      const oneShare = 10n ** BigInt(sDec)

      // Convert to underlying USDC (aDec, usually 6)
      const assetsUSDC: bigint = await (sUSDC as any).convertToAssets(oneShare)

      // Numeric USDC per 1 sUSDC
      const r = Number(assetsUSDC) / 10 ** aDec
      setRate(r)
    } catch {
      setRate(null)
    } finally {
      setLoading(false)
    }
  }, [sUSDC, runner, usdcDecimals])

  React.useEffect(() => {
    void read()
    if (!pollMs) return
    const id = setInterval(() => void read(), pollMs)
    return () => clearInterval(id)
  }, [read, pollMs])

  const display =
    rate == null ? '—' : `1/${new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(rate)}`

  return { rate, display, loading, refresh: read }
}
