'use client'

import * as React from 'react'
import { InfoTip } from '@/components/common/InfoTooltip'

type SusdcBalanceKPIProps = {
  /** Balance a mostrar, ej: "987.65 sUSDC" */
  value: string
  /** Label del KPI (por defecto "sUSDC Balance") */
  label?: string
  /** Símbolo/token a mostrar en el tooltip (por defecto "sUSDC") */
  tokenSymbol?: string
  /** Tooltip custom (si no pasás, usa el default) */
  tooltipContent?: React.ReactNode
  /** Clases extra para el contenedor (ej: col-span) */
  containerClassName?: string
  /** Clases extra para el valor (color/tipografía) */
  valueClassName?: string
}

export function SusdcBalanceKPI({
  value,
  label = 'sUSDC',
  tokenSymbol = 'sUSDC',
  tooltipContent,
  containerClassName = 'col-span-1',
  valueClassName = 'text-green-600',
}: SusdcBalanceKPIProps) {
  const defaultTooltip = (
    <div>
      <div className="font-semibold">{tokenSymbol} Balance</div>
      <ul className="mt-2 list-none pl-0 space-y-2 text-[11px] leading-snug">
        <li>Amount of {tokenSymbol} you currently hold (senior tranche).</li>
        <li>Lower risk; senior claim on interest repayments from the pool.</li>
        <li>Permissionless deposits: USDC → {tokenSymbol} (ERC-4626 vault).</li>
        <li>Real-time liquidity subject to market reserves and conditions.</li>
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
