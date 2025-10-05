"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowUpDown, ChevronDown } from "lucide-react"

export function SwapInterface() {
  const [fromAmount, setFromAmount] = useState("3.3")
  const [toAmount, setToAmount] = useState("0.00002966")

  return (
    <Card className="p-6 bg-card border-border shadow-2xl">
      <div className="space-y-4">
        {/* Contract Address Display */}
        <div className="bg-primary text-primary-foreground px-4 py-3 rounded-lg text-center font-mono text-sm">
          0x1C0A...5A20
        </div>

        {/* From Token */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">From</span>
            <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-lg">
              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-bold">$</span>
              </div>
              <span className="font-medium">USDC</span>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>

          <div className="relative">
            <Input
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="text-2xl font-bold h-16 bg-input border-border"
              placeholder="0.0"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="flex gap-1">
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">Balance: 3.426799 USDC</div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button variant="outline" size="icon" className="rounded-lg border-border bg-card hover:bg-muted">
            <ArrowUpDown className="w-4 h-4" />
          </Button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">To</span>
            <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-lg">
              <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-bold">₿</span>
              </div>
              <span className="font-medium">WBTC</span>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>

          <div className="relative">
            <Input
              value={toAmount}
              onChange={(e) => setToAmount(e.target.value)}
              className="text-2xl font-bold h-16 bg-input border-border"
              placeholder="0.0"
            />
          </div>

          <div className="text-sm text-muted-foreground">Balance: 0 WBTC</div>
        </div>

        {/* Route Info */}
        <Card className="p-4 bg-muted/50 border-border">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Route:</span>
            <span>Aerodrome CL + Aerodrome</span>
          </div>
          <div className="flex justify-between items-center text-sm mt-1">
            <span className="text-muted-foreground">Slippage:</span>
            <span className="text-primary">0.5%</span>
          </div>
        </Card>

        {/* Swap Button */}
        <Button className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground">
          Swap
        </Button>
      </div>
    </Card>
  )
}
