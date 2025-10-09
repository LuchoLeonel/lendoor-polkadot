'use client'

import * as React from 'react'
import { parseUnits } from 'ethers'
import { toast } from 'sonner'
import { useContracts } from '@/providers/ContractsProvider'
import { formatUSDCAmount } from '@/lib/utils'
import { DECIMALS } from '@/lib/utils'
import { useUserJourney } from '@/providers/UserJourneyProvider'

const msg = (e: any) => e?.shortMessage || e?.reason || e?.message || 'Transaction failed'

export function useApproveAndDepositUSDC() {
  const { evault, usdc, evaultAddress, connectedAddress, refresh } = useContracts()
  const { value, updateJourney } = useUserJourney()
  const [submitting, setSubmitting] = React.useState(false)

  const submit = React.useCallback(
    async (amountInput: string) => {
      if (!amountInput) return
      if (!usdc || !evault || !evaultAddress || !connectedAddress) {
        toast.error('Missing setup', { description: 'Contracts or addresses not ready.' })
        return
      }

      setSubmitting(true)
      try {
        const assets = parseUnits(amountInput.trim(), DECIMALS)

        const bal: bigint = await usdc.balanceOf(connectedAddress)
        if (bal < assets) {
          toast.error('Insufficient USDC', {
            description: `You have ${formatUSDCAmount(bal)} USDC and need ${formatUSDCAmount(assets)}.`,
          })
          return
        }

        const allowance: bigint = await usdc.allowance(connectedAddress, evaultAddress)
        if (allowance < assets) {
          try {
            const tx = await usdc.approve(evaultAddress, assets)
            await tx.wait()
            toast.success('Approve confirmed')
          } catch (e: any) {
            toast.error('Approve failed', { description: msg(e) })
            throw e
          }
        }

        try {
          const tx2 = await evault.deposit(assets, connectedAddress)
          await tx2.wait()
          toast.success('Deposit confirmed')
        } catch (e: any) {
          toast.error('Deposit failed', { description: msg(e) })
          throw e
        }

        await refresh()
        if (value === 'deposit_usdc') {
          await updateJourney('deposit_susdc')
        }
        return true
      } finally {
        setSubmitting(false)
      }
    },
    [usdc, evault, evaultAddress, connectedAddress, refresh],
  )

  return { submit, submitting }
}
