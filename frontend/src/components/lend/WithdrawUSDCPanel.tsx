'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { InfoTip } from '@/components/common/InfoTooltip'
import { CenteredAmountInput } from '@/components/common/CenteredAmountInput'
import { AvailableToWithdrawKPI } from '@/components/kpi/AvailableToWithdraw'
import { SusdcBalanceKPI } from '@/components/kpi/sUSDCBalance'
import { USDCExchangeRateKPI } from '@/components/kpi/ExchangeRatesUSDC'
import UserJourneyBadge from '@/components/common/UserJourneyBadge'
import { useUserJourney } from '@/providers/UserJourneyProvider'
import { useWithdrawUSDC } from '@/hooks/senior/useWithdrawUSDC'
import { useUser } from '@/providers/UserProvider'

type WithdrawPanelProps = {
  isLoggedIn: boolean
  loadingNetwork: boolean
  onConnect: () => void
  onWithdraw: (amount: string) => void
  availableLabel?: string // ej: "AVAILABLE: $0"
}

export function WithdrawUSDCPanel({
  isLoggedIn,
  loadingNetwork,
  onConnect,
  onWithdraw,
  availableLabel = 'AVAILABLE: $',
}: WithdrawPanelProps) {
  const [amount, setAmount] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const { ready, value } = useUserJourney();
  const { submit: submitWithdraw, submitting } = useWithdrawUSDC();
  const { seniorWithdrawAvailableDisplay: seniorAvail } = useUser();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoggedIn) return onConnect()
    const ok = await submitWithdraw(amount)
    if (ok) {
      onWithdraw?.(amount)
      setAmount('')
    }
  }


  const cta = !isLoggedIn && !loadingNetwork ? 'Connect Wallet' : 'Withdraw Liquidity'
  // Disable withdraw if amount empty, submitting, or pool not ready
  const isDisabled = !amount || submitting;
  const showBadge = ready && value === "withdraw_usdc";

  return (
    <>
      {/* KPIs (mismos que Supply; podés cambiarlos si necesitás) */}
      <div className="grid grid-cols-4 gap-2 w-full mx-auto">
        <USDCExchangeRateKPI />
        <AvailableToWithdrawKPI value={`${seniorAvail}`} />
        <SusdcBalanceKPI />
      </div>

      <Card className="p-4 border-2 border-border/50">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-muted-foreground font-mono">MANAGE LIQUIDITY</span>
        </div>

        <form onSubmit={onSubmit} className="w-full">
          <CenteredAmountInput value={amount} onChange={setAmount} showBadge={showBadge && !amount} />
            <div className="mt-1 mb-4 text-xs text-muted-foreground text-center">
            {availableLabel}{seniorAvail}
            </div>

            {/* botón full width */}
            <Button
              type="submit"
              disabled={isDisabled}
              className="mt-3 w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 cursor-pointer text-base font-semibold disabled:opacity-60"
            >
              {!!amount && showBadge && <UserJourneyBadge/>}
              {cta}
            </Button>
        </form>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              TX Cost <InfoTip label="Estimated gas for withdrawing." variant="light" />
            </span>
            <span className="text-xs">-</span>
          </div>
        </div>

        {/* Collapsible Info */}
        <div className="border-top border-border pt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-muted rounded flex items-center justify-center">
                <span className="text-xs">🏦</span>
              </div>
              <span className="text-sm font-medium">Withdrawal Info</span>
            </div>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-3">
              <div className="text-xs text-muted-foreground">
                Real-time liquidity depends on market reserves; some tranches (ej. jUSDC) pueden tener cooldown.
              </div>
            </div>
          )}
        </div>
      </Card>
    </>
  )
}
