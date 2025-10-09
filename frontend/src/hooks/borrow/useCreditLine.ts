'use client'

import * as React from 'react'
import { Contract } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'

const CLM_ABI = [
  'function scoreOf(address) view returns (uint8)',
  'function creditLimit(address) view returns (uint256)',
  'event LineSet(address indexed account, uint8 score, uint256 limit)',
  'event LineCleared(address indexed account)',
] as const

// Minimal RiskManager ABI — includes two common getter names for CLM
const RM_ABI = [
  'function creditLimitManager() view returns (address)',
  'function clm() view returns (address)',
] as const

// Minimal EVault ABI fragment to read user debt
const EVAULT_DEBT_ABI = [
  'function debtOf(address) view returns (uint256)',
] as const

type Options = {
  /** ms between reads; 0 disables polling */
  pollMs?: number
}

/** Format asset units (default 6 decimals) with NO fractional part, thousand separators. */
function formatUnits0(amount: bigint, decimals = 6): string {
  const base = 10n ** BigInt(decimals)
  const whole = amount / base // truncates toward zero
  const s = whole.toString()
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * Hook to read the user's credit line from the CLM and expose:
 * - scoreRaw: number | null           (0..255)
 * - scoreDisplay: string              ("—" | "123/255")
 * - limitRaw: bigint | null           (in asset base units)
 * - limitDisplay: string              ("—/—" | "X / Y USDC")  // borrowed / limit, no decimals
 * - borrowedRaw: bigint | null        (in asset base units)
 * - borrowedDisplay: string           ("—" | "X")
 */
export function useCreditLine({ pollMs = 15_000 }: Options = {}) {
  const { evault, evaultJunior, connectedAddress } = useContracts()

  const [clmAddress, setClmAddress] = React.useState<string | null>(null)

  const [scoreRaw, setScoreRaw] = React.useState<number | null>(null)
  const [scoreDisplay, setScoreDisplay] = React.useState<string>('—')

  const [limitRaw, setLimitRaw] = React.useState<bigint | null>(null)
  const [borrowedRaw, setBorrowedRaw] = React.useState<bigint | null>(null)

  const [limitDisplay, setLimitDisplay] = React.useState<string>('—/—')
  const [borrowedDisplay, setBorrowedDisplay] = React.useState<string>('—')

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reuse the runner (provider/signer) already configured in your contracts
  const runner =
    (evault as any)?.runner ??
    (evaultJunior as any)?.runner ??
    undefined

  // Resolve CLM address from EVault -> RiskManager
  const discoverClm = React.useCallback(async () => {
    try {
      if (!evault || !runner) {
        setClmAddress(null)
        return
      }

      // 1) Read RiskManager address from EVault
      const riskManagerAddr: string = await (evault as any).MODULE_RISKMANAGER()
      if (!riskManagerAddr || riskManagerAddr === '0x0000000000000000000000000000000000000000') {
        setClmAddress(null)
        return
      }

      // 2) Ask RiskManager for the CLM address (try common getter names)
      const rm = new Contract(riskManagerAddr, RM_ABI, runner)
      let addr: string | null = null
      try {
        addr = await rm.creditLimitManager()
      } catch {
        try {
          addr = await rm.clm()
        } catch {
          addr = null
        }
      }

      if (!addr || addr === '0x0000000000000000000000000000000000000000') {
        setClmAddress(null)
        return
      }

      setClmAddress(addr)
    } catch {
      setClmAddress(null)
    }
  }, [evault, runner])

  // Create CLM / EVault readers
  const clm = React.useMemo(() => {
    if (!runner || !clmAddress) return null
    return new Contract(clmAddress, CLM_ABI, runner)
  }, [runner, clmAddress])

  const evaultReader = React.useMemo(() => {
    if (!runner || !evault) return null
    // Use the evault address but ABI limited to debtOf()
    return new Contract((evault as any).target ?? (evault as any).address, EVAULT_DEBT_ABI, runner)
  }, [runner, evault])

  const read = React.useCallback(async () => {
    if (!connectedAddress) {
      setScoreRaw(null)
      setScoreDisplay('—/—')
      setLimitRaw(null)
      setBorrowedRaw(null)
      setBorrowedDisplay('—')
      setLimitDisplay('—/—')
      return
    }
    setLoading(true)
    setError(null)
    try {
      // Parallel reads (some may be null depending on discovery state)
      const [s, l, d] = await Promise.all([
        clm ? clm.scoreOf(connectedAddress) : Promise.resolve(null),
        clm ? clm.creditLimit(connectedAddress) : Promise.resolve(null),
        evaultReader ? evaultReader.debtOf(connectedAddress) : Promise.resolve(null),
      ])

      // Score
      const sNum = s !== null && s !== undefined ? Number(s) : null
      setScoreRaw(sNum)
      const sPretty = sNum === null ? '—' : `${sNum}/255`
      setScoreDisplay(prev => (prev === sPretty ? prev : sPretty))

      // Limit & Borrowed (asset units → integers, no decimals)
      const limitBig = (l ?? null) as bigint | null
      const borrowedBig = (d ?? null) as bigint | null
      setLimitRaw(limitBig)
      setBorrowedRaw(borrowedBig)

      const borrowedPretty = borrowedBig === null ? '—' : formatUnits0(borrowedBig, 6)
      const limitPretty = limitBig === null ? '—' : formatUnits0(limitBig, 6)

      setBorrowedDisplay(prev => (prev === borrowedPretty ? prev : borrowedPretty))
      const pair = `${borrowedPretty}/${limitPretty} USDC`
      setLimitDisplay(prev => (prev === pair ? prev : pair))
    } catch (e: any) {
      setError(e?.shortMessage || e?.reason || e?.message || 'read failed')
      setScoreRaw(null)
      setScoreDisplay('—/—')
      setLimitRaw(null)
      setBorrowedRaw(null)
      setBorrowedDisplay('—')
      setLimitDisplay('—/—')
    } finally {
      setLoading(false)
    }
  }, [clm, evaultReader, connectedAddress])

  // Discover CLM whenever evault/runner changes
  React.useEffect(() => {
    void discoverClm()
  }, [discoverClm])

  // First read + whenever dependencies change
  React.useEffect(() => {
    void read()
  }, [read, clm, evaultReader])

  // Optional polling
  React.useEffect(() => {
    if (!pollMs || pollMs <= 0) return
    const id = setInterval(() => void read(), pollMs)
    return () => clearInterval(id)
  }, [pollMs, read])

  // Refresh on CLM events
  React.useEffect(() => {
    if (!clm || !connectedAddress) return
    const onLineSet = (account: string) => {
      if (account?.toLowerCase() === connectedAddress.toLowerCase()) void read()
    }
    const onCleared = (account: string) => {
      if (account?.toLowerCase() === connectedAddress.toLowerCase()) void read()
    }
    clm.on('LineSet', onLineSet)
    clm.on('LineCleared', onCleared)
    return () => {
      clm.off('LineSet', onLineSet)
      clm.off('LineCleared', onCleared)
    }
  }, [clm, connectedAddress, read])

  return {
    clmAddress,
    scoreRaw,
    scoreDisplay,
    limitRaw,
    borrowedRaw,
    borrowedDisplay, 
    limitDisplay,
    loading,
    error,
    refresh: read,
  }
}
