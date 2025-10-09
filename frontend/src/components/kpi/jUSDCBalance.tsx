'use client'

import * as React from 'react'
import { InfoTip } from '@/components/common/InfoTooltip'
import { useUser } from '@/providers/UserProvider'

type Props = {
  label?: string
  tokenSymbol?: string
  tooltipContent?: React.ReactNode
  containerClassName?: string
  valueClassName?: string
  pollMs?: number
}

export function JusdcBalanceKPI({
  label = 'jUSDC',
  tokenSymbol = 'jUSDC',
  tooltipContent,
  containerClassName = 'col-span-1',
  valueClassName = 'text-green-600',
}: Props) {
  const { jusdcDisplay } = useUser();

  const defaultTooltip = (
    <div>
      <div className="font-semibold">{tokenSymbol} Balance</div>
      <ul className="mt-2 list-none pl-0 space-y-2 text-[11px] leading-snug">
        <li>Amount of {tokenSymbol} you currently hold.</li>
        <li>{tokenSymbol} represents the junior tranche (levered yield, higher risk).</li>
        <li>Minted by staking senior liquidity via ERC-4626 mechanics.</li>
        <li>Subject to market-specific rules.</li>
      </ul>
    </div>
  )

  return (
    <div className={`${containerClassName} h-14 px-3 py-1 rounded-lg border border-border/50 bg-card shadow-sm flex flex-col items-center justify-center`}>
      <div className="flex items-center justify-center gap-1 mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <InfoTip contentClassName="font-display text-[11px] leading-snug" label={tooltipContent ?? defaultTooltip} />
      </div>
      <div className={`text-sm font-bold leading-none ${valueClassName}`}>{jusdcDisplay}</div>
    </div>
  )
}