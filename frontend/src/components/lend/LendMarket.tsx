'use client'

import { useState } from 'react'
import { useIsLoggedIn, useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SupplyPanelUSDC } from '@/components/lend/SupplyPanelUSDC'
import { SupplyPanelSUSDC } from '@/components/lend/SupplyPanelSUDC'
import { WithdrawUSDCPanel } from '@/components/lend/WithdrawUSDCPanel'
import { WithdrawSUSDCPanel } from '@/components/lend/WithdrawSUSDCPanel'
import UserJourneyBadge from '@/components/common/UserJourneyBadge'
import { useUserJourney } from '@/providers/UserJourneyProvider'

type Tab = 'Supply USDC' | 'Supply sUSDC' | 'Withdraw USDC' | 'Withdraw sUSDC'

export function LendMarket() {
  const [activeTab, setActiveTab] = useState<Tab>('Supply USDC')
  const isLoggedIn = useIsLoggedIn()
  const { setShowAuthFlow, loadingNetwork } = useDynamicContext()
  const { ready, value } = useUserJourney();

  // TODO: conectá con tus contracts
  const handleSupply = (amt: string) => console.log('Supply amount:', amt)
  const handleWithdraw = (amt: string) => console.log('Withdraw amount:', amt)

  return (
    <TooltipProvider delayDuration={150}>
      <div className="w-full max-w-md mx-auto space-y-3 px-4">
        {/* Header Tabs */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {(['Supply USDC','Supply sUSDC', 'Withdraw USDC', 'Withdraw sUSDC'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex flex-row items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground cursor-pointer'
                  }`}
                >
                  <div>
                    {ready && value == "deposit_usdc" && activeTab != tab && tab == "Supply USDC" && <UserJourneyBadge />}
                    {ready && value == "deposit_susdc" && activeTab != tab && tab == "Supply sUSDC" && <UserJourneyBadge />}
                    {ready && value == "withdraw_usdc" && activeTab != tab && tab == "Withdraw USDC" && <UserJourneyBadge />}
                    {ready && value == "withdraw_susdc" && activeTab != tab && tab == "Withdraw sUSDC" && <UserJourneyBadge />}
                  </div>
                  &nbsp;&nbsp;
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeTab === 'Supply USDC' ? (
          <SupplyPanelUSDC
            isLoggedIn={!!isLoggedIn}
            loadingNetwork={loadingNetwork}
            onConnect={() => setShowAuthFlow(true)}
            onSupply={handleSupply}
          />
        ) : activeTab === 'Supply sUSDC' ? (
          <SupplyPanelSUSDC
            isLoggedIn={!!isLoggedIn}
            loadingNetwork={loadingNetwork}
            onConnect={() => setShowAuthFlow(true)}
            onSupply={handleSupply}
          />
        ) : activeTab === 'Withdraw USDC' ? (
          <WithdrawUSDCPanel
            isLoggedIn={!!isLoggedIn}
            loadingNetwork={loadingNetwork}
            onConnect={() => setShowAuthFlow(true)}
            onWithdraw={handleWithdraw}
          />
        ) :
          <WithdrawSUSDCPanel
            isLoggedIn={!!isLoggedIn}
            loadingNetwork={loadingNetwork}
            onConnect={() => setShowAuthFlow(true)}
            onWithdraw={handleWithdraw}
          />
      }
      </div>
    </TooltipProvider>
  )
}
