'use client'

import * as React from 'react'
import { InfoTip } from '@/components/common/InfoTooltip'

type JusdcExchangeRateKPIProps = {
  /** Texto a mostrar, ej: "1 jUSDC = 1.034 USDC" o solo "1.034" */
  value: string
  /** Label del KPI (por defecto "jUSDC/USDC") */
  label?: string
  /** Símbolos base/quote para el tooltip */
  baseSymbol?: string
  quoteSymbol?: string
  /** Tooltip custom (si no pasás, usa el default) */
  tooltipContent?: React.ReactNode
  /** Clases extra para el contenedor (ej: col-span) */
  containerClassName?: string
  /** Clases extra para el valor (color/tipografía) */
  valueClassName?: string
}

export function JusdcExchangeRateKPI({
  value,
  label = 'jUSDC/sUSDC',
  baseSymbol = 'jUSDC',
  quoteSymbol = 'sUSDC',
  tooltipContent,
  containerClassName = 'col-span-1',
  valueClassName = '',
}: JusdcExchangeRateKPIProps) {
  const defaultTooltip = (
    <div>
      <div className="font-semibold">{label}</div>
      <ul className="mt-2 list-none pl-0 space-y-2 text-[11px] leading-snug">
        <li>
          Current conversion between <span className="font-medium">{baseSymbol}</span> and{' '}
          <span className="font-medium">{quoteSymbol}</span>.
        </li>
        <li>Often derived from ERC-4626 share price (PPS) at the time of view.</li>
        <li>Excludes gas/fees and potential slippage; subject to market reserves/rules.</li>
        <li>Junior tranches may include cooldowns/delays for redemptions.</li>
      </ul>
    </div>
  )

  return (
    <div
      className={`${containerClassName} h-14 px-3 py-1 rounded-lg border border-border/50 bg-card shadow-sm flex flex-col items-center justify-center`}
    >
      <div className="flex items-center justify-center mb-2">
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
