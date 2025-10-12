'use client'

import * as React from 'react'
import { Contract } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'

const ONE_RAY = 10n ** 27n
const SECONDS_PER_YEAR = 31_536_000

// IRM view ABI (RAY per-second)
const IIRM_ABI = [
  'function computeInterestRateView(address vault,uint256 u,uint256 r) view returns (uint256)',
] as const

type Options = {
  pollMs?: number
  minSampleSec?: number
}

type Result = {
  apr: number | null
  apy: number | null
  displayAPR: string
  displayAPY: string
  source: 'irm' | 'pps' | 'none'
  irmAddress: `0x${string}` | null
  loading: boolean
  refresh: () => Promise<void>
}

/** Pretty % formatter */
const fmtPct = (x: number | null) => (x == null ? '—' : `${(x * 100).toFixed(2)}%`)

/**
 * Senior yield (APR/APY) using the new contracts (sUSDC, LendMarket, IRM):
 * 1) Prefer **model rate**:
 *    - If LendMarket is available, use `lendMarket.interestRate()` (per-second WAD).
 *    - Otherwise, if we have an IRM address, call `computeInterestRateView` (RAY/sec) and convert.
 * 2) Fallback to **PPS delta** on sUSDC:
 *    - ppsRay = (USDC(6) per 1 sShare) * 1e27 / 1e6.
 *    - Sample pps over time to estimate rate.
 */
export function useSeniorYield({
  pollMs = 30_000,
  minSampleSec = 10,
}: Options = {}): Result {
  const { sUSDC, lendMarket, irmAddress: irmFromCtx, usdcDecimals } = useContracts()

  const [apr, setApr] = React.useState<number | null>(null)
  const [apy, setApy] = React.useState<number | null>(null)
  const [source, setSource] = React.useState<'irm' | 'pps' | 'none'>('none')
  const [irmAddress, setIrmAddress] = React.useState<`0x${string}` | null>(irmFromCtx ?? null)
  const [loading, setLoading] = React.useState(false)

  const prevRef = React.useRef<{ pps: bigint; t: number } | null>(null)

  // Runner/provider for read-only calls (prefer lendMarket, then sUSDC)
  const runner = React.useMemo(
    () =>
      ((lendMarket as any)?.runner ?? (lendMarket as any)?.provider ??
        (sUSDC as any)?.runner ?? (sUSDC as any)?.provider) || null,
    [lendMarket, sUSDC],
  )

  /** Discover IRM address from context or LendMarket. */
  const discoverIRM = React.useCallback(async (): Promise<`0x${string}` | null> => {
    if (irmFromCtx) return irmFromCtx
    try {
      if (lendMarket && (lendMarket as any).irm) {
        const addr: string = await (lendMarket as any).irm()
        if (addr && /^0x[0-9a-fA-F]{40}$/.test(addr) && addr !== '0x0000000000000000000000000000000000000000') {
          return addr as `0x${string}`
        }
      }
    } catch {
      /* no-op */
    }
    return null
  }, [lendMarket, irmFromCtx])

  /** Read per-second rate from LendMarket (WAD) if available. */
  const readRateFromMarket = React.useCallback(async (): Promise<boolean> => {
    try {
      if (!lendMarket || !(lendMarket as any).interestRate) return false
      const rateWad: bigint = await (lendMarket as any).interestRate() // per-second WAD
      if (!rateWad || rateWad === 0n) return false
      const rps = Number(rateWad) / 1e18
      const apr_ = rps * SECONDS_PER_YEAR
      const apy_ = Math.expm1(rps * SECONDS_PER_YEAR)
      setApr(apr_)
      setApy(apy_)
      setSource('irm') // model-derived (via market)
      return true
    } catch {
      return false
    }
  }, [lendMarket])

  /** Read per-second rate directly from IRM (RAY), if address known. */
  const readRateFromIRM = React.useCallback(async (irm: `0x${string}` | null): Promise<boolean> => {
    if (!irm || !runner || !lendMarket) return false
    try {
      const irmC = new Contract(irm, IIRM_ABI as any, runner)
      // For fixed IRM, u/r are ignored; for dynamic models, we could pass utilization,
      // but LendMarket already exposes interestRate(), so this is a secondary path.
      const rateRay: bigint = await (irmC as any).computeInterestRateView(
        (lendMarket as any).target ?? (lendMarket as any).address,
        0,
        0,
      )
      if (!rateRay || rateRay === 0n) return false
      const rps = Number(rateRay) / Number(ONE_RAY)
      const apr_ = rps * SECONDS_PER_YEAR
      const apy_ = Math.expm1(rps * SECONDS_PER_YEAR)
      setApr(apr_)
      setApy(apy_)
      setSource('irm')
      return true
    } catch {
      return false
    }
  }, [runner, lendMarket])

  /** Fallback: estimate from sUSDC PPS delta (RAY-scaled). */
  const readFromPpsDelta = React.useCallback(async (): Promise<boolean> => {
    if (!sUSDC) return false
    try {
      // 1 sShare in base units
      const sDec: number = Number(await (sUSDC as any).decimals()) // typically 18
      const oneShare = 10n ** BigInt(sDec)

      // Convert to underlying USDC (aDec, typically 6)
      const aDec = usdcDecimals ?? 6
      const assetsUSDC: bigint = await (sUSDC as any).convertToAssets(oneShare)

      // ppsRay = (USDC per sShare) scaled to 1e27
      const denom = 10n ** BigInt(aDec)
      if (denom === 0n) return false
      const pps = (assetsUSDC * ONE_RAY) / denom

      const now = Math.floor(Date.now() / 1000)
      const prev = prevRef.current
      prevRef.current = { pps, t: now }

      if (!prev || now <= prev.t) return false
      const dt = now - prev.t
      if (dt < minSampleSec || pps === prev.pps) return false

      // ratio = (pps / prev.pps) - 1
      const SCALE = 1_000_000_000_000n // 1e12 for precision
      const dScaled = ((pps - prev.pps) * SCALE) / prev.pps
      const ratio = Number(dScaled) / Number(SCALE)

      const rps = ratio / dt
      const apr_ = rps * SECONDS_PER_YEAR
      const apy_ = Math.expm1(rps * SECONDS_PER_YEAR)

      setApr(apr_)
      setApy(apy_)
      setSource('pps')
      return true
    } catch {
      return false
    }
  }, [sUSDC, usdcDecimals, minSampleSec])

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      // (1) Prefer direct market rate
      if (await readRateFromMarket()) return

      // (2) Try IRM view if we can discover it
      let irm = irmAddress
      if (!irm) {
        irm = await discoverIRM()
        setIrmAddress(irm)
      }
      if (await readRateFromIRM(irm)) return

      // (3) Fallback to PPS delta
      if (await readFromPpsDelta()) return

      setSource('none')
    } finally {
      setLoading(false)
    }
  }, [readRateFromMarket, irmAddress, discoverIRM, readRateFromIRM, readFromPpsDelta])

  React.useEffect(() => {
    void refresh()
    if (!pollMs) return
    const id = setInterval(() => void refresh(), pollMs)
    return () => clearInterval(id)
  }, [refresh, pollMs])

  return {
    apr,
    apy,
    displayAPR: fmtPct(apr),
    displayAPY: fmtPct(apy),
    source,
    irmAddress,
    loading,
    refresh,
  }
}
