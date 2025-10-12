'use client'

import * as React from 'react'
import { useContracts } from '@/providers/ContractsProvider'

const SECONDS_PER_YEAR = 31_536_000

type Options = { pollMs?: number; minSampleSec?: number }

/**
 * Junior yield (APR/APY) derived from jUSDC price-per-share in **USDC units**.
 *
 * PPS definition used here:
 *   ppsRay = (USDC per 1 jUSDC) scaled to RAY (1e27)
 * where:
 *   sShares  = jUSDC.convertToAssets(1 jShare)          // j -> s shares
 *   usdcBase = sUSDC.convertToAssets(sShares)           // s shares -> USDC (aDec)
 *   ppsRay   = usdcBase * 1e27 / 10^aDec
 *
 * Then we sample ppsRay over time and compute:
 *   ratio = (ppsNow - ppsPrev) / ppsPrev
 *   rps   = ratio / dt
 *   APR   = rps * secondsPerYear
 *   APY   = expm1(rps * secondsPerYear)
 */
export function useJuniorYield({ pollMs = 30_000, minSampleSec = 10 }: Options = {}) {
  const { jUSDC, sUSDC, usdcDecimals } = useContracts()

  const [apr, setApr] = React.useState<number | null>(null)
  const [apy, setApy] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(false)
  const prevRef = React.useRef<{ pps: bigint; t: number } | null>(null)

  const readPpsRay = React.useCallback(async (): Promise<bigint | null> => {
    if (!jUSDC || !sUSDC) return null
    try {
      // j share decimals (usually 18)
      const jDec: number = Number(await (jUSDC as any).decimals())
      const oneJ = 10n ** BigInt(jDec)

      // j -> s shares
      const sShares: bigint = await (jUSDC as any).convertToAssets(oneJ)

      // s shares -> USDC (aDec, typically 6)
      const aDec = usdcDecimals ?? 6
      const usdcBase: bigint = await (sUSDC as any).convertToAssets(sShares)

      // pps in USDC, scaled to RAY (1e27)
      const scaleRay = 1_000_000_000_000_000_000_000_000_000n // 1e27
      const denom = 10n ** BigInt(aDec)
      if (denom === 0n) return null
      const ppsRay = (usdcBase * scaleRay) / denom
      return ppsRay
    } catch {
      return null
    }
  }, [jUSDC, sUSDC, usdcDecimals])

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const ps = await readPpsRay()
      if (ps == null || ps === 0n) return

      const now = Math.floor(Date.now() / 1000)
      const prev = prevRef.current
      prevRef.current = { pps: ps, t: now }
      if (!prev || now <= prev.t) return

      const dt = now - prev.t
      if (dt < minSampleSec || ps === prev.pps) return

      // Compute fractional change with high-precision integer math
      const SCALE = 1_000_000_000_000n // 1e12 scaling for ratio precision
      const dScaled = ((ps - prev.pps) * SCALE) / prev.pps
      const ratio = Number(dScaled) / Number(SCALE) // dimensionless Δpps/pps

      const rps = ratio / dt
      const apr_ = rps * SECONDS_PER_YEAR
      const apy_ = Math.expm1(rps * SECONDS_PER_YEAR)

      setApr(apr_)
      setApy(apy_)
    } finally {
      setLoading(false)
    }
  }, [readPpsRay, minSampleSec])

  React.useEffect(() => {
    void refresh()
    if (!pollMs) return
    const id = setInterval(() => void refresh(), pollMs)
    return () => clearInterval(id)
  }, [refresh, pollMs])

  const fmt = (x: number | null) => (x == null ? '—' : `${(x * 100).toFixed(2)}%`)

  return { apr, apy, displayAPR: fmt(apr), displayAPY: fmt(apy), loading, refresh }
}
