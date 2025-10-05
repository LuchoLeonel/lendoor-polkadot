'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { InfoTip } from '@/components/common/InfoTooltip'
import { CenteredAmountInput } from '../common/CenteredAmountInput'
import { Card } from '@/components/ui/card'
import { ChevronDown, ChevronUp, Info, ShieldCheck } from 'lucide-react'
import { BorrowLimitKPI } from '../kpi/Limit'
import { CreditScoreKPI } from '../kpi/Score'
import { BaseApyKPI } from '../kpi/BaseAPY'
import UserJourneyBadge from '../common/UserJourneyBadge'
import { useUserJourney } from '../providers/UserProvider'
import { useVault } from '../providers/VaultProvider'
import { formatUnits, parseUnits } from 'ethers'
import ExpandedMenu from './ExpandedMenu'

type PullPanelProps = {
  isLoggedIn: boolean,
  loadingNetwork: boolean,
  onConnect: () => void,
  onPull: (amount: string) => void,
  maxPullLabel?: string // ej: "MAX PULL 0"
  setShowQR: (show: boolean) => void,
}

export function PullPanel({
  isLoggedIn,
  loadingNetwork,
  onConnect,
  onPull,
  maxPullLabel = 'MAX PULL: ',
  setShowQR
}: PullPanelProps) {
  const [amount, setAmount] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const { ready, value, isVerified } = useUserJourney();
  const { evault, evaultAddress, connectedAddress, usdc, controller } = useVault();
  const [submitting, setSubmitting] = useState(false);
  const [balance, setBalance] = useState("0");
  

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoggedIn) return onConnect()
    if (ready && !isVerified) return setShowQR(true);
    if (!amount) return
    if (!evault) {
      throw Error('No se pudo instanciar el contrato (evault).')
      return
    }
    
    try {
      setSubmitting(true)

      const amountBN = parseUnits(amount, 4)
      console.log(amountBN);
      const tx1= await controller.enableController(connectedAddress, evaultAddress);
      await tx1.wait()
      const tx = await evault.borrow(amountBN, connectedAddress);
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

  const cta = !isLoggedIn && !loadingNetwork ? 'Connect Wallet' : 'Borrow now';
  
  let borrowed = 100;
  let borrowLimit = 1000;
  let toBorrow = borrowLimit - borrowed;
  let score = "120/255";
  return (
    <>
        <div className="grid grid-cols-4 gap-2 w-full mx-auto">
          <BaseApyKPI value="6.82%" />
          <BorrowLimitKPI value={`${borrowed}/${borrowLimit}`} />
          <CreditScoreKPI value={score} />
        </div>

        {/* Panel principal (monta el componente según tab) */}
        <Card className="p-4 border-2 border-border/50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-muted-foreground font-mono">
              BORROW BANK-FREE
            </span>

            {/* 👇 Badge de identidad verificada */}
            {isVerified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-semibold">
                <ShieldCheck className="w-3 h-3" />
                Identity Verified
              </span>
            )}
          </div>
          <div className="mb-4">
            {/* form ahora ocupa todo el ancho */}
            <form onSubmit={submit} className="w-full">
              <CenteredAmountInput value={amount} onChange={setAmount}  symbol='¢' />
              <div className="mt-1 mb-4 text-xs text-muted-foreground text-center">
                {maxPullLabel}{toBorrow}{" USDC"}
              </div>

              {/* botón full width */}
              <Button
                type="submit"
                disabled={!amount || submitting}
                className="mt-3 w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 cursor-pointer text-base font-semibold"
              >
                {ready && (value === "verify_identity" || value === "borrow") && <UserJourneyBadge/>}
                {cta}
              </Button>
            </form>
          </div>

          <div className="space-y-2 mb-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                TX Cost <InfoTip label="Estimated gas for this pull." variant="light" />
              </span>
              <span className="text-xs">-</span>
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

            {isExpanded && ( <ExpandedMenu score={score} /> )}
          </div>
        </Card>
        </>
  )
}
