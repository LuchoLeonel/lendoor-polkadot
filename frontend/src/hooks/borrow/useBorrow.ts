'use client'

import * as React from 'react'
import { parseUnits } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'
import { useCreditLine } from '@/hooks/borrow/useCreditLine'
import { DECIMALS_USDC } from '@/lib/utils'
import { toast } from 'sonner'

type Options = {} // no legacy controller anymore

const err = (e: any) => e?.shortMessage || e?.reason || e?.message || 'Transaction failed'

/** Truncate to whole units with thousands separators (based on provided decimals). */
function fmt0(amount: bigint, decimals = DECIMALS_USDC): string {
  const base = 10n ** BigInt(decimals)
  const whole = amount / base
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** e.g. "1_000" or "1,000.25" -> "1000.25" */
function cleanAmountInput(s: string): string {
  return s.replace(/[_,\s]/g, '')
}

/** Rescale bigint between decimal systems (floors on downscale). */
function scaleDecimals(value: bigint, fromDec: number, toDec: number): bigint {
  const f = BigInt(fromDec)
  const t = BigInt(toDec)
  if (t === f) return value
  if (t > f) return value * 10n ** (t - f)
  return value / 10n ** (f - t)
}

/**
 * Borrow USDC from the LendMarket:
 * - Capacity = max(limit - borrowed, 0)  (assumed in USDC(6) base units)
 * - Input amount is in **USDC UI units (DECIMALS_USDC)**, converted to USDC(6)
 * - Calls `lendMarket.borrow(assets6, receiver)`
 * - Uses toast-based UX (no throws)
 */
export function useBorrow({}: Options = {}) {
  const { lendMarket, connectedAddress, refresh, usdcDecimals } = useContracts()
  const aDec = usdcDecimals ?? 6 // on-chain USDC decimals (typically 6)

  // From your hook: assumed to be in USDC on-chain base units (6)
  const { limitRaw, borrowedRaw } = useCreditLine({ pollMs: 15_000 })

  const [submitting, setSubmitting] = React.useState(false)

  // Capacity in base units (on-chain, 6)
  const maxBorrowRaw: bigint | null = React.useMemo(() => {
    if (limitRaw == null || borrowedRaw == null) return null
    const cap = limitRaw - borrowedRaw
    return cap > 0n ? cap : 0n
  }, [limitRaw, borrowedRaw])

  // Display capacity using UI decimals
  const maxBorrowDisplay: string = React.useMemo(() => {
    if (maxBorrowRaw == null) return '—'
    const capUi = scaleDecimals(maxBorrowRaw, aDec, DECIMALS_USDC)
    return `${fmt0(capUi, DECIMALS_USDC)} USDC`
  }, [maxBorrowRaw, aDec])

  /** Client-side validation for a user-entered amount (USDC UI units). */
  const validateAmount = React.useCallback(
    (amountInput: string) => {
      const cleaned = cleanAmountInput(amountInput || '')
      if (!cleaned) return { ok: false, reason: 'Enter an amount.' as const }

      let uiBase: bigint
      try {
        uiBase = parseUnits(cleaned, DECIMALS_USDC) // UI → UI base bigint
      } catch {
        return { ok: false, reason: 'Invalid amount.' as const }
      }
      if (uiBase <= 0n) return { ok: false, reason: 'Amount must be greater than 0.' as const }

      const amount6 = scaleDecimals(uiBase, DECIMALS_USDC, aDec) // UI → 6
      if (maxBorrowRaw != null && amount6 > maxBorrowRaw) {
        return { ok: false, reason: 'Amount exceeds your available capacity.' as const }
      }
      return { ok: true as const, reason: null as null, amount6 }
    },
    [aDec, maxBorrowRaw],
  )

  /** Convenience flag for UIs: does this string exceed capacity? */
  const checkExceeds = React.useCallback(
    (amountInput: string) => {
      const cleaned = cleanAmountInput(amountInput || '')
      try {
        const uiBase = parseUnits(cleaned || '0', DECIMALS_USDC)
        const amount6 = scaleDecimals(uiBase, DECIMALS_USDC, aDec)
        return maxBorrowRaw != null && amount6 > maxBorrowRaw
      } catch {
        return false
      }
    },
    [aDec, maxBorrowRaw],
  )

  const submit = React.useCallback(
    async (amountInput: string) => {
      if (!lendMarket || !connectedAddress) {
        toast.error('Missing setup', {
          description: 'Market contract or address is not ready.',
        })
        return false
      }

      const { ok, reason, amount6 } = validateAmount(amountInput)
      if (!ok || amount6 == null) {
        toast.error('Invalid amount', { description: reason || 'Please check the value.' })
        return false
      }

      setSubmitting(true)
      const tLoading = toast.loading('Submitting borrow…')

      try {
        // Borrow in USDC(6)
        const tx = await (lendMarket as any).borrow(amount6, connectedAddress)
        await tx.wait()

        toast.success('Borrow confirmed', {
          description: 'Funds have been transferred to your wallet.',
        })

        await refresh?.() // refresh debt/limits/balances
        return true
      } catch (e: any) {
        toast.error('Borrow failed', { description: err(e) })
        return false
      } finally {
        toast.dismiss(tLoading)
        setSubmitting(false)
      }
    },
    [lendMarket, connectedAddress, validateAmount, refresh],
  )

  return {
    limitRaw,
    borrowedRaw,
    maxBorrowRaw,

    maxBorrowDisplay,
    exceedsCapacity: checkExceeds,
    validateAmount,
    canSubmit: (amountStr: string) => validateAmount(amountStr).ok,

    submit,
    submitting,
  }
}
