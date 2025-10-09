'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { InfoTip } from '@/components/common/InfoTooltip'
import { CenteredAmountInput } from '@/components/common/CenteredAmountInput'
import { Card } from '@/components/ui/card'
import { ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react'
import { BorrowLimitKPI } from '@/components/kpi/Limit'
import { CreditScoreKPI } from '@/components/kpi/Score'
import { BaseApyKPI } from '@/components/kpi/BaseAPY'
import UserJourneyBadge from '@/components/common/UserJourneyBadge'
import { useUserJourney } from '@/providers/UserJourneyProvider'
import ExpandedMenu from '@/components/borrow/ExpandedMenu'
import { useBorrow } from '@/hooks/borrow/useBorrow'
import { useUser } from '@/providers/UserProvider'

type PullPanelProps = {
  isLoggedIn: boolean
  loadingNetwork: boolean
  onConnect: () => void
  onPull: (amount: string) => void
  maxPullLabel?: string
  setShowQR: (show: boolean) => void
}

export function PullPanel({
  isLoggedIn,
  loadingNetwork,
  onConnect,
  onPull,
  maxPullLabel = 'MAX PULL: ',
  setShowQR,
}: PullPanelProps) {
  const [amount, setAmount] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const { ready, value } = useUserJourney();
  const { isVerified } = useUser();

  // Borrow hook (handles controller enabling + borrow execution)
  const { maxBorrowDisplay, submit, submitting } = useBorrow({requireController: true});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoggedIn) return onConnect()
    if (ready && !isVerified) return setShowQR(true)
    if (!amount) return
    try {
      await submit(amount)
      onPull(amount)
      setAmount('')
    } catch (err) {
      console.error(err)
    }
  }

  const cta = !isLoggedIn && !loadingNetwork ? 'Connect Wallet' : (submitting ? 'Borrowing…' : 'Borrow now')
  const isDisabled = !amount || submitting
  const showBadge = ready && (value === 'verify_identity' || value === 'borrow')

  return (
    <>
      <div className="grid grid-cols-4 gap-2 w-full mx-auto">
        <BaseApyKPI value="6.82%" />
        <BorrowLimitKPI />
        <CreditScoreKPI />
      </div>

      <Card className="p-4 border-2 border-border/50">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-muted-foreground font-mono">
            BORROW BANK-FREE
          </span>

          {isVerified && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-semibold">
              <ShieldCheck className="w-3 h-3" />
              Identity Verified
            </span>
          )}
        </div>

        <div className="mb-4">
          <form onSubmit={handleSubmit} className="w-full">
            <CenteredAmountInput
              value={amount}
              onChange={setAmount}
              showBadge={showBadge && !amount}
            />

            <div className="mt-1 mb-4 text-xs text-muted-foreground text-center">
              {maxPullLabel}{maxBorrowDisplay}
            </div>

            <Button
              type="submit"
              disabled={isDisabled}
              className="mt-3 w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 cursor-pointer text-base font-semibold"
            >
              {!!amount && showBadge && <UserJourneyBadge />}
              {cta}
            </Button>
          </form>
        </div>

        <div className="space-y-2 mb-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              TX Cost{' '}
              <InfoTip
                label="Estimated gas for this pull."
                variant="light"
              />
            </span>
            <span className="text-xs">-</span>
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
