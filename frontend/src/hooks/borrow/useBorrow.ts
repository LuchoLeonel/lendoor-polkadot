'use client'

import * as React from 'react'
import { parseUnits } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'
import { useCreditLine } from '@/hooks/borrow/useCreditLine'
import { DECIMALS } from '@/lib/utils'
import { toast } from 'sonner'

type Options = {
  /** If true, will attempt to enable controller before borrowing (default: true). */
  requireController?: boolean
}

const err = (e: any) => e?.shortMessage || e?.reason || e?.message || 'Transaction failed'

/** Integer formatter (truncate decimals) with thousands separators. */
function fmt0(amount: bigint, decimals = 6): string {
  const base = 10n ** BigInt(decimals)
  const whole = amount / base
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** sanitize input like "1_000" or "1,000.25" -> "1000.25" */
function cleanAmountInput(s: string): string {
  return s.replace(/[_,\s]/g, '')
}

/**
 * useBorrow (toast-based UX)
 * - Computes capacity = max(limit - borrowed, 0)
 * - Validates user amount vs capacity
 * - (Optionally) enables controller on EVC for the user & this vault
 * - Calls evault.borrow(amount, receiver)
 * - All feedback via `sonner` toasts (no throws)
 */
export function useBorrow({ requireController = true }: Options = {}) {
  const { evault, evaultAddress, connectedAddress, controller, refresh } = useContracts()
  const { limitRaw, borrowedRaw } = useCreditLine({ pollMs: 15_000 })

  const [submitting, setSubmitting] = React.useState(false)

  // Capacity (in base units)
  const maxBorrowRaw: bigint | null = React.useMemo(() => {
    if (limitRaw == null || borrowedRaw == null) return null
    const cap = limitRaw - borrowedRaw
    return cap > 0n ? cap : 0n
  }, [limitRaw, borrowedRaw])

  const maxBorrowDisplay: string = React.useMemo(() => {
    if (maxBorrowRaw == null) return '—'
    return `${fmt0(maxBorrowRaw, DECIMALS)} USDC`
  }, [maxBorrowRaw])

  /** quick client-side validation for a string amount in asset units */
  const validateAmount = React.useCallback(
    (amountInput: string) => {
      const cleaned = cleanAmountInput(amountInput || '')
      if (!cleaned) return { ok: false, reason: 'Enter an amount.' }

      let amount: bigint
      try {
        amount = parseUnits(cleaned, DECIMALS)
      } catch {
        return { ok: false, reason: 'Invalid amount.' }
      }
      if (amount <= 0n) return { ok: false, reason: 'Amount must be greater than 0.' }

      if (maxBorrowRaw != null && amount > maxBorrowRaw) {
        return { ok: false, reason: 'Amount exceeds your available capacity.' }
      }
      return { ok: true as const, reason: null as null, amount }
    },
    [maxBorrowRaw]
  )

  /** convenience flags for UIs */
  const checkExceeds = React.useCallback(
    (amountInput: string) => {
      const cleaned = cleanAmountInput(amountInput || '')
      try {
        const a = parseUnits(cleaned || '0', DECIMALS)
        return maxBorrowRaw != null && a > maxBorrowRaw
      } catch {
        return false
      }
    },
    [maxBorrowRaw]
  )

  const submit = React.useCallback(
    async (amountInput: string) => {
      if (!evault || !evaultAddress || !connectedAddress) {
        toast.error('Missing setup', {
          description: 'Vault contracts or addresses are not ready.',
        })
        return false
      }

      const { ok, reason, amount } = validateAmount(amountInput)
      if (!ok || !amount) {
        toast.error('Invalid amount', { description: reason || 'Please check the value.' })
        return false
      }

      setSubmitting(true)
      const tLoading = toast.loading('Submitting borrow…')

      try {
        // Enable controller (best-effort)
        if (requireController && controller) {
          try {
            const txCtrl = await (controller as any).enableController(
              connectedAddress,
              evaultAddress
            )
            await txCtrl.wait()
          } catch (e) {
            const m = err(e).toLowerCase()
            // Ignore benign "already enabled" variants
            if (!m.includes('already') && !m.includes('enabled')) {
              toast.dismiss(tLoading)
              toast.error('Controller error', { description: err(e) })
              return false
            }
          }
        }

        // Borrow
        const tx = await (evault as any).borrow(amount, connectedAddress)
        await tx.wait()

        toast.success('Borrow confirmed', {
          description: 'Funds have been transferred to your wallet.',
        })

        await refresh?.() // refresh app state (debt, limit/borrowed, balances)
        return true
      } catch (e: any) {
        toast.error('Borrow failed', { description: err(e) })
        return false
      } finally {
        toast.dismiss(tLoading)
        setSubmitting(false)
      }
    },
    [evault, evaultAddress, connectedAddress, controller, requireController, validateAmount, refresh]
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
