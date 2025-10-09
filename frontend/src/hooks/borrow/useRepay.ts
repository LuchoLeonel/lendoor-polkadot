'use client'

import * as React from 'react'
import { parseUnits } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'
import { DECIMALS } from '@/lib/utils'
import { toast } from 'sonner'

const msg = (e: any) => e?.shortMessage || e?.reason || e?.message || 'Transaction failed'

/**
 * Handles USDC -> EVault repay flow:
 * - Parses input amount to base units (configurable decimals)
 * - Checks wallet balance
 * - Ensures allowance (approve if needed)
 * - Calls evault.repay(amount, connectedAddress)
 * - Exposes submitting state and a submit(amount) action
 */
export function useRepay() {
  const { evault, evaultAddress, usdc, connectedAddress, refresh } = useContracts()
  const [submitting, setSubmitting] = React.useState(false)

  const submit = React.useCallback(
    async (amountInput: string) => {
      if (!amountInput) {
        toast.error('Enter an amount.')
        return false
      }

      if (!evault || !evaultAddress || !usdc || !connectedAddress) {
        toast.error('Missing setup', {
          description: 'Vault/USDC contracts or addresses are not ready.',
        })
        return false
      }

      // Parse amount
      let amount: bigint
      try {
        amount = parseUnits(amountInput.trim(), DECIMALS)
        if (amount <= 0n) {
          toast.error('Amount must be greater than 0.')
          return false
        }
      } catch {
        toast.error('Invalid amount format.')
        return false
      }

      setSubmitting(true)
      const tLoading = toast.loading('Submitting repayment…')

      try {
        // 1) Wallet balance check
        const bal: bigint = await (usdc as any).balanceOf(connectedAddress)
        if (bal < amount) {
          toast.dismiss(tLoading)
          toast.error('Insufficient balance', {
            description: 'Your USDC balance is not enough for this repayment.',
          })
          return false
        }

        // 2) Allowance check (approve if needed)
        const allowance: bigint = await (usdc as any).allowance(connectedAddress, evaultAddress)
        if (allowance < amount) {
          const txA = await (usdc as any).approve(evaultAddress, amount)
          await txA.wait()
          toast.success('Approval confirmed')
        }

        // 3) Repay
        const tx = await (evault as any).repay(amount, connectedAddress)
        await tx.wait()

        toast.success('Repayment confirmed', {
          description: 'Your outstanding balance has been reduced.',
        })

        await refresh?.() // refresh app state (balances, debt, etc.)
        return true
      } catch (e: any) {
        toast.error('Repay failed', { description: msg(e) })
        return false
      } finally {
        toast.dismiss(tLoading)
        setSubmitting(false)
      }
    },
    [evault, evaultAddress, usdc, connectedAddress, refresh]
  )

  return { submit, submitting }
}
