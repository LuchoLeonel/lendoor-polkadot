'use client'

import * as React from 'react'
import { InfoTip } from '@/components/common/InfoTooltip'
import { useUser } from '@/providers/UserProvider'

type Props = {
  label?: string
  baseSymbol?: string
  quoteSymbol?: string
  tooltipContent?: React.ReactNode
  containerClassName?: string
  valueClassName?: string
  pollMs?: number
  value?: string
}

export function JusdcExchangeRateKPI({
  label = 'jUSDC/sUSDC',
  baseSymbol = 'jUSDC',
  quoteSymbol = 'sUSDC',
  tooltipContent,
  containerClassName = 'col-span-1',
  valueClassName = 'text-green-600',
}: Props) {
  const { juniorExchangeRateDisplay } = useUser();

  const defaultTooltip = (
    <div>
      <div className="font-semibold">{label}</div>
      <ul className="mt-2 list-none pl-0 space-y-2 text-[11px] leading-snug">
        <li>Conversion derived from tranche share prices in the EVault.</li>
        <li>Shows how many {quoteSymbol} equal 1 {baseSymbol}.</li>
        <li>Excludes fees/slippage and redemption rules.</li>
      </ul>
    </div>
  )

  return (
    <div className={`${containerClassName} h-14 px-3 py-1 rounded-lg border border-border/50 bg-card shadow-sm flex flex-col items-center justify-center`}>
      <div className="flex items-center justify-center mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <InfoTip contentClassName="font-display text-[11px] leading-snug" label={tooltipContent ?? defaultTooltip} />
      </div>
      <div className={`text-sm font-bold leading-none ${valueClassName}`}>{juniorExchangeRateDisplay}</div>
    </div>
  )
}