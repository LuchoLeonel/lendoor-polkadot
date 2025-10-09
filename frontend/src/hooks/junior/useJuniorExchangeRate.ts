'use client'

import * as React from 'react'
import { Contract } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'

const ABI = [
  'function decimals() view returns (uint8)',
  'function asset() view returns (address)',
  'function convertToJuniorAssets(uint256) view returns (uint256)',
] as const

const ERC20_DEC_ABI = ['function decimals() view returns (uint8)'] as const

type Options = { pollMs?: number }

/** jUSDC/USDC -> display "1/<USDC per 1 jUSDC>" (mismo estilo que sUSDC/USDC) */
export function useJuniorExchangeRate({ pollMs = 30_000 }: Options = {}) {
  const { evault, evaultAddress, usdcDecimals } = useContracts()
  const [rate, setRate] = React.useState<number | null>(null) // USDC per 1 jUSDC
  const [loading, setLoading] = React.useState(false)

  const runner = React.useMemo(
    () => (evault as any)?.runner ?? (evault as any)?.provider ?? null,
    [evault],
  )

  const read = React.useCallback(async () => {
    if (!evaultAddress || !runner) return
    setLoading(true)
    try {
      const v = new Contract(evaultAddress, ABI as any, runner)

      // j-share decimals (son los mismos que el eToken)
      const jDec: number = Number(await v.decimals())

      // USDC decimals (usa los del provider si ya los tenemos)
      let aDec = usdcDecimals ?? 6
      if (usdcDecimals == null) {
        const assetAddr: string = await v.asset()
        const token = new Contract(assetAddr, ERC20_DEC_ABI as any, runner)
        aDec = Number(await token.decimals())
      }

      // 1 jUSDC en base units -> USDC base units
      const oneJ = 10n ** BigInt(jDec)
      const assetsUSDC: bigint = await v.convertToJuniorAssets(oneJ)

      // USDC per 1 jUSDC
      const r = Number(assetsUSDC) / 10 ** aDec
      setRate(r)
    } catch {
      setRate(null)
    } finally {
      setLoading(false)
    }
  }, [evaultAddress, runner, usdcDecimals])

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
