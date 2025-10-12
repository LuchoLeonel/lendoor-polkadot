'use client'

import * as React from 'react'
import { parseUnits } from 'ethers'
import { useContracts } from '@/providers/ContractsProvider'
import { DECIMALS_USDC } from '@/lib/utils'
import { toast } from 'sonner'

const err = (e: any) => e?.shortMessage || e?.reason || e?.message || 'Transaction failed'

/** Rescale bigint between decimals (floors on downscale). */
function scaleDecimals(value: bigint, fromDec: number, toDec: number): bigint {
  const f = BigInt(fromDec)
  const t = BigInt(toDec)
  if (t === f) return value
  if (t > f) return value * 10n ** (t - f)
  return value / 10n ** (f - t)
}

/**
 * USDC -> LendMarket repay flow:
 * - Parses input (USDC UI units, DECIMALS_USDC)
 * - Checks wallet balance (USDC on-chain, usually 6)
 * - Ensures allowance to LendMarket
 * - Calls lendMarket.repay(amount6, connectedAddress)
 */
export function useRepay() {
  const {
    lendMarket,
    lendMarketAddress,
    usdc,
    connectedAddress,
    refresh,
    usdcDecimals,
  } = useContracts()
  const aDec = usdcDecimals ?? 6

  const [submitting, setSubmitting] = React.useState(false)

  const submit = React.useCallback(
    async (amountInput: string) => {
      if (!amountInput) {
        toast.error('Enter an amount.')
        return false
      }

      if (!lendMarket || !lendMarketAddress || !usdc || !connectedAddress) {
        toast.error('Missing setup', {
          description: 'Market/USDC contracts or addresses are not ready.',
        })
        return false
      }

      // Parse amount: UI(DECIMALS_USDC) -> UI base -> USDC(aDec)
      let amount6: bigint
      try {
        const uiBase = parseUnits(amountInput.trim(), DECIMALS_USDC)
        if (uiBase <= 0n) {
          toast.error('Amount must be greater than 0.')
          return false
        }
        amount6 = scaleDecimals(uiBase, DECIMALS_USDC, aDec)
        if (amount6 <= 0n) {
          toast.error('Amount too small.')
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
        const bal6: bigint = await (usdc as any).balanceOf(connectedAddress)
        if (bal6 < amount6) {
          toast.dismiss(tLoading)
          toast.error('Insufficient balance', {
            description: 'Your USDC balance is not enough for this repayment.',
          })
          return false
        }

        // 2) Allowance check (approve if needed)
        const allowance6: bigint = await (usdc as any).allowance(connectedAddress, lendMarketAddress)
        if (allowance6 < amount6) {
          const txA = await (usdc as any).approve(lendMarketAddress, amount6)
          await txA.wait()
          toast.success('Approval confirmed')
        }

        // 3) Repay on LendMarket
        const tx = await (lendMarket as any).repay(amount6, connectedAddress)
        await tx.wait()

        toast.success('Repayment confirmed', {
          description: 'Your outstanding balance has been reduced.',
        })

        await refresh?.() // refresh balances/debt/etc.
        return true
      } catch (e: any) {
        toast.error('Repay failed', { description: err(e) })
        return false
      } finally {
        toast.dismiss(tLoading)
        setSubmitting(false)
      }
    },
    [lendMarket, lendMarketAddress, usdc, connectedAddress, refresh, aDec],
  )

  return { submit, submitting }
}
