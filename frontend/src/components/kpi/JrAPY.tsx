'use client'

import { InfoTip } from '@/components/common/InfoTooltip'
import { useUser } from '@/providers/UserProvider'

type Props = {
  label?: string
  tokenLabel?: string
  tooltipContent?: React.ReactNode
  containerClassName?: string
  valueClassName?: string
  pollMs?: number
}

export function JrApyKPI({
  label = 'JR APY',
  tokenLabel = 'jUSDC (Junior)',
  tooltipContent,
  containerClassName = 'col-span-1',
  valueClassName = 'text-green-600',
}: Props) {
  const { juniorApyDisplay } = useUser();

  const defaultTooltip = (
    <div>
      <div className="font-semibold">JR APY — {tokenLabel}</div>
      <div className="mt-2 space-y-2 text-[11px] leading-snug">
        <div>Higher risk, higher yield (junior tranche).</div>
        <div>Stake sUSDC → jUSDC (ERC-4626 wrapper).</div>
        <div>APY derived from psJuniorRay drift over time.</div>
      </div>
    </div>
  )

  return (
    <div className={`${containerClassName} h-14 px-3 py-1 rounded-lg border border-border/50 bg-card shadow-sm flex flex-col items-center justify-center`}>
      <div className="flex items-center justify-center gap-1 mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <InfoTip contentClassName="font-display text-[11px] leading-snug" label={tooltipContent ?? defaultTooltip} />
      </div>
      <div className={`text-sm font-bold leading-none ${valueClassName}`}>20%</div>
    </div>
  )
}