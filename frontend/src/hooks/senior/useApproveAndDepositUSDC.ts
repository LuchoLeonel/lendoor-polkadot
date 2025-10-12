'use client'

import * as React from 'react'
import { parseUnits } from 'ethers'
import { toast } from 'sonner'
import { useContracts } from '@/providers/ContractsProvider'
import { useUserJourney } from '@/providers/UserJourneyProvider'
import { DECIMALS_USDC } from '@/lib/utils'

const err = (e: any) => e?.shortMessage || e?.reason || e?.message || 'Transaction failed'

// Rescale bigint between decimals (floors on downscale).
function scaleDecimals(value: bigint, fromDec: number, toDec: number): bigint {
  const f = BigInt(fromDec)
  const t = BigInt(toDec)
  if (t === f) return value
  if (t > f) return value * 10n ** (t - f)
  return value / 10n ** (f - t)
}

// Format a USDC amount given in UI base units (DECIMALS_USDC) to 2dp
function formatUi2dp(amountUi: bigint): string {
  const base = 10n ** BigInt(DECIMALS_USDC)
  const scaled = (amountUi * 100n + base / 2n) / base // round half up to 2dp
  const units = scaled / 100n
  const frac = (scaled % 100n).toString().padStart(2, '0')
  return `${units.toString()}.${frac}`
}

/**
 * Approve USDC (underlying) to sUSDC vault and deposit.
 * - Input amount: USDC in UI units (DECIMALS_USDC)
 * - Converts UI → on-chain USDC(6), checks balance/allowance, approves if needed, then calls sUSDC.deposit.
 */
export function useApproveAndDepositUSDC() {
  const { usdc, sUSDC, sUSDCAddress, connectedAddress, refresh } = useContracts()
  const { value, updateJourney } = useUserJourney()
  const [submitting, setSubmitting] = React.useState(false)

  const submit = React.useCallback(
    async (amountInput: string) => {
      if (!amountInput) return false
      if (!usdc || !sUSDC || !sUSDCAddress || !connectedAddress) {
        toast.error('Missing setup', { description: 'Contracts or addresses not ready.' })
        return false
      }

      setSubmitting(true)
      try {
        // UI(DECIMALS_USDC) -> UI base bigint
        const uiBase = parseUnits(amountInput.trim(), DECIMALS_USDC)
        if (uiBase <= 0n) {
          toast.error('Invalid amount')
          return false
        }
        // UI base -> USDC(6) for the ERC4626 deposit
        const assets6 = scaleDecimals(uiBase, DECIMALS_USDC, 6)

        // Balance check (USDC has 6 decimals on-chain)
        const bal6: bigint = await (usdc as any).balanceOf(connectedAddress)
        if (bal6 < assets6) {
          const haveUi = scaleDecimals(bal6, 6, DECIMALS_USDC)
          toast.error('Insufficient USDC', {
            description: `You have ${formatUi2dp(haveUi)} USDC and need ${formatUi2dp(uiBase)}.`,
          })
          return false
        }

        // Allowance check to sUSDC vault
        const allowance6: bigint = await (usdc as any).allowance(connectedAddress, sUSDCAddress)
        if (allowance6 < assets6) {
          try {
            const tx = await (usdc as any).approve(sUSDCAddress, assets6)
            await tx.wait()
            toast.success('Approve confirmed')
          } catch (e: any) {
            toast.error('Approve failed', { description: err(e) })
            return false
          }
        }

        // Deposit underlying USDC to receive sUSDC shares
        try {
          const tx2 = await (sUSDC as any).deposit(assets6, connectedAddress)
          await tx2.wait()
          toast.success('Deposit confirmed')
        } catch (e: any) {
          toast.error('Deposit failed', { description: err(e) })
          return false
        }

        await refresh?.()
        if (value === 'deposit_usdc') {
          await updateJourney('deposit_susdc')
        }
        return true
      } catch (e) {
        toast.error('Transaction failed', { description: err(e) })
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [usdc, sUSDC, sUSDCAddress, connectedAddress, refresh, value, updateJourney],
  )

  return { submit, submitting }
}
