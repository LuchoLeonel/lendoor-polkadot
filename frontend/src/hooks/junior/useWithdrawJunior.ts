'use client'

import * as React from 'react'
import { parseUnits } from 'ethers'
import { toast } from 'sonner'
import { DECIMALS } from '@/lib/utils'
import { useContracts } from '@/providers/ContractsProvider'
import { useJuniorAvailableToWithdraw } from './useJuniorAvailableToWithdraw'

const errMsg = (e: any) => e?.shortMessage || e?.reason || e?.message || 'Transaction failed'

/**
 * Input amount is sUSDC in UI units (scaled with DECIMALS).
 * We compare against wrapper.maxWithdraw(owner) (also in UI units),
 * then compute the exact j-shares to demote and call EVault.demoteToSenior.
 */
export function useDemoteJunior() {
  const { evault, connectedAddress, refresh } = useContracts()
  const { rawSShares, refresh: refreshAvailable } = useJuniorAvailableToWithdraw({ pollMs: 0 })

  // Available in UI units: base / 10^DECIMALS
  const availableUi = React.useMemo(
    () => (rawSShares == null ? 0 : Number(rawSShares) / 10 ** DECIMALS),
    [rawSShares],
  )

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

      // Validate against available (both in UI units)
      if (want > availableUi) {
        toast.error('Amount exceeds available', {
          description: `Requested ${want.toFixed(DECIMALS)} sUSDC, available ${availableUi.toFixed(DECIMALS)} sUSDC.`,
        })
        return
      }

      setSubmitting(true)
      try {
        // UI -> base units (shares expressed with DECIMALS)
        const sDesiredBase = parseUnits(amt, DECIMALS)

        // s-shares -> USDC (floor)
        const assetsUSDC: bigint = await (evault as any).convertToAssets(sDesiredBase)

        // USDC -> required j-shares (ceil)
        const jNeeded: bigint = await (evault as any).previewWithdrawJunior(assetsUSDC)

        // Demote j -> s (credits s-shares to receiver)
        const tx = await (evault as any).demoteToSenior(jNeeded, connectedAddress)
        await tx.wait()

        toast.success('Demote confirmed')
        await Promise.all([refresh?.(), refreshAvailable()])
        return true
      } catch (e: any) {
        toast.error('Demote failed', { description: errMsg(e) })
      } finally {
        setSubmitting(false)
      }
    },
    [evault, connectedAddress, availableUi, refresh, refreshAvailable],
  )

  return { submit, submitting, availableUi }
}
