'use client'

import * as React from 'react'
import { Contract } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'

const EVAULT_ABI = [
  'function convertToAssets(uint256) view returns (uint256)',
  'function asset() view returns (address)',
  'function decimals() view returns (uint8)',
] as const

const ERC20_DEC_ABI = ['function decimals() view returns (uint8)'] as const

type Options = { pollMs?: number }

export function useSeniorExchangeRate({ pollMs = 30_000 }: Options = {}) {
  const { evault, evaultAddress, usdcDecimals } = useContracts()
  const [rate, setRate] = React.useState<number | null>(null) // USDC per 1 sUSDC
  const [loading, setLoading] = React.useState(false)

  const runner = React.useMemo(
    () => (evault as any)?.runner ?? (evault as any)?.provider ?? null,
    [evault],
  )

  const read = React.useCallback(async () => {
    if (!evaultAddress || !runner) return
    setLoading(true)
    try {
      // read sUSDC share decimals from the EVault token itself
      const v = new Contract(evaultAddress, EVAULT_ABI as any, runner)
      const sDec: number = Number(await v.decimals())

      // read USDC decimals (from provider cache if we already have them)
      let aDec = usdcDecimals ?? 6
      if (usdcDecimals == null) {
        const assetAddr: string = await v.asset()
        const token = new Contract(assetAddr, ERC20_DEC_ABI as any, runner)
        aDec = Number(await token.decimals())
      }

      const oneShare = 10n ** BigInt(sDec)          // 1.0 sUSDC in base units
      const assets: bigint = await v.convertToAssets(oneShare) // USDC base units

      // rate = assets / 10^aDec
      const r = Number(assets) / 10 ** aDec
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