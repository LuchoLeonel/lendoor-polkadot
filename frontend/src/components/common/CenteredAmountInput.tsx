'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import UserJourneyBadge from './UserJourneyBadge'

type Props = {
  value: string
  onChange: (next: string) => void
  symbol?: string
  className?: string
  showBadge: boolean
}

export function CenteredAmountInput({
  value,
  onChange,
  symbol = '$',
  className,
  showBadge,
}: Props) {
  const measureRef = useRef<HTMLSpanElement>(null)
  const [px, setPx] = useState<number>(0)

  const display = useMemo(() => (value?.length ? value : '0'), [value])

  useLayoutEffect(() => {
    const el = measureRef.current
    if (!el) return
    // Small padding so the caret doesn’t clip
    setPx(el.offsetWidth + 4)
  }, [display])

  return (
    <div className="w-full">
      {/* Relative w-fit wrapper keeps the whole amount centered; absolute badge won’t affect centering */}
      <div className="relative mx-auto w-fit">
        {showBadge && (
          <div
            className="
              pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2
              flex items-center
            "
          >
            <UserJourneyBadge />
          </div>
        )}

        {/* Inline content that actually defines the centered width */}
        <div className="flex w-fit items-baseline gap-1">
          <span className="text-4xl font-bold text-primary">{symbol}</span>

          {/* Input with width driven by hidden measurer */}
          <div className="relative">
            <input
              inputMode="decimal"
              placeholder="0"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              style={{ width: px ? `${px}px` : undefined }}
              className={[
                'bg-transparent outline-none border-none text-4xl font-bold text-primary',
                'text-left placeholder:text-primary/50 [font-variant-numeric:tabular-nums]',
                className ?? '',
              ].join(' ')}
              aria-label="Amount"
            />
            {/* Invisible measurer (same typography as input) */}
            <span
              ref={measureRef}
              className="
                pointer-events-none absolute left-0 top-0 invisible whitespace-pre
                text-4xl font-bold [font-variant-numeric:tabular-nums]
              "
            >
              {display}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
