'use client'

import * as React from 'react'
import { Contract } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'

const SECONDS_PER_YEAR = 31_536_000

const EVAULT_PPS_ABI = [
  'function psJuniorRay() view returns (uint256)',
  'function debugPps() view returns (uint256 psSen, uint256 psJun)',
] as const

type Options = { pollMs?: number; minSampleSec?: number }

export function useJuniorYield({ pollMs = 30_000, minSampleSec = 10 }: Options = {}) {
  const { evault, evaultAddress } = useContracts()

  const [apr, setApr] = React.useState<number | null>(null)
  const [apy, setApy] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(false)
  const prevRef = React.useRef<{ pps: bigint; t: number } | null>(null)

  const runner = React.useMemo(
    () => (evault as any)?.runner ?? (evault as any)?.provider ?? null,
    [evault],
  )

  const readPpsRay = React.useCallback(async (): Promise<bigint | null> => {
    if (!evaultAddress || !runner) return null
    try {
      const v = new Contract(evaultAddress, EVAULT_PPS_ABI as any, runner)
      try {
        const out: any = await v.debugPps()
        return BigInt(out.psJun ?? out[1])
      } catch {
        const ps: bigint = await v.psJuniorRay()
        return ps
      }
    } catch {
      return null
    }
  }, [evaultAddress, runner])

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

      const SCALE = 1_000_000_000_000n
      const dScaled = (ps - prev.pps) * SCALE / prev.pps
      const ratio = Number(dScaled) / Number(SCALE)

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