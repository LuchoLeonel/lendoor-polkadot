'use client'

import { useState } from 'react'
import { useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { CreditMarket } from '@/components/borrow/BorrowMarket'
import { QRCodeView } from '@/components/proofs/QrCode'

export default function BorrowPage() {
  const { setShowAuthFlow } = useDynamicContext()
  const [showQR, setShowQR] = useState(false)

  return (
    <div className="container mx-auto w-full max-w-3xl">
      {/* 👇 viewport: oculta lo que se va fuera del ancho */}
      <div className="relative overflow-hidden">
        {/* 👇 slider: 200% de ancho y transición en X */}
        <div
          className={`flex w-[200%] transform-gpu transition-transform duration-500 ease-in-out ${
            showQR ? '-translate-x-1/2' : 'translate-x-0'
          }`}
        >
          {/* Vista 1 */}
          <div className="w-1/2 shrink-0">
            <CreditMarket setShowQR={setShowQR} />
          </div>

          {/* Vista 2 */}
          <div className="w-1/2 shrink-0">
            <QRCodeView onBack={() => setShowQR(false)} />
          </div>
        </div>
      </div>
    </div>
  )
}
