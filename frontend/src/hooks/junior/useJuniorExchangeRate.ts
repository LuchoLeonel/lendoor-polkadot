'use client'

import * as React from 'react'
import { Contract } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'

const ERC20_DEC_ABI = ['function decimals() view returns (uint8)'] as const

type Options = { pollMs?: number }

/**
 * jUSDC/USDC -> display “1/<USDC per 1 jUSDC>”
 * Flow: 1 j-share -> jUSDC.convertToAssets -> s-shares -> sUSDC.convertToAssets -> USDC(6)
 */
export function useJuniorExchangeRate({ pollMs = 30_000 }: Options = {}) {
  const { jUSDC, sUSDC, usdcDecimals } = useContracts()
  const [rate, setRate] = React.useState<number | null>(null) // USDC per 1 jUSDC
  const [loading, setLoading] = React.useState(false)

  // Prefer jUSDC runner/provider; fallback to sUSDC
  const runner = React.useMemo(
    () =>
      ((jUSDC as any)?.runner ?? (jUSDC as any)?.provider ??
        (sUSDC as any)?.runner ?? (sUSDC as any)?.provider) || null,
    [jUSDC, sUSDC],
  )

  const read = React.useCallback(async () => {
    if (!jUSDC || !sUSDC) return
    setLoading(true)
    try {
      // jUSDC share decimals (typically 18)
      const jDec: number = Number(await (jUSDC as any).decimals())

      // USDC decimals: use from context if available; otherwise read from sUSDC.asset()
      let aDec = usdcDecimals ?? 6
      if (usdcDecimals == null && runner) {
        const usdcAddr: string = await (sUSDC as any).asset()
        const token = new Contract(usdcAddr, ERC20_DEC_ABI, runner)
        aDec = Number(await token.decimals())
      }

      // 1 jUSDC share -> sUSDC shares
      const oneJ = 10n ** BigInt(jDec)
      const sShares: bigint = await (jUSDC as any).convertToAssets(oneJ)

      // sUSDC shares -> USDC (aDec, usually 6)
      const assetsUSDC: bigint = await (sUSDC as any).convertToAssets(sShares)

      // USDC per 1 jUSDC (human-readable number)
      const r = Number(assetsUSDC) / 10 ** aDec
      setRate(r)
    } catch {
      setRate(null)
    } finally {
      setLoading(false)
    }
  }, [jUSDC, sUSDC, runner, usdcDecimals])

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
