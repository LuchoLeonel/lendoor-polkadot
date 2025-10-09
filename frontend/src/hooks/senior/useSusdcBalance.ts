'use client'

import * as React from 'react'
import { useContracts } from '@/providers/ContractsProvider'
import { formatUSDCAmount2dp } from '@/lib/utils'

export function useSusdcBalance(pollMs = 10_000) {
  const { evault, connectedAddress } = useContracts()
  const [raw, setRaw] = React.useState<bigint | null>(null)
  const [display, setDisplay] = React.useState<string>('—')
  const [loading, setLoading] = React.useState(false)

  const read = React.useCallback(async () => {
    if (!evault || !connectedAddress) {
      setRaw(null)
      setDisplay('—')
      return
    }
    setLoading(true)
    try {
      const r: bigint = await (evault as any).balanceOf(connectedAddress)
      setRaw(r)
      const pretty = formatUSDCAmount2dp(r)
      setDisplay(prev => (prev === pretty ? prev : pretty))
    } catch {
      setRaw(null)
      setDisplay('—')
    } finally {
      setLoading(false)
    }
  }, [evault, connectedAddress])

  React.useEffect(() => {
    void read()
    if (!pollMs) return
    const id = setInterval(() => void read(), pollMs)
    return () => clearInterval(id)
  }, [read, pollMs])

  return { raw, display, loading, refresh: read }
}
