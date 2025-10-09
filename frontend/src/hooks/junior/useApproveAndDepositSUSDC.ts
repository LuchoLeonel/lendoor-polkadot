'use client'

import * as React from 'react'
import { parseUnits } from 'ethers'
import { toast } from 'sonner'
import { useContracts } from '@/providers/ContractsProvider'
import { formatUSDCAmount } from '@/lib/utils'
import { DECIMALS } from '@/lib/utils'
import { useUserJourney } from '@/providers/UserJourneyProvider'

const msg = (e: any) => e?.shortMessage || e?.reason || e?.message || 'Transaction failed'

export function useApproveAndDepositSUSDC() {
  const { evault, evaultJunior, evaultJuniorAddress, connectedAddress, refresh } = useContracts()
  const { value, updateJourney } = useUserJourney()
  const [submitting, setSubmitting] = React.useState(false)

  const submit = React.useCallback(
    async (amountInput: string) => {
      if (!amountInput) return false
      if (!evault || !evaultJunior || !evaultJuniorAddress || !connectedAddress) {
        toast.error('Missing setup', { description: 'Contracts or addresses not ready.' })
        return false
      }

      setSubmitting(true)
      try {
        const assets = parseUnits(amountInput.trim(), DECIMALS)

        const sBal: bigint = await (evault as any).balanceOf(connectedAddress)
        if (sBal < assets) {
          toast.error('Insufficient sUSDC', {
            description: `You have ${formatUSDCAmount(sBal)} sUSDC and need ${formatUSDCAmount(assets)}.`,
          })
          return false
        }

        const allowance: bigint = await (evault as any).allowance(connectedAddress, evaultJuniorAddress)
        if (allowance < assets) {
          try {
            const tx = await (evault as any).approve(evaultJuniorAddress, assets)
            await tx.wait()
            toast.success('Approve confirmed')
          } catch (e: any) {
            toast.error('Approve failed', { description: msg(e) })
            throw e
          }
        }

        try {
          const tx2 = await (evaultJunior as any).deposit(assets, connectedAddress)
          await tx2.wait()
          toast.success('Deposit confirmed')
        } catch (e: any) {
          toast.error('Deposit failed', { description: msg(e) })
          throw e
        }

        await refresh()
        if (value === 'deposit_susdc') {
          await updateJourney('withdraw_susdc')
        }
        return true
      } finally {
        setSubmitting(false)
      }
    },
    [evault, evaultJunior, evaultJuniorAddress, connectedAddress, refresh],
  )

  return { submit, submitting }
}