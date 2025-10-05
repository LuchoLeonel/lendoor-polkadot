'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (next: string) => void
  symbol?: string
  className?: string
}

export function CenteredAmountInput({ value, onChange, symbol = '$', className }: Props) {
  const measureRef = useRef<HTMLSpanElement>(null)
  const [px, setPx] = useState<number>(0)

  const display = useMemo(() => (value?.length ? value : '0'), [value])

  useLayoutEffect(() => {
    const el = measureRef.current
    if (!el) return
    setPx(el.offsetWidth + 4) // colchón para el caret
  }, [display]) 

  return (
    <div className="w-full">
      {/* 👇 bloque centrado por su propio ancho */}
      <div className="mx-auto flex w-fit items-baseline gap-1">
        <span className="text-4xl font-bold text-primary">{symbol}</span>

        {/* Input con ancho = texto medido */}
        <div className="relative">
          <input
            inputMode="decimal"
            placeholder="0"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: px ? `${px}px` : undefined }}
            className={
              'bg-transparent outline-none border-none text-4xl font-bold text-primary ' +
              'text-left placeholder:text-primary/50 [font-variant-numeric:tabular-nums] ' +
              (className ?? '')
            }
            aria-label="Amount"
          />
          {/* medidor invisible con la misma tipografía */}
          <span
            ref={measureRef}
            className="pointer-events-none absolute left-0 top-0 invisible whitespace-pre
                       text-4xl font-bold [font-variant-numeric:tabular-nums]"
          >
            {display}
          </span>
        </div>
      </div>
    </div>
  )
}
