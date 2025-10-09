'use client'

import * as React from 'react'
import { Contract } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'

const ONE_RAY = 10n ** 27n
const SECONDS_PER_YEAR = 31_536_000

// EVault: senior PPS
const EVAULT_PPS_ABI = [
  'function psSeniorRay() view returns (uint256)',
  'function debugPps() view returns (uint256 psSen, uint256 psJun)',
] as const

// EVault: posibles getters de la IRM (probamos en orden)
const EVAULT_IRM_ABI = [
  'function interestRateModel() view returns (address)',
  'function irm() view returns (address)',
  'function IRM() view returns (address)',
  // a veces la integración viene en un struct público (tuple)
  'function integrations() view returns (address evc,address irm,address oracle,address riskManager)',
] as const

// IRM: API view
const IIRM_ABI = [
  'function computeInterestRateView(address vault,uint256 cash,uint256 borrows) view returns (uint256)',
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

/** Format % nicely */
const fmtPct = (x: number | null) => (x == null ? '—' : `${(x * 100).toFixed(2)}%`)

/** Defensive check */
const isZeroAddr = (a?: string) =>
  !a || a === '0x0000000000000000000000000000000000000000'

export function useSeniorYield({
  pollMs = 30_000,
  minSampleSec = 10,
}: Options = {}): Result {
  const { evault, evaultAddress } = useContracts()

  const [apr, setApr] = React.useState<number | null>(null)
  const [apy, setApy] = React.useState<number | null>(null)
  const [source, setSource] = React.useState<'irm' | 'pps' | 'none'>('none')
  const [irmAddress, setIrmAddress] = React.useState<`0x${string}` | null>(null)
  const [loading, setLoading] = React.useState(false)

  const prevRef = React.useRef<{ pps: bigint; t: number } | null>(null)

  const getRunner = React.useCallback(() => {
    return (evault as any)?.runner ?? (evault as any)?.provider ?? null
  }, [evault])

  /** Try multiple common getters on the EVault to discover IRM address */
  const discoverIRM = React.useCallback(async (): Promise<`0x${string}` | null> => {
    if (!evaultAddress) return null
    const runner = getRunner()
    if (!runner) return null

    const v = new Contract(evaultAddress, EVAULT_IRM_ABI as any, runner)

    // Try interestRateModel()
    try {
      const a: string = await (v as any).interestRateModel()
      if (!isZeroAddr(a)) return a as `0x${string}`
    } catch {}

    // Try irm()
    try {
      const a: string = await (v as any).irm()
      if (!isZeroAddr(a)) return a as `0x${string}`
    } catch {}

    // Try IRM()
    try {
      const a: string = await (v as any).IRM()
      if (!isZeroAddr(a)) return a as `0x${string}`
    } catch {}

    // Try integrations() -> tuple where the 2nd is irm
    try {
      const out: any = await (v as any).integrations()
      const a: string = out?.irm ?? out?.[1]
      if (!isZeroAddr(a)) return a as `0x${string}`
    } catch {}

    return null
  }, [evaultAddress, getRunner])

  /** Read senior PPS (RAY) */
  const readPpsRay = React.useCallback(async (): Promise<bigint | null> => {
    if (!evaultAddress) return null
    try {
      const runner = getRunner()
      if (!runner) return null
      const v = new Contract(evaultAddress, EVAULT_PPS_ABI as any, runner)

      try {
        const out: any = await (v as any).debugPps()
        return BigInt(out.psSen ?? out[0])
      } catch {
        const ps: bigint = await (v as any).psSeniorRay()
        return ps
      }
    } catch {
      return null
    }
  }, [evaultAddress, getRunner])

  /** Prefer IMR if we can discover it */
  const readFromIRM = React.useCallback(
    async (irm: `0x${string}` | null): Promise<boolean> => {
      if (!irm || !evaultAddress) return false
      try {
        const runner = getRunner()
        if (!runner) return false
        const irmC = new Contract(irm, IIRM_ABI as any, runner)
        const rateRay: bigint = await (irmC as any).computeInterestRateView(evaultAddress, 0, 0)
        if (!rateRay || rateRay === 0n) return false

        const rps = Number(rateRay) / Number(ONE_RAY) // per second
        const apr_ = rps * SECONDS_PER_YEAR
        const apy_ = Math.expm1(rps * SECONDS_PER_YEAR)

        setApr(apr_)
        setApy(apy_)
        setSource('irm')
        return true
      } catch {
        return false
      }
    },
    [evaultAddress, getRunner]
  )

  /** Fallback: estimate from PPS delta */
  const readFromPpsDelta = React.useCallback(async (): Promise<boolean> => {
    const ps = await readPpsRay()
    if (ps == null || ps === 0n) return false

    const now = Math.floor(Date.now() / 1000)
    const prev = prevRef.current
    prevRef.current = { pps: ps, t: now }

    if (!prev || now <= prev.t) return false
    const dt = now - prev.t
    if (dt < minSampleSec) return false
    if (ps === prev.pps) return false

    // ratio = (ps / prev.pps) - 1
    const SCALE = 1_000_000_000_000n
    const dScaled = (ps - prev.pps) * SCALE / prev.pps
    const ratio = Number(dScaled) / Number(SCALE)

    const rps = ratio / dt
    const apr_ = rps * SECONDS_PER_YEAR
    const apy_ = Math.expm1(rps * SECONDS_PER_YEAR)

    setApr(apr_)
    setApy(apy_)
    setSource('pps')
    return true
  }, [minSampleSec, readPpsRay])

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      // (1) discover irm once (or refresh if evault changes)
      let irm = irmAddress
      if (!irm) {
        irm = await discoverIRM()
        setIrmAddress(irm)
      }

      // (2) prefer irm path; otherwise use PPS
      if (await readFromIRM(irm)) return
      if (await readFromPpsDelta()) return
      setSource('none')
    } finally {
      setLoading(false)
    }
  }, [irmAddress, discoverIRM, readFromIRM, readFromPpsDelta])

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
