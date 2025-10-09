'use client'

import * as React from 'react'
import { useContracts } from '@/providers/ContractsProvider'
import { formatUSDCAmount2dp } from '@/lib/utils'

export function useJusdcBalance(pollMs = 10_000) {
  const { evaultJunior, connectedAddress } = useContracts()
  const [raw, setRaw] = React.useState<bigint | null>(null)
  const [display, setDisplay] = React.useState<string>('—')
  const [loading, setLoading] = React.useState(false)

  const read = React.useCallback(async () => {
    if (!evaultJunior || !connectedAddress) {
      setRaw(null)
      setDisplay('—')
      return
    }
    setLoading(true)
    try {
      const r: bigint = await (evaultJunior as any).balanceOf(connectedAddress)
      setRaw(r)
      const pretty = formatUSDCAmount2dp(r)
      setDisplay(prev => (prev === pretty ? prev : pretty))
    } catch {
      setRaw(null)
      setDisplay('—')
    } finally {
      setLoading(false)
    }
  }, [evaultJunior, connectedAddress])

  React.useEffect(() => {
    void read()
    if (!pollMs) return
    const id = setInterval(() => void read(), pollMs)
    return () => clearInterval(id)
  }, [read, pollMs])

  return { raw, display, loading, refresh: read }
}