'use client'

import { InfoTip } from '@/components/common/InfoTooltip'

type OutstandingKPIProps = {
  value: string
  containerClassName?: string
  valueClassName?: string
}

export function OutstandingKPI({
  value,
  containerClassName = 'col-span-2',
  valueClassName = 'text-green-600',
}: OutstandingKPIProps) {
  return (
    <div
      className={`${containerClassName} h-14 px-3 py-1 rounded-lg border border-border/50 bg-card shadow-sm flex flex-col items-center justify-center`}
    >
      <div className="flex items-center justify-center gap-1 mb-2">
        <span className="text-xs text-muted-foreground">Outstanding</span>
        <InfoTip
          contentClassName="font-display text-[11px] leading-snug"
          label={
            <div>
              <div className="font-semibold">Outstanding Balance</div>
              <ul className="mt-2 list-none pl-0 space-y-2">
                <li>The amount you currently owe.</li>
                <li>Includes <span className="font-medium">principal</span> + <span className="font-medium">accrued interest</span> (market dependent).</li>
                <li>Repayments typically apply to interest first, then principal.</li>
              </ul>
            </div>
          }
        />
      </div>
      <div className={`text-sm font-bold leading-none ${valueClassName}`}>{value}</div>
    </div>
  )
}
