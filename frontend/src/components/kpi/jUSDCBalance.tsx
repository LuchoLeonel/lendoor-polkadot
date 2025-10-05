'use client'

import * as React from 'react'
import { InfoTip } from '@/components/common/InfoTooltip'

type JusdcBalanceKPIProps = {
  /** Balance a mostrar, ej: "123.45 jUSDC" */
  value: string
  /** Label del KPI (por defecto "jUSDC Balance") */
  label?: string
  /** Símbolo/token a mostrar en el tooltip (por defecto "jUSDC") */
  tokenSymbol?: string
  /** Tooltip custom (si no pasás, usa el default) */
  tooltipContent?: React.ReactNode
  /** Clases extra para el contenedor (ej: col-span) */
  containerClassName?: string
  /** Clases extra para el valor (color/tipografía) */
  valueClassName?: string
}

export function JusdcBalanceKPI({
  value,
  label = 'jUSDC',
  tokenSymbol = 'jUSDC',
  tooltipContent,
  containerClassName = 'col-span-1',
  valueClassName = 'text-green-600',
}: JusdcBalanceKPIProps) {
  const defaultTooltip = (
    <div>
      <div className="font-semibold">{tokenSymbol} Balance</div>
      <ul className="mt-2 list-none pl-0 space-y-2 text-[11px] leading-snug">
        <li>Amount of {tokenSymbol} you currently hold.</li>
        <li>{tokenSymbol} represents the junior tranche (levered yield, higher risk).</li>
        <li>Minted by staking senior liquidity (e.g., sUSDC) via ERC-4626 vault mechanics.</li>
        <li>Subject to cooldown/withdrawal rules depending on the market.</li>
      </ul>
    </div>
  )

  return (
    <div
      className={`${containerClassName} h-14 px-3 py-1 rounded-lg border border-border/50 bg-card shadow-sm flex flex-col items-center justify-center`}
    >
      <div className="flex items-center justify-center gap-1 mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <InfoTip
          contentClassName="font-display text-[11px] leading-snug"
          label={tooltipContent ?? defaultTooltip}
        />
      </div>
      <div className={`text-sm font-bold leading-none ${valueClassName}`}>{value}</div>
    </div>
  )
}
