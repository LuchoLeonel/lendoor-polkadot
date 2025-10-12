'use client'

import * as React from 'react'
import { parseUnits } from 'ethers'
import { toast } from 'sonner'
import { useContracts } from '@/providers/ContractsProvider'
import { DECIMALS_USDC } from '@/lib/utils'
import { useSeniorAvailableToWithdraw } from './useSeniorAvailableToWithdraw'
import { useUserJourney } from '@/providers/UserJourneyProvider'

const errMsg = (e: any) => e?.shortMessage || e?.reason || e?.message || 'Transaction failed'

// Rescale bigint between decimals (e.g., 4 -> 6). Floors on downscale.
function scaleDecimals(value: bigint, fromDec: number, toDec: number): bigint {
  const f = BigInt(fromDec)
  const t = BigInt(toDec)
  if (t === f) return value
  if (t > f) return value * 10n ** (t - f)
  return value / 10n ** (f - t)
}

export function useWithdrawUSDC() {
  const { sUSDC, connectedAddress, refresh } = useContracts()
  const { value, updateJourney } = useUserJourney()

  // Sin polling; refrescamos manual tras la tx
  const { uiAmount: availableUi = 0, refresh: refreshAvailable } = useSeniorAvailableToWithdraw({ pollMs: 0 })
  const [submitting, setSubmitting] = React.useState(false)

  const submit = React.useCallback(
    async (amountInput: string) => {
      const amt = amountInput?.trim()
      if (!amt) return
      if (!sUSDC || !connectedAddress) {
        toast.error('Missing setup', { description: 'Contracts or addresses not ready.' })
        return
      }

      const want = Number(amt)
      if (!Number.isFinite(want) || want <= 0) {
        toast.error('Invalid amount')
        return
      }

      // Comparación en unidades UI (DECIMALS_USDC)
      if (want > availableUi) {
        toast.error('Amount exceeds available', {
          description: `Requested ${want.toFixed(DECIMALS_USDC)} USDC, available ${availableUi.toFixed(
            DECIMALS_USDC,
          )} USDC.`,
        })
        return
      }

      setSubmitting(true)
      try {
        // UI -> base (DECIMALS_USDC)
        const uiBase = parseUnits(amt, DECIMALS_USDC)
        // base(UI) -> USDC(6) para el contrato ERC4626.withdraw
        const assets6 = scaleDecimals(uiBase, DECIMALS_USDC, 6)

        const tx = await (sUSDC as any).withdraw(assets6, connectedAddress, connectedAddress)
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
    [sUSDC, connectedAddress, availableUi, refresh, refreshAvailable, value, updateJourney],
  )

  return { submit, submitting, availableUi }
}
