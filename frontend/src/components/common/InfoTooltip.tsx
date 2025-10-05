'use client'

import * as React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils' // si no tenés cn, podés concatenar strings

type InfoTipProps = {
  label: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  children?: React.ReactNode
  triggerClassName?: string
  iconClassName?: string
  /** estilo del tooltip */
  variant?: 'default' | 'light'
  /** clases extra para el contenido (por ej. tu fuente) */
  contentClassName?: string
  sideOffset?: number
  /** ocultar el ícono por defecto (si no pasás children) */
  showIcon?: boolean
  /** mostrar el ícono sólo on-hover (si no pasás children) */
  hoverOnly?: boolean
}

export function InfoTip({
  label,
  side = 'bottom',
  align = 'center',
  children,
  triggerClassName,
  iconClassName,
  variant = 'light',
  contentClassName,
  sideOffset = 6,
  showIcon = true,
  hoverOnly = false,
}: InfoTipProps) {
  const contentBase =
    'max-w-[320px] text-xs leading-snug rounded-md shadow-md border px-3 py-2 pt-4 z-50 mono-text'
  const variants: Record<NonNullable<InfoTipProps['variant']>, string> = {
    default: 'bg-popover text-popover-foreground border-border',
    light: 'bg-white text-neutral-900 border-primary/60 dark:border-primary/70',
  }

  const defaultTrigger = (
    <span className={cn('inline-flex items-center', triggerClassName)}>
      {showIcon && (
        <Info
          className={cn(
            'h-3 w-3 text-muted-foreground transition-opacity',
            hoverOnly ? 'opacity-0 group-hover:opacity-100' : '',
            iconClassName
          )}
        />
      )}
    </span>
  )

  const triggerNode = children ? (
    // Usás tu propio trigger
    <>{children}</>
  ) : hoverOnly ? (
    // Para hoverOnly necesitamos un contenedor con .group
    <span className={cn('group inline-flex items-center', triggerClassName)}>
      {defaultTrigger}
    </span>
  ) : (
    defaultTrigger
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{triggerNode}</TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cn(contentBase, variants[variant], contentClassName)}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
