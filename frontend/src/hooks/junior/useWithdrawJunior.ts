'use client'

import * as React from 'react'
import { parseUnits } from 'ethers'
import { toast } from 'sonner'
import { useContracts } from '@/providers/ContractsProvider'
import { DECIMALS_4616, UI_SHARES_DP } from '@/lib/utils'
import { useJuniorAvailableToWithdraw } from './useJuniorAvailableToWithdraw'

const errMsg = (e: any) => e?.shortMessage || e?.reason || e?.message || 'Transaction failed'

// Rescale bigint between decimals (e.g., 14 -> 18). Floors on downscale.
function scaleDecimals(value: bigint, fromDec: number, toDec: number): bigint {
  const f = BigInt(fromDec)
  const t = BigInt(toDec)
  if (t === f) return value
  if (t > f) return value * 10n ** (t - f)
  return value / 10n ** (f - t)
}

/**
 * Input amount is **sUSDC shares** in UI units (DECIMALS_4616).
 * Compara contra rawSShares (on-chain 18), reescala y llama jUSDC.withdraw(sShares18, to, owner).
 */
export function useDemoteJunior() {
  const { jUSDC, connectedAddress, refresh } = useContracts()
  const { rawSShares, refresh: refreshAvailable } = useJuniorAvailableToWithdraw({ pollMs: 0 }) // rawSShares: s-shares (18)

  const availableUiBase = React.useMemo(() => {
    if (rawSShares == null) return 0n
    return scaleDecimals(rawSShares, 18, DECIMALS_4616)
  }, [rawSShares])
  const availableUi = Number(availableUiBase) / 10 ** DECIMALS_4616

  const [submitting, setSubmitting] = React.useState(false)

  const submit = React.useCallback(
    async (amountInput: string) => {
      const amt = amountInput?.trim()
      if (!amt) return
      if (!jUSDC || !connectedAddress) {
        toast.error('Missing setup', { description: 'Contracts or addresses not ready.' })
        return
      }

      const want = Number(amt)
      if (!Number.isFinite(want) || want <= 0) {
        toast.error('Invalid amount')
        return
      }
      
      const wantUiBase = parseUnits(amt, DECIMALS_4616)
      if (wantUiBase > availableUiBase) {
        toast.error('Amount exceeds available', {
          description: `Requested ${want.toFixed(UI_SHARES_DP)} sUSDC, available ${availableUi.toFixed(
            UI_SHARES_DP,
          )} sUSDC.`,
        })
        return
      }

      setSubmitting(true)
      try {
        // UI (DECIMALS_4616) -> base UI bigint
        const sDesiredUiBase = parseUnits(amt, DECIMALS_4616)
        // base UI -> on-chain s-shares (18)
        const sDesiredShares18 = scaleDecimals(sDesiredUiBase, DECIMALS_4616, 18)

        // Seguridad extra
        if (rawSShares != null && sDesiredShares18 > rawSShares) {
          toast.error('Amount exceeds available')
          setSubmitting(false)
          return
        }

        // Redime j-shares necesarios y entrega s-shares al receiver
        const tx = await (jUSDC as any).withdraw(sDesiredShares18, connectedAddress, connectedAddress)
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
    [jUSDC, connectedAddress, availableUi, rawSShares, refresh, refreshAvailable],
  )

  return { submit, submitting, availableUi }
}
