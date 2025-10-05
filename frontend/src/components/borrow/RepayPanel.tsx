'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { InfoTip } from '@/components/common/InfoTooltip'
import { CenteredAmountInput } from '../common/CenteredAmountInput'
import { Card } from '@/components/ui/card'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { BaseApyKPI } from '../kpi/BaseAPY'
import { OutstandingKPI } from '../kpi/Outstanding'
import { CreditScoreKPI } from '../kpi/Score'
import UserJourneyBadge from '../common/UserJourneyBadge'
import { useUserJourney } from '../providers/UserProvider'
import ExpandedMenu from './ExpandedMenu'
import { useVault } from '../providers/VaultProvider'
import { formatUnits, parseUnits } from 'ethers'

type RepayPanelProps = {
  isLoggedIn: boolean,
  loadingNetwork: boolean,
  onConnect: () => void,
  onRepay: (amount: string) => void,
  outstandingLabel?: string,
}

export function RepayPanel({
  isLoggedIn,
  loadingNetwork,
  onConnect,
  onRepay,
  outstandingLabel = 'OUSTANDING: ',
}: RepayPanelProps) {
  const [amount, setAmount] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const { ready, value } = useUserJourney();
  const [submitting, setSubmitting] = useState(false);
  const { evault, evaultAddress, connectedAddress, usdc, controller } = useVault();
  const [balance, setBalance] = useState("0");

  const submit = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!isLoggedIn) return onConnect()
      if (!amount) return
      if (!evault) {
        throw Error('No se pudo instanciar el contrato (evault).')
        return
      }
      
      try {
        setSubmitting(true)
  
        const amountBN = parseUnits(amount, 4)
        console.log(amountBN);
        const tx1 = await usdc.approve(evaultAddress, amountBN);
        const tx = await evault.repay(amountBN, connectedAddress);
        await tx.wait()
      } catch (err: any) {
        console.error(err)
        throw Error('Transaction failed.');
      } finally {
        setSubmitting(false)
      }
  
    }

    useEffect(() => {
      if (submitting) return;
      let alive = true
      ;(async () => {
        if (!evault || !connectedAddress) return
        try {
          // (si tiene decimals, usalo; si no, 18)
          const dec =
            typeof (evault as any).decimals === 'function'
              ? Number(await (evault as any).decimals())
              : 18
  
          const bal: bigint = await (evault as any).debtOf(connectedAddress)
          const next = formatUnits(bal, dec)
          // Evitar re-render si no cambió
          setBalance(prev => (prev === next ? prev : next))
        } catch (e) {
          console.error('read balanceOf:', e)
        }
      })()
      return () => {
        alive = false
      }
      // 🔑 dependé del address estable y del usuario, NO del objeto contrato
    }, [evaultAddress, connectedAddress, submitting])

  const cta = !isLoggedIn && !loadingNetwork ? 'Connect Wallet' : 'Repay'

  return (
    <>
        <div className="grid grid-cols-4 gap-2 w-full mx-auto">
          <BaseApyKPI value="6.82%" />
          <OutstandingKPI value={balance} />
          <CreditScoreKPI value="120/255" />
        </div>

        {/* Panel principal (monta el componente según tab) */}
        <Card className="p-4 border-2 border-border/50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-muted-foreground font-mono">
              EARN BY LENDING
            </span>
          </div>
          <div className="mb-4">
            {/* 👇 form ahora ocupa todo el ancho */}
            <form onSubmit={submit} className="w-full">
              <CenteredAmountInput value={amount} onChange={setAmount} symbol='¢' />

              <div className="mt-1 mb-4 text-xs text-muted-foreground text-center">
                {outstandingLabel}{balance}
              </div>

              {/* 👇 ahora sí, ocupa todo el ancho */}
              <Button
                type="submit"
                className="mt-3 w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 cursor-pointer text-base font-semibold"
              >
                {ready && (value === "repay") && <UserJourneyBadge/>}
                {cta}
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
          {/* Collapsible Credit Info */}
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

            {isExpanded && <ExpandedMenu score="120/255" /> }
          </div>
        </Card>
        </>
  )
}
