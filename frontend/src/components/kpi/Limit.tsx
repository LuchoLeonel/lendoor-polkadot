'use client'

import { InfoTip } from '@/components/common/InfoTooltip'
import { useUser } from '@/providers/UserProvider'

type BorrowLimitKPIProps = {
  containerClassName?: string
  valueClassName?: string
  clmAddress?: `0x${string}`
}

export function BorrowLimitKPI({
  containerClassName = 'col-span-2',
  valueClassName = 'text-green-600',
}: BorrowLimitKPIProps) {
  const { creditLimitDisplay } = useUser();

  return (
    <div
      className={`${containerClassName} h-14 px-3 py-1 rounded-lg border border-border/50 bg-card shadow-sm flex flex-col items-center justify-center`}
    >
      <div className="flex items-center justify-center gap-1 mb-2">
        <span className="text-xs text-muted-foreground">Limit</span>
        <InfoTip
          contentClassName="font-display text-[11px] leading-snug"
          label={
            <div>
              <div className="font-semibold">Borrow Limit</div>
              <ul className="mt-2 list-none pl-0 space-y-2">
                <li>Shows your current credit line and remaining capacity to draw.</li>
                <li>
                  <span className="font-medium">Example:</span> 0 / 1000 USDC.
                </li>
                <li>
                  <span className="font-medium">Available to draw</span> = limit − outstanding principal − pending draws.
                </li>
                <li>The limit can increase with a higher score and verified backing (on/off-chain).</li>
              </ul>
            </div>
          }
        />
      </div>
      <div className={`text-sm font-bold leading-none ${valueClassName}`}>
        {creditLimitDisplay}
      </div>
    </div>
  )
}
