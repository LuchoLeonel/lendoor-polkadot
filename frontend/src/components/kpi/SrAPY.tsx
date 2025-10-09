'use client'

import { InfoTip } from '@/components/common/InfoTooltip';
import { useUser } from '@/providers/UserProvider';


type Props = {
  label?: string
  tokenLabel?: string
  tooltipContent?: React.ReactNode
  containerClassName?: string
  valueClassName?: string
  pollMs?: number
  irmAddress?: `0x${string}` | null
}

export function SrApyKPI({
  label = 'SR APY',
  tokenLabel = 'sUSDC (Senior)',
  tooltipContent,
  containerClassName = 'col-span-1',
  valueClassName = 'text-green-600',
}: Props) {
  const { seniorApyDisplay } = useUser();

  const defaultTooltip = (
    <div>
      <div className="font-semibold">SR APY — {tokenLabel}</div>
      <ul className="mt-2 list-none pl-0 space-y-2 text-[11px] leading-snug">
        <li>Lower-risk senior tranche.</li>
        <li>USDC → sUSDC (ERC-4626).</li>
        <li>APY computed from IRM rate or psSeniorRay drift.</li>
      </ul>
    </div>
  )

  return (
    <div className={`${containerClassName} h-14 px-3 py-1 rounded-lg border border-border/50 bg-card shadow-sm flex flex-col items-center justify-center`}>
      <div className="flex items-center justify-center gap-1 mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <InfoTip contentClassName="font-display text-[11px] leading-snug" label={tooltipContent ?? defaultTooltip} />
      </div>
      <div className={`text-sm font-bold leading-none ${valueClassName}`}>10%</div>
    </div>
  )
}
