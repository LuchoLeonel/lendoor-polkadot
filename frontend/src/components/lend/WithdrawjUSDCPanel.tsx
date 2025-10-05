'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { InfoTip } from '@/components/common/InfoTooltip'
import { CenteredAmountInput } from '@/components/common/CenteredAmountInput'
import { JrApyKPI } from '@/components/kpi/JrAPY'
import { BackingTVVKPI } from '@/components/kpi/BackingTVV'
import { SrApyKPI } from '@/components/kpi/SrAPY'
import { AvailableToWithdrawKPI } from '../kpi/AvailableToWithdraw'
import { JusdcBalanceKPI } from '../kpi/jUSDCBalance'
import { SusdcBalanceKPI } from '../kpi/sUSDCBalance'
import { JusdcExchangeRateKPI } from '../kpi/ExchangeRatejUSDC'
import UserJourneyBadge from '../common/UserJourneyBadge'
import { useUserJourney } from '../providers/UserProvider'
import { useVault } from '../providers/VaultProvider'
import { formatUnits, parseUnits } from 'ethers'

type WithdrawPanelProps = {
  isLoggedIn: boolean
  loadingNetwork: boolean
  onConnect: () => void
  onWithdraw: (amount: string) => void
  availableLabel?: string // ej: "AVAILABLE: $0"
}

export function WithdrawjUSDCPanel({
  isLoggedIn,
  loadingNetwork,
  onConnect,
  onWithdraw,
  availableLabel = 'AVAILABLE: $',
}: WithdrawPanelProps) {
  const [amount, setAmount] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const { ready, value } = useUserJourney();
  const [balance, setBalance] = useState("0");
  const [submitting, setSubmitting] = useState(false);
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
        const assets = parseUnits(amount, 4)
        console.log(assets);
        const tx2 = await evaultJunior!.demoteToSenior(assets, connectedAddress);
        await tx2.wait();
        await (await evaultJunior!.withdraw(assets, connectedAddress, connectedAddress)).wait()
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

  const cta = !isLoggedIn && !loadingNetwork ? 'Connect Wallet' : 'Withdraw Liquidity'
  let availableToWithdraw = 20;
  return (
    <>
      {/* KPIs (mismos que Supply; podés cambiarlos si necesitás) */}
      <div className="grid grid-cols-4 gap-2 w-full mx-auto">
        <JusdcBalanceKPI value={balance} />
        <AvailableToWithdrawKPI value={`${availableToWithdraw} USDC`} />
        <JusdcExchangeRateKPI value="1.107%" />
      </div>

      <Card className="p-4 border-2 border-border/50">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-muted-foreground font-mono">MANAGE LIQUIDITY</span>
        </div>

        <form onSubmit={submit} className="w-full">
            <CenteredAmountInput value={amount} onChange={setAmount} symbol="¢" />
            <div className="mt-1 mb-4 text-xs text-muted-foreground text-center">
            {availableLabel}{availableToWithdraw}
            </div>

            {/* botón full width */}
            <Button
            type="submit"
            className="mt-3 w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 cursor-pointer text-base font-semibold"
            >
            {ready && (value === "withdraw_jusdc") && <UserJourneyBadge/>}
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
