'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { InfoTip } from '@/components/common/InfoTooltip'
import { CenteredAmountInput } from '@/components/common/CenteredAmountInput'
import { Card } from '@/components/ui/card'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { BaseApyKPI } from '@/components/kpi/BaseAPY'
import { OutstandingKPI } from '@/components/kpi/Outstanding'
import { CreditScoreKPI } from '@/components/kpi/Score'
import UserJourneyBadge from '@/components/common/UserJourneyBadge'
import { useUserJourney } from '@/providers/UserJourneyProvider'
import ExpandedMenu from '@/components/borrow/ExpandedMenu'
import { useRepay } from '@/hooks/borrow/useRepay'
import { useUser } from '@/providers/UserProvider'

type RepayPanelProps = {
  isLoggedIn: boolean
  loadingNetwork: boolean
  onConnect: () => void
  onRepay?: (amount: string) => void // now optional; hook handles chain call
  outstandingLabel?: string
}

export function RepayPanel({
  isLoggedIn,
  loadingNetwork,
  onConnect,
  onRepay,
  outstandingLabel = 'OUTSTANDING: ',
}: RepayPanelProps) {
  const [amount, setAmount] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const { ready, value } = useUserJourney();
  const { borrowedDisplay: borrowedOutstanding} = useUser();
  const { submit, submitting } = useRepay();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoggedIn) return onConnect()
    if (!amount) return
    try {
      await submit(amount)
      onRepay?.(amount)
      setAmount('')
    } catch (err) {
      console.error(err)
    }
  }

  const cta = !isLoggedIn && !loadingNetwork ? 'Connect Wallet' : 'Repay'
  const isDisabled = !amount || submitting
  const showBadge = ready && value === 'repay'

  return (
    <>
      <div className="grid grid-cols-4 gap-2 w-full mx-auto">
        <BaseApyKPI value="6.82%" />
        <OutstandingKPI value={borrowedOutstanding} />
        <CreditScoreKPI />
      </div>

      <Card className="p-4 border-2 border-border/50">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-muted-foreground font-mono">EARN BY LENDING</span>
        </div>

        <div className="mb-4">
          <form onSubmit={handleSubmit} className="w-full">
            <CenteredAmountInput value={amount} onChange={setAmount} showBadge={showBadge && !amount} />

            <div className="mt-1 mb-4 text-xs text-muted-foreground text-center">
              {outstandingLabel}
              {borrowedOutstanding}
            </div>

            <Button
              type="submit"
              disabled={isDisabled}
              className="mt-3 w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 cursor-pointer text-base font-semibold"
            >
              {!!amount && showBadge && <UserJourneyBadge />}
              {submitting ? 'Repaying…' : cta}
            </Button>
          </form>
        </div>

        <div className="space-y-2 mb-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              TX Cost <InfoTip label="Estimated gas for this repayment." contentClassName="font-display text-[11px] leading-snug" />
            </span>
            <span className="text-xs">-</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              Repayment Type{' '}
              <InfoTip
                label="Depending on market settings, repayments may prioritize interest → principal."
                contentClassName="font-display text-[11px] leading-snug"
              />
            </span>
            <span className="text-xs">Interest first</span>
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-muted rounded flex items-center justify-center">
                <span className="text-xs">💳</span>
              </div>
              <span className="text-sm font-medium">Credit Info</span>
            </div>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {isExpanded && <ExpandedMenu />}
        </div>
      </Card>
    </>
  )
}
