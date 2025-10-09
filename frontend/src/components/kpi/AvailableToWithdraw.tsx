'use client'

import * as React from 'react'
import { InfoTip } from '@/components/common/InfoTooltip'

type AvailableToWithdrawKPIProps = {
  value: string
  label?: String
  tooltipContent?: React.ReactNode
  containerClassName?: string
  valueClassName?: string
}

export function AvailableToWithdrawKPI({
  value,
  label = 'Available to Withdraw',
  tooltipContent,
  containerClassName = 'col-span-2',
  valueClassName = 'text-base font-bold',
}: AvailableToWithdrawKPIProps) {
  const defaultTooltip = (
    <div>
      <div className="font-semibold">Available to Withdraw</div>
      <ul className="mt-2 list-none pl-0 space-y-2">
        <li>Amount you can withdraw right now from the market.</li>
        <li>Subject to real-time reserves and any withdrawal queues.</li>
        <li>Some tranches (e.g., Junior) may include cooldowns or delays.</li>
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
      <div className={`leading-none ${valueClassName}`}>{value}</div>
    </div>
  )
}
