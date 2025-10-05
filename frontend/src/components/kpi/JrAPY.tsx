'use client'

import * as React from 'react'
import { InfoTip } from '@/components/common/InfoTooltip'

type JrApyKPIProps = {
  /** Valor a mostrar, ej: "20%" */
  value: string
  /** Label del KPI (por defecto "JR APY") */
  label?: string
  /** Token/tranche label para el tooltip (ej: "jUSDC (Junior)") */
  tokenLabel?: string
  /** Tooltip custom (si no pasás, usa el default) */
  tooltipContent?: React.ReactNode
  /** Clases extra para el contenedor (ej: col-span) */
  containerClassName?: string
  /** Clases extra para el valor (color/tipografía) */
  valueClassName?: string
}

export function JrApyKPI({
  value,
  label = 'JR APY',
  tokenLabel = 'jUSDC (Junior)',
  tooltipContent,
  containerClassName = 'col-span-1',
  valueClassName = 'text-green-600',
}: JrApyKPIProps) {
  const defaultTooltip = (
    <div>
      <div className="font-semibold">JR APY — {tokenLabel}</div>
      <div className="mt-2 space-y-2 text-[11px] leading-snug">
        <div>~15–20% of the pool; higher risk, higher yield.</div>
        <div>Stake sUSDC → jUSDC (ERC-4626) for levered yield on the credit-line pool.</div>
        <div>Absorbs first losses on defaults (net recoveries) and includes a cooldown before redeeming to USDC.</div>
      </div>
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
