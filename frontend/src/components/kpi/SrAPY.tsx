'use client'

import * as React from 'react'
import { InfoTip } from '@/components/common/InfoTooltip'

type SrApyKPIProps = {
  /** Valor a mostrar, ej: "10%" */
  value: string
  /** Label del KPI (por defecto "SR APY") */
  label?: string
  /** Token/tranche para el tooltip (por defecto "sUSDC (Senior)") */
  tokenLabel?: string
  /** Contenido custom del tooltip (si no pasás, usa el default) */
  tooltipContent?: React.ReactNode
  /** Clases extra para el contenedor (ej: col-span) */
  containerClassName?: string
  /** Clases extra para el valor (color/tipografía) */
  valueClassName?: string
}

export function SrApyKPI({
  value,
  label = 'SR APY',
  tokenLabel = 'sUSDC (Senior)',
  tooltipContent,
  containerClassName = 'col-span-1',
  valueClassName = 'text-green-600',
}: SrApyKPIProps) {
  const defaultTooltip = (
    <div>
      <div className="font-semibold">SR APY — {tokenLabel}</div>
      <ul className="mt-2 list-none pl-0 space-y-2 text-[11px] leading-snug">
        <li>~80% of the pool; lower risk.</li>
        <li>Permissionless deposits: USDC → sUSDC (ERC-4626).</li>
        <li>Senior claim on interest repayments and real-time liquidity based on reserves.</li>
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
