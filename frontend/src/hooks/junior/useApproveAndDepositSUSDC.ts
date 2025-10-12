'use client'

import * as React from 'react'
import { parseUnits } from 'ethers'
import { toast } from 'sonner'
import { useContracts } from '@/providers/ContractsProvider'
import { useUserJourney } from '@/providers/UserJourneyProvider'
import { DECIMALS_4616 } from '@/lib/utils'

const err = (e: any) => e?.shortMessage || e?.reason || e?.message || 'Transaction failed'

// Rescale bigint between decimals (e.g., 14 -> 18). Floors on downscale.
function scaleDecimals(value: bigint, fromDec: number, toDec: number): bigint {
  const f = BigInt(fromDec)
  const t = BigInt(toDec)
  if (t === f) return value
  if (t > f) return value * 10n ** (t - f)
  return value / 10n ** (f - t)
}

// Format sUSDC shares using UI scale (DECIMALS_4616 ⇒ 4 visible decimals)
function formatSharesUi(amount18: bigint): string {
  const uiBase = scaleDecimals(amount18, 18, DECIMALS_4616) // bigint in UI base
  const base = 10n ** BigInt(DECIMALS_4616)
  const units = uiBase / base
  const frac = (uiBase % base).toString().padStart(DECIMALS_4616, '0')
  // trim trailing zeros
  const trimmed = frac.replace(/0+$/, '')
  return trimmed.length ? `${units.toString()}.${trimmed}` : units.toString()
}

/**
 * Approve sUSDC -> jUSDC and deposit sUSDC (shares) into the junior vault.
 * - Input amount is sUSDC shares in UI units (DECIMALS_4616).
 * - Converts UI → on-chain shares(18), checks balance/allowance, approves if needed, then deposits.
 */
export function useApproveAndDepositSUSDC() {
  const { sUSDC, jUSDC, jUSDCAddress, connectedAddress, refresh } = useContracts()
  const { value, updateJourney } = useUserJourney()
  const [submitting, setSubmitting] = React.useState(false)

  const submit = React.useCallback(
    async (amountInput: string) => {
      if (!amountInput) return false
      if (!sUSDC || !jUSDC || !jUSDCAddress || !connectedAddress) {
        toast.error('Missing setup', { description: 'Contracts or addresses not ready.' })
        return false
      }

      setSubmitting(true)
      try {
        // UI (DECIMALS_4616) → on-chain sUSDC shares (18)
        const uiBase = parseUnits(amountInput.trim(), DECIMALS_4616)
        const assetsShares18 = scaleDecimals(uiBase, DECIMALS_4616, 18)

        // Check sUSDC share balance
        const sBal: bigint = await (sUSDC as any).balanceOf(connectedAddress)
        if (sBal < assetsShares18) {
          toast.error('Insufficient sUSDC', {
            description: `You have ${formatSharesUi(sBal)} sUSDC and need ${formatSharesUi(assetsShares18)}.`,
          })
          return false
        }

        // Approve jUSDC to pull sUSDC shares if needed
        const allowance: bigint = await (sUSDC as any).allowance(connectedAddress, jUSDCAddress)
        if (allowance < assetsShares18) {
          try {
            const tx = await (sUSDC as any).approve(jUSDCAddress, assetsShares18)
            await tx.wait()
            toast.success('Approve confirmed')
          } catch (e: any) {
            toast.error('Approve failed', { description: err(e) })
            return false
          }
        }

        // Deposit sUSDC shares into jUSDC
        try {
          const tx2 = await (jUSDC as any).deposit(assetsShares18, connectedAddress)
          await tx2.wait()
          toast.success('Deposit confirmed')
        } catch (e: any) {
          toast.error('Deposit failed', { description: err(e) })
          return false
        }

        await refresh?.()
        if (value === 'deposit_susdc') {
          await updateJourney('withdraw_susdc')
        }
        return true
      } catch (e) {
        toast.error('Transaction failed', { description: err(e) })
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [sUSDC, jUSDC, jUSDCAddress, connectedAddress, refresh, value, updateJourney],
  )

  return { submit, submitting }
}
