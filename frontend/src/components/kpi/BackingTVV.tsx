'use client'

import * as React from 'react'
import { InfoTip } from '@/components/common/InfoTooltip'

type BackingTVVKPIProps = {
  /** Valor a mostrar, ej: "10.4M" */
  value: string
  /** Label del KPI (por defecto "Backing TVV") */
  label?: string
  /** Contenido custom del tooltip (si no pasás, usa el default) */
  tooltipContent?: React.ReactNode
  /** Clases extra para el contenedor (ej: col-span) */
  containerClassName?: string
  /** Clases extra para el valor (color/tipografía) */
  valueClassName?: string
}

export function BackingTVVKPI({
  value,
  label = 'Backing TVV',
  tooltipContent,
  containerClassName = 'col-span-2',
  valueClassName = '',
}: BackingTVVKPIProps) {
  const defaultTooltip = (
    <div>
      <div className="font-semibold">Backing TVV</div>
      <ul className="mt-2 list-none pl-0 space-y-2">
        <li>Total Verified Value backing the Lendoor credit lines.</li>
        <li>Includes verified DeFi on-chain assets and off-chain bank assets.</li>
        <li>Represents backing capacity and overall market health.</li>
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
