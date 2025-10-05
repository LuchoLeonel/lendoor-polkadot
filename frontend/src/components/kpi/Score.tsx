'use client'

import { InfoTip } from '@/components/common/InfoTooltip'
import * as React from 'react'

type CreditScoreKPIProps = {
  /** Texto del valor, ej: "120/255" */
  value: string
  /** Label del KPI (por defecto "Score") */
  label?: string
  /** Contenido custom del tooltip (si no pasás, usa el default) */
  tooltipContent?: React.ReactNode
  /** Clases extra para el contenedor (ej: col-span) */
  containerClassName?: string
  /** Clases extra para el valor (color/tipografía) */
  valueClassName?: string
}

export function CreditScoreKPI({
  value,
  label = 'Score',
  tooltipContent,
  containerClassName = 'col-span-1',
  valueClassName = '',
}: CreditScoreKPIProps) {
  const defaultTooltip = (
    <div>
      <div className="font-semibold">Credit Score</div>
      <ul className="mt-2 list-none pl-0 space-y-2">
        <li>Reputation-based score used to size limits and price risk.</li>
        <li>Factors: on-chain repayment history, utilization & delinquencies, account age.</li>
        <li>Verified backing/income and optional off-chain credit can boost score.</li>
        <li>Higher score → higher limit & lower spread.</li>
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
