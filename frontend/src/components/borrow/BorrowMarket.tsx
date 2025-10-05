'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { useIsLoggedIn, useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { TooltipProvider } from '@/components/ui/tooltip'
import { InfoTip } from '@/components/common/InfoTooltip'
import { PullPanel } from '@/components/borrow/PullPanel'
import { RepayPanel } from '@/components/borrow/RepayPanel'
import UserJourneyBadge from '../common/UserJourneyBadge'
import { useUserJourney } from '../providers/UserProvider'

type Tab = 'Pull' | 'Repay' | 'Stake with Symbiotic'

export function CreditMarket({setShowQR}: any) {
  const [activeTab, setActiveTab] = useState<Tab>('Pull')
  const isLoggedIn = useIsLoggedIn()
  const { setShowAuthFlow, loadingNetwork } = useDynamicContext()
  const { ready, value, is_only_borrow } = useUserJourney();
  
  // TODO: conecta con tus contratos
  const handlePull = (amt: string) => {
    console.log('Pull amount:', amt)
  }
  const handleRepay = (amt: string) => {
    console.log('Repay amount:', amt)
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="w-full max-w-md mx-auto space-y-3 px-4">
        {/* Header Tabs */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {(['Pull', 'Repay', 'Stake with Symbiotic'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  disabled={tab==='Stake with Symbiotic'}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground cursor-pointer'
                  }`}
                >
                  {ready && is_only_borrow && activeTab != tab && tab == "Pull" && <UserJourneyBadge />}
                  {ready && value == "repay" && activeTab != tab && tab == "Repay" && <UserJourneyBadge />}
                  &nbsp;&nbsp;
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeTab === 'Pull' ? (
            <PullPanel
              isLoggedIn={!!isLoggedIn}
              loadingNetwork={loadingNetwork}
              onConnect={() => setShowAuthFlow(true)}
              onPull={(amt) => handlePull(amt)}
              setShowQR={setShowQR}
            />
          ) : (
            <RepayPanel
              isLoggedIn={!!isLoggedIn}
              loadingNetwork={loadingNetwork}
              onConnect={() => setShowAuthFlow(true)}
              onRepay={(amt) => handleRepay(amt)}
            />
          )}
      </div>
    </TooltipProvider>
  )
}
