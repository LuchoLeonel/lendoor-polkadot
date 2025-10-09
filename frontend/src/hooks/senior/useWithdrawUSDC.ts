'use client'

import * as React from 'react'
import { parseUnits } from 'ethers'
import { toast } from 'sonner'
import { useContracts } from '@/providers/ContractsProvider'
import { DECIMALS } from '@/lib/utils'
import { useSeniorAvailableToWithdraw } from './useSeniorAvailableToWithdraw'
import { useUserJourney } from '@/providers/UserJourneyProvider'

const errMsg = (e: any) => e?.shortMessage || e?.reason || e?.message || 'Transaction failed'

export function useWithdrawUSDC() {
  const { evault, connectedAddress, refresh } = useContracts()
  const { value, updateJourney } = useUserJourney()
  // Reuse the available hook without polling; we refresh it manually after tx
  const { uiAmount: availableUi = 0, refresh: refreshAvailable } = useSeniorAvailableToWithdraw({ pollMs: 0 })
  const [submitting, setSubmitting] = React.useState(false)

  const submit = React.useCallback(
    async (amountInput: string) => {
      const amt = amountInput?.trim()
      if (!amt) return
      if (!evault || !connectedAddress) {
        toast.error('Missing setup', { description: 'Contracts or addresses not ready.' })
        return
      }

      const want = Number(amt)
      if (!Number.isFinite(want) || want <= 0) {
        toast.error('Invalid amount')
        return
      }

      // Compare in UI units (both use DECIMALS scaling)
      if (want > availableUi) {
        toast.error('Amount exceeds available', {
          description: `Requested ${want.toFixed(DECIMALS)} USDC, available ${availableUi.toFixed(DECIMALS)} USDC.`,
        })
        return
      }

      setSubmitting(true)
      try {
        // Convert from UI units (DECIMALS) to on-chain base units expected by the contract for assets
        const assets = parseUnits(amt, DECIMALS)
        const tx = await (evault as any).withdraw(assets, connectedAddress, connectedAddress)
        await tx.wait()
        toast.success('Withdraw confirmed')
        await Promise.all([refresh?.(), refreshAvailable()])
        if (value === 'withdraw_usdc') {
          await updateJourney('borrow')
        }
        return true
      } catch (e: any) {
        toast.error('Withdraw failed', { description: errMsg(e) })
      } finally {
        setSubmitting(false)
      }
    },
    [evault, connectedAddress, availableUi, refresh, refreshAvailable],
  )

  return { submit, submitting, availableUi }
}