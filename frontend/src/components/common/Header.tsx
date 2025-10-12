// src/components/common/Header.tsx
'use client'

import { useEffect, useState } from 'react'
import { DynamicWidget, useIsLoggedIn, useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useUserJourney } from '@/providers/UserJourneyProvider'
import { useContracts } from '@/providers/ContractsProvider'
import UserJourneyBadge from '@/components/common/UserJourneyBadge'
import MintUSDCButton from '@/components/common/MintUSDCButton'

function labelClasses(isActive: boolean) {
  const base =
    "relative inline-block tracking-wide transition-colors duration-150 " +
    "after:absolute after:left-1/2 after:bottom-[-2px] after:h-[2px] after:w-0 " +
    "after:-translate-x-1/2 after:rounded-full after:bg-primary " +
    "after:transition-all after:duration-200";
  return isActive
    ? [base, "text-foreground after:w-10"].join(" ")
    : [base, "text-muted-foreground group-hover:text-primary group-hover:after:w-6"].join(" ");
}

export function Header() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { pathname, key: routeKey } = useLocation()
  const { ready, is_borrow, is_lend } = useUserJourney()
  const { sdkHasLoaded } = useDynamicContext()
  const isLoggedIn = useIsLoggedIn()
  const { connectedAddress } = useContracts()

  const authKnown = mounted && sdkHasLoaded
  const showBorrowBadge = ready && is_borrow && pathname !== '/borrow'
  const showLendBadge = ready && is_lend && pathname !== '/lend'
  const showLoginBadge = authKnown && !isLoggedIn

  return (
    <header className="border-b border-primary/20 bg-background/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        {/* Brand */}
        <Link to="/" className="group focus:outline-none flex items-center gap-3">
          <img
            src="/favicon.png"
            alt="favicon"
            width={15}
            height={15}
            className="h-7 w-7 shrink-0 object-contain"
          />
          <div className="text-2xl font-bold text-primary mono-text terminal-cursor">LENDOOR</div>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-8 mono-text">
          <NavLink to="/borrow">
            {({ isActive }) => (
              <div className="group px-3 py-1.5 text-sm flex items-center gap-2">
                {showBorrowBadge && !isActive && (
                  <UserJourneyBadge key={`borrow:${routeKey}:${Number(ready)}:${Number(is_borrow)}`} />
                )}
                <span className={labelClasses(isActive)}>BORROW</span>
              </div>
            )}
          </NavLink>

          <NavLink to="/lend">
            {({ isActive }) => (
              <div className="group px-3 py-1.5 text-sm flex items-center gap-2">
                {showLendBadge && !isActive && (
                  <UserJourneyBadge key={`lend:${routeKey}:${Number(ready)}:${Number(is_lend)}`} />
                )}
                <span className={labelClasses(isActive)}>LEND</span>
              </div>
            )}
          </NavLink>
          <NavLink to="/test">
            {({ isActive }) => (
              <div className="group px-3 py-1.5 text-sm flex items-center gap-2">
                <span className={labelClasses(isActive)}>TEST</span>
              </div>
            )}
          </NavLink>
        </nav>

        {/* Auth / Actions */}
        <div className="relative min-w-[200px] w-[200px] shrink-0 flex items-center justify-end gap-3">
          {authKnown ? (
            <>
              <div className="relative shrink-0 flex items-center justify-end gap-3">
                {connectedAddress ? <MintUSDCButton /> : null}
                {showLoginBadge && <UserJourneyBadge />}
                <DynamicWidget />
              </div>
            </>
          ) : (
            <div className="h-10 w-full rounded-md border border-primary/20 bg-muted/40 animate-pulse" />
          )}
        </div>
      </div>
    </header>
  )
}

/* Notes:
   - Uses Dynamic’s SDK to decide when auth state is reliable (authKnown) to avoid flicker.
   - MintUSDCButton renders only if an EVM address is connected (from ContractsProvider).
   - Badges are keyed with routeKey + flags to refresh correctly when navigation/journey changes.
*/
