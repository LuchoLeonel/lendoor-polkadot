'use client'

import { useEffect, useState } from 'react'
import { DynamicWidget, useIsLoggedIn, useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { useUserJourney } from '../providers/UserProvider';
import UserJourneyBadge from './UserJourneyBadge';

export function Header() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { ready, is_borrow, is_lend } = useUserJourney();
  
  return (
     <header className="border-b border-primary/20 bg-background/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="group focus:outline-none flex justify-center align-center gap-3">
            <img
              src="/favicon.png"
              alt="favicon"
              width={15}
              height={15}
              className="h-7 w-7 shrink-0 object-contain"
            />
            <div className="text-2xl font-bold text-primary mono-text terminal-cursor">LENDOOR</div>
          </Link>
          <nav className="hidden md:flex space-x-8 mono-text">
            
            <Link to="/borrow" className="text-muted-foreground hover:text-primary terminal-hover px-2 py-1 text-sm">
              <div className="flex items-center gap-2">
              {(ready && is_borrow) && <UserJourneyBadge /> }
              BORROW
              </div>
            </Link>
            {(ready && is_lend) && <UserJourneyBadge /> }
            <Link to="/lend" className="text-muted-foreground hover:text-primary terminal-hover px-2 py-1 text-sm">
              LEND
            </Link>
          </nav>
          <div className="min-w-[200px] w-[200px] shrink-0 flex justify-end">
          {mounted ? (
            <DynamicWidget />
          ) : (
            <div className="h-10 w-full rounded-md border border-primary/20 bg-muted/40 animate-pulse" />
          )}
        </div>
        </div>
      </header>
  )
}
