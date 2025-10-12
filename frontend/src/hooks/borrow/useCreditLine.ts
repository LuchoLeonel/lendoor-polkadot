'use client'

import * as React from 'react'
import { useContracts } from '@/providers/ContractsProvider'

type Options = {
  /** ms between reads; 0 disables polling */
  pollMs?: number
}

/** Format asset units (default 6 decimals) with NO fractional part, thousands separators. */
function formatUnits0(amount: bigint, decimals = 6): string {
  const base = 10n ** BigInt(decimals)
  const whole = amount / base // truncate toward zero
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * Reads the user's credit line from the CreditLimitManager and current debt from LendMarket.
 * Exposes:
 * - scoreRaw: number | null           (0..255)
 * - scoreDisplay: string              ("—" | "123/255")
 * - limitRaw: bigint | null           (asset base units, e.g., USDC 6)
 * - borrowedRaw: bigint | null        (asset base units)
 * - borrowedDisplay: string           ("—" | "X")
 * - limitDisplay: string              ("—/—" | "X / Y USDC")  // integers, no decimals
 */
export function useCreditLine({ pollMs = 15_000 }: Options = {}) {
  const {
    creditManager,
    lendMarket,
    connectedAddress,
    usdcDecimals,
  } = useContracts()

  const dec = usdcDecimals ?? 6

  const [scoreRaw, setScoreRaw] = React.useState<number | null>(null)
  const [scoreDisplay, setScoreDisplay] = React.useState<string>('—')

  const [limitRaw, setLimitRaw] = React.useState<bigint | null>(null)
  const [borrowedRaw, setBorrowedRaw] = React.useState<bigint | null>(null)

  const [limitDisplay, setLimitDisplay] = React.useState<string>('—/—')
  const [borrowedDisplay, setBorrowedDisplay] = React.useState<string>('—')

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const read = React.useCallback(async () => {
    if (!connectedAddress) {
      setScoreRaw(null)
      setScoreDisplay('—')
      setLimitRaw(null)
      setBorrowedRaw(null)
      setBorrowedDisplay('—')
      setLimitDisplay('—/—')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [s, l, d] = await Promise.all([
        creditManager ? (creditManager as any).scoreOf(connectedAddress) : Promise.resolve(null),
        creditManager ? (creditManager as any).creditLimit(connectedAddress) : Promise.resolve(null),
        lendMarket ? (lendMarket as any).positionOf(connectedAddress) : Promise.resolve(null),
      ])

      // Score
      const sNum = s !== null && s !== undefined ? Number(s) : null
      setScoreRaw(sNum)
      setScoreDisplay(sNum == null ? '—' : `${sNum}/255`)

      // Limit & Borrowed
      const limitBig = (l ?? null) as bigint | null
      const borrowedBig = (d ?? null) as bigint | null
      setLimitRaw(limitBig)
      setBorrowedRaw(borrowedBig)

      const borrowedPretty = borrowedBig == null ? '—' : formatUnits0(borrowedBig, dec)
      const limitPretty = limitBig == null ? '—' : formatUnits0(limitBig, dec)

      setBorrowedDisplay(borrowedPretty)
      setLimitDisplay(`${borrowedPretty}/${limitPretty} USDC`)
    } catch (e: any) {
      setError(e?.shortMessage || e?.reason || e?.message || 'read failed')
      setScoreRaw(null)
      setScoreDisplay('—')
      setLimitRaw(null)
      setBorrowedRaw(null)
      setBorrowedDisplay('—')
      setLimitDisplay('—/—')
    } finally {
      setLoading(false)
    }
  }, [creditManager, lendMarket, connectedAddress, dec])

  // First read + whenever deps change
  React.useEffect(() => {
    void read()
  }, [read])

  // Optional polling
  React.useEffect(() => {
    if (!pollMs || pollMs <= 0) return
    const id = setInterval(() => void read(), pollMs)
    return () => clearInterval(id)
  }, [pollMs, read])

  // Refresh on CLM limit changes
  React.useEffect(() => {
    if (!creditManager || !connectedAddress) return
    const clm = creditManager as any
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
  }, [creditManager, connectedAddress, read])

  // Also refresh on borrow/repay events from the market (best-effort)
  React.useEffect(() => {
    if (!lendMarket || !connectedAddress) return
    const m = lendMarket as any
    const onBorrowed = (borrower: string) => {
      if (borrower?.toLowerCase() === connectedAddress.toLowerCase()) void read()
    }
    const onRepaid = (_payer: string, onBehalfOf: string) => {
      if (onBehalfOf?.toLowerCase() === connectedAddress.toLowerCase()) void read()
    }
    try {
      m.on('Borrowed', onBorrowed)
      m.on('Repaid', onRepaid)
      return () => {
        m.off('Borrowed', onBorrowed)
        m.off('Repaid', onRepaid)
      }
    } catch {
      return
    }
  }, [lendMarket, connectedAddress, read])

  return {
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
