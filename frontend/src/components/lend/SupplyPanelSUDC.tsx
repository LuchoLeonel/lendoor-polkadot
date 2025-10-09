'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { InfoTip } from '@/components/common/InfoTooltip'
import { CenteredAmountInput } from '@/components/common/CenteredAmountInput'
import { JrApyKPI } from '@/components/kpi/JrAPY'
import { BackingTVVKPI } from '@/components/kpi/BackingTVV'
import UserJourneyBadge from '@/components/common/UserJourneyBadge'
import { useUserJourney } from '@/providers/UserJourneyProvider'
import { JusdcBalanceKPI } from '@/components/kpi/jUSDCBalance'
import { useApproveAndDepositSUSDC } from '@/hooks/junior/useApproveAndDepositSUSDC'
import { useIsLoggedIn } from '@dynamic-labs/sdk-react-core'

type SupplyPanelProps = {
  isLoggedIn?: boolean
  loadingNetwork: boolean
  onConnect: () => void
  onSupply: (amount: string) => void
  supplyCapLabel?: string
}

export function SupplyPanelSUSDC({
  isLoggedIn: isLoggedInProp,
  loadingNetwork,
  onConnect,
  onSupply,
  supplyCapLabel = 'SUPPLY CAP $10.000',
}: SupplyPanelProps) {
  const [amount, setAmount] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const { ready, value } = useUserJourney()
  const { submit, submitting } = useApproveAndDepositSUSDC()
  const isLoggedIn = isLoggedInProp ?? useIsLoggedIn()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoggedIn) return onConnect()
    if (!amount) return
    const ok = await submit(amount)
    if (ok) {
      onSupply?.(amount)
      setAmount('')
    }
  }

  const cta = !isLoggedIn && !loadingNetwork ? 'Connect Wallet' : 'Supply Liquidity'
  const isDisabled = !amount || submitting
  const showBadge = ready && value === 'deposit_susdc'

  return (
    <>
      <div className="grid grid-cols-4 gap-2 w-full mx-auto">
        <JrApyKPI />
        <BackingTVVKPI value="10.4M" />
        <JusdcBalanceKPI />
      </div>

      <Card className="p-4 border-2 border-border/50">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-muted-foreground font-mono">EARN BY LENDING (Junior)</span>
        </div>

        <form onSubmit={onSubmit} className="w-full">
          <CenteredAmountInput value={amount} onChange={setAmount} showBadge={showBadge && !amount} />

          <div className="mt-1 mb-4 text-xs text-muted-foreground text-center">
            {supplyCapLabel}
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

        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              TX Cost <InfoTip label="Estimated gas for supplying." variant="light" />
            </span>
            <span className="text-xs">-</span>
          </div>
        </div>

        <div className="border-top border-border pt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-muted rounded flex items-center justify-center">
                <span className="text-xs">💧</span>
              </div>
              <span className="text-sm font-medium">Liquidity Info</span>
            </div>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-3">
              <div className="text-xs font-medium text-muted-foreground">ASSETS</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs">sUSDC → jUSDC</span>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </div>
                <span className="text-xs">Pool-backed</span>
              </div>
            </div>
          )}
        </div>
      </Card>
    </>
  )
}