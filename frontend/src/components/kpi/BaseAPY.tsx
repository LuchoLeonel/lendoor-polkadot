'use client'

import * as React from 'react'
import { InfoTip } from '@/components/common/InfoTooltip'

type BaseApyKPIProps = {
  /** Valor a mostrar, ej: "6.82%" */
  value: string
  /** Label del KPI (por defecto "Base APY") */
  label?: string
  /** Contenido custom del tooltip (si no pasás, usa el default) */
  tooltipContent?: React.ReactNode
  /** Clases extra para el contenedor (ej: col-span) */
  containerClassName?: string
  /** Clases extra para el valor (color/tipografía) */
  valueClassName?: string
}

export function BaseApyKPI({
  value,
  label = 'Base APY',
  tooltipContent,
  containerClassName = 'col-span-1',
  valueClassName = '',
}: BaseApyKPIProps) {
  const defaultTooltip = (
    <div>
      <div className="font-semibold">Base APY</div>
      <ul className="mt-2 list-none pl-0 space-y-2">
        <li>Baseline borrowing rate for this market.</li>
        <li>Final borrow APY = Base APY ± risk spread.</li>
        <li>Spread depends on your score, market utilization, and term.</li>
        <li>Rate can update when your score or market conditions change.</li>
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
