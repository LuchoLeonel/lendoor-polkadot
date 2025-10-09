'use client'

import * as React from 'react'
import { InfoTip } from '@/components/common/InfoTooltip'
import { useUser } from '@/providers/UserProvider'

type CreditScoreKPIProps = {
  label?: string
  tooltipContent?: React.ReactNode
  containerClassName?: string
  valueClassName?: string
}

export function CreditScoreKPI({
  label = 'Score',
  tooltipContent,
  containerClassName = 'col-span-1',
  valueClassName = '',
}: CreditScoreKPIProps) {
  const { creditScoreDisplay } = useUser();

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
      <div className={`text-sm font-bold leading-none ${valueClassName}`}>{creditScoreDisplay}</div>
    </div>
  )
}