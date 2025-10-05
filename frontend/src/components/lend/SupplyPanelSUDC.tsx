'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { InfoTip } from '@/components/common/InfoTooltip'
import { CenteredAmountInput } from '@/components/common/CenteredAmountInput'
import { JrApyKPI } from '@/components/kpi/JrAPY'
import { BackingTVVKPI } from '@/components/kpi/BackingTVV'
import { SrApyKPI } from '@/components/kpi/SrAPY'
import UserJourneyBadge from '../common/UserJourneyBadge'
import { useUserJourney } from '../providers/UserProvider'
import { formatUnits, parseUnits } from 'ethers'
import { useVault } from '../providers/VaultProvider'
import { JusdcBalanceKPI } from '../kpi/jUSDCBalance'
import { SusdcBalanceKPI } from '../kpi/sUSDCBalance'
import { JusdcExchangeRateKPI } from '../kpi/ExchangeRatejUSDC'
import { ExchangeRateKPI } from '../kpi/ExchangeRatesUSDC'

type SupplyPanelProps = {
  isLoggedIn: boolean
  loadingNetwork: boolean
  onConnect: () => void
  onSupply: (amount: string) => void
  supplyCapLabel?: string // ej: "SUPPLY CAP $10.000"
}

export function SupplyPanelSUSDC({
  isLoggedIn,
  loadingNetwork,
  onConnect,
  onSupply,
  supplyCapLabel = 'SUPPLY CAP $10.000',
}: SupplyPanelProps) {
  const [amount, setAmount] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const { ready, value } = useUserJourney();
  const [submitting, setSubmitting] = useState(false);
  const [balance, setBalance] = useState("0");
  const { evault, evaultAddress, evaultJunior, evaultJuniorAddress, connectedAddress } = useVault();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoggedIn) return onConnect()
    if (!amount) return
    if (!evault) {
      throw Error('No se pudo instanciar el contrato (evault).')
      return
    }

      setSubmitting(true)
      try {

      const amountBN = parseUnits(amount, 4)
      console.log(amountBN);
        const tx = await evault.approve(evaultJuniorAddress, amountBN)
        await tx.wait()
        const tx2 = await evaultJunior!.deposit(amountBN, connectedAddress);
        await tx2.wait()
      } catch (err) {
        console.error(err);
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
  
          const bal: bigint = await (evaultJunior as any).balanceOf(connectedAddress)
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

  const cta = !isLoggedIn && !loadingNetwork ? 'Connect Wallet' : 'Supply Liquidity'

  return (
    <>
      {/* KPIs específicos de Lend */}
      <div className="grid grid-cols-4 gap-2 w-full mx-auto">
        <JrApyKPI value="20%" />
        <BackingTVVKPI value="10.4M" />
        <JusdcBalanceKPI value={balance} />
      </div>

      <Card className="p-4 border-2 border-border/50">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-muted-foreground font-mono">EARN BY LENDING</span>
        </div>

        <form onSubmit={submit} className="w-full">
            <CenteredAmountInput value={amount} onChange={setAmount} symbol="¢" />
            <div className="mt-1 mb-4 text-xs text-muted-foreground text-center">
            {supplyCapLabel}
            </div>

            {/* botón full width */}
            <Button
            type="submit"
            disabled={!amount || submitting }
            className="mt-3 w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 cursor-pointer text-base font-semibold"
            >
            {ready && (value === "supply_liquidity") && <UserJourneyBadge/>}
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

        {/* Collapsible Info */}
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
                  <span className="text-xs">USDC / sUSDC</span>
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
