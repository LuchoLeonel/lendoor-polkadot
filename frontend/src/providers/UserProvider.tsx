'use client'

import * as React from 'react'

// hooks
import { useCreditLine } from '@/hooks/borrow/useCreditLine'
import { useBorrow } from '@/hooks/borrow/useBorrow'
import { useSeniorExchangeRate } from '@/hooks/senior/useSeniorExchangeRate'
import { useJuniorExchangeRate } from '@/hooks/junior/useJuniorExchangeRate'
import { useSeniorYield } from '@/hooks/senior/useSeniorYield'
import { useJuniorYield } from '@/hooks/junior/useJuniorYield'
import { useSusdcBalance } from '@/hooks/senior/useSusdcBalance'
import { useJusdcBalance } from '@/hooks/junior/useJusdcBalance'
import { useSeniorAvailableToWithdraw } from '@/hooks/senior/useSeniorAvailableToWithdraw'
import { useJuniorAvailableToWithdraw } from '@/hooks/junior/useJuniorAvailableToWithdraw'
import { useIsLoggedIn, useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { backendUri } from '@/lib/constants'

type UserContextValue = {
  creditScoreDisplay: string
  creditLimitDisplay: string
  borrowedDisplay: string

  seniorExchangeRateDisplay: string
  juniorExchangeRateDisplay: string

  seniorApyDisplay: string
  juniorApyDisplay: string

  susdcDisplay: string
  jusdcDisplay: string

  seniorWithdrawAvailableDisplay: string
  juniorWithdrawAvailableDisplay: string

  maxBorrowDisplay: string
  borrowSubmit: (amountInput: string) => Promise<boolean>
  borrowSubmitting: boolean

  isVerified: boolean
  setIsVerified: (on: boolean) => void
}

const UserContext = React.createContext<UserContextValue | null>(null)

type UserProviderProps = { children: React.ReactNode }

const normalizeWallet = (w?: string | null) => (w ?? '').trim().toLowerCase()

export function UserProvider({ children }: UserProviderProps) {
  // Credit line
  const {
    scoreDisplay: creditScoreDisplay,
    limitDisplay: creditLimitDisplay,
    borrowedDisplay,
  } = useCreditLine({ pollMs: 15_000 })

  // Exchange rates
  const { display: seniorExchangeRateDisplay } = useSeniorExchangeRate()
  const { display: juniorExchangeRateDisplay } = useJuniorExchangeRate()

  // APY (senior auto-discovers IRM internally)
  const { displayAPY: seniorApyDisplay } = useSeniorYield()
  const { displayAPY: juniorApyDisplay } = useJuniorYield()

  // Balances
  const { display: susdcDisplay } = useSusdcBalance()
  const { display: jusdcDisplay } = useJusdcBalance()

  // Withdrawable
  const { display: seniorWithdrawAvailableDisplay } = useSeniorAvailableToWithdraw()
  const { display: juniorWithdrawAvailableDisplay } = useJuniorAvailableToWithdraw()

  // Borrow
  const {
    maxBorrowDisplay,
    submit: borrowSubmit,
    submitting: borrowSubmitting,
  } = useBorrow({ requireController: true })

  // ===== verification (from backend) =====
  const isLoggedIn = useIsLoggedIn()
  const { primaryWallet } = useDynamicContext()
  const wallet = React.useMemo(
    () => normalizeWallet((primaryWallet as any)?.address),
    [primaryWallet],
  )

  const [isVerified, setIsVerified] = React.useState(false)

  // Fetch only the verification flag from backend
  React.useEffect(() => {
    let alive = true

    const run = async () => {
      try {
        // If not logged in or no wallet, treat as unverified
        if (!isLoggedIn || !wallet) {
          if (!alive) return
          setIsVerified(false)
          return
        }
        const res = await fetch(`${backendUri}/user/${wallet}`)
        if (!res.ok) {
          if (!alive) return
          setIsVerified(false)
          return
        }
        const data: { isVerified?: boolean } = await res.json()
        if (!alive) return
        setIsVerified(Boolean(data?.isVerified))
      } catch {
        if (!alive) return
        setIsVerified(false)
      }
    }

    void run()
    return () => {
      alive = false
    }
  }, [isLoggedIn, wallet])

  const value = React.useMemo<UserContextValue>(() => ({
    creditScoreDisplay,
    creditLimitDisplay,
    borrowedDisplay,

    seniorExchangeRateDisplay,
    juniorExchangeRateDisplay,

    seniorApyDisplay,
    juniorApyDisplay,

    susdcDisplay,
    jusdcDisplay,

    seniorWithdrawAvailableDisplay,
    juniorWithdrawAvailableDisplay,

    maxBorrowDisplay,
    borrowSubmit,
    borrowSubmitting,

    isVerified,
    setIsVerified,
  }), [
    creditScoreDisplay,
    creditLimitDisplay,
    borrowedDisplay,
    seniorExchangeRateDisplay,
    juniorExchangeRateDisplay,
    seniorApyDisplay,
    juniorApyDisplay,
    susdcDisplay,
    jusdcDisplay,
    seniorWithdrawAvailableDisplay,
    juniorWithdrawAvailableDisplay,
    maxBorrowDisplay,
    borrowSubmit,
    borrowSubmitting,
    isVerified,
    setIsVerified,
  ])

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  const ctx = React.useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within <UserProvider>.')
  return ctx
}
