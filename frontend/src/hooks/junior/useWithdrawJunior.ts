'use client'

import * as React from 'react'
import { parseUnits } from 'ethers'
import { toast } from 'sonner'
import { useContracts } from '@/providers/ContractsProvider'
import { DECIMALS_4616 } from '@/lib/utils'
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

  // Disponible en UI units (DECIMALS_4616)
  const availableUi = React.useMemo(() => {
    if (rawSShares == null) return 0
    const sUi = scaleDecimals(rawSShares, 18, DECIMALS_4616) // bigint con DECIMALS_4616
    return Number(sUi) / 10 ** DECIMALS_4616
  }, [rawSShares])

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

      if (want > availableUi) {
        toast.error('Amount exceeds available', {
          description: `Requested ${want.toFixed(DECIMALS_4616)} sUSDC, available ${availableUi.toFixed(
            DECIMALS_4616,
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
