'use client'

import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import { ZKPassport } from '@zkpassport/sdk'
import QRCode from 'react-qr-code'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InfoTip } from '@/components/common/InfoTooltip'
import { ArrowLeft, ShieldCheck, CheckCircle } from 'lucide-react'
import { backendUri } from '@/lib/constants'
import { useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { useUserJourney } from '../providers/UserProvider'

type QRCodeViewProps = {
  onBack: () => void
  appName?: string
  logoUrl?: string
  purpose?: string
  scope?: string
  devMode?: boolean
}

type BackendVerifyResponse = {
  verified: boolean
  user?: { creditLimit?: number | string | null }
}

export function QRCodeView({
  onBack,
  appName = 'Lendoor',
  logoUrl = '/logo-black.png',
  purpose = 'Verify your identity using zkPassport',
  scope = 'identity-verification',
  devMode = true,
}: QRCodeViewProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState(false)
  const [verified, setVerified] = useState<boolean | null>(null)
  const [creditLimit, setCreditLimit] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { primaryWallet, setShowAuthFlow } = useDynamicContext()
  const { setIsVerified } = useUserJourney();

  // ---- wallet actual siempre fresca (evita closures "stale") ----
  const walletRef = useRef<string>('')     // address en minúsculas
  const [wallet, setWallet] = useState('') // opcional para debug/UI
  useEffect(() => {
    let alive = true
    const w: any = primaryWallet
    ;(async () => {
      try {
        if (!w) { if (alive) { walletRef.current = ''; setWallet('') } ; return }
        let addr: any = w.address ?? w.account?.address ?? null
        if (!addr && typeof w.address === 'function') addr = w.address()
        if (addr && typeof addr.then === 'function') addr = await addr
        if (!addr && typeof w.getPublicAddress === 'function') {
          addr = w.getPublicAddress()
          if (addr && typeof addr.then === 'function') addr = await addr
        }
        const norm = (typeof addr === 'string' ? addr : '').toLowerCase()
        if (alive) { walletRef.current = norm; setWallet(norm) }
      } catch { if (alive) { walletRef.current = ''; setWallet('') } }
    })()
    return () => { alive = false }
  }, [primaryWallet])

  useEffect(() => {
  if (verified === true) {
    const t = setTimeout(() => {
      onBack()
    }, 1000)
    return () => clearTimeout(t)
  }
}, [verified, onBack])

  // ---- refs / control ----
  const zkpassportRef = useRef<ZKPassport | null>(null)
  const didInitRef = useRef(false)
  const sentRef = useRef(false)                 // evitar doble envío
  const pendingProofRef = useRef<any>(null)     // si llega proof sin wallet

  // ---- submit al backend ----
  const submitProof = async (proof: any) => {
    try {
      setSubmitting(true); setError(null)
      const res = await fetch(`${backendUri}/zkpassport/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: walletRef.current,
          requestId,
          proof,
        }),
      })
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`))
      const data: BackendVerifyResponse = await res.json()
      setVerified(Boolean(data.verified))
      const clRaw = data?.user?.creditLimit
      const cl = typeof clRaw === 'number' ? clRaw : clRaw != null ? Number(clRaw as any) : null
      setCreditLimit(Number.isFinite(cl as number) ? (cl as number) : null)
      setIsVerified(true);
    } catch (e: any) {
      setVerified(false)
      setError(e?.message ?? 'Error submitting proof to backend.')
    } finally {
      setSubmitting(false); setLoading(false)
    }
  }

  // si la wallet aparece después de la proof, mandamos lo pendiente
  useEffect(() => {
    if (!sentRef.current && walletRef.current && pendingProofRef.current) {
      sentRef.current = true
      void submitProof(pendingProofRef.current)
    }
  }, [wallet]) // depende del address visible

  // ---- generar QR + callbacks del SDK ----
  const generateQR = async () => {
    if (didInitRef.current) return
    didInitRef.current = true

    setLoading(true)
    setUrl(null); setRequestId(null); setError(null)
    setVerified(null); setCreditLimit(null)
    pendingProofRef.current = null
    sentRef.current = false

    try {
      if (!zkpassportRef.current) {
        // pasá tu host (sin protocolo) si necesitás canales cross-host
        // zkpassportRef.current = new ZKPassport('lendoor.lendoor.xyz')
        zkpassportRef.current = new ZKPassport(window.location.host)
      }

      const qb = await zkpassportRef.current.request({
        name: appName,
        logo: logoUrl,
        purpose,
        scope,
        devMode,
      })

      const {
        url,
        requestId,
        onRequestReceived,
        onGeneratingProof,
        onProofGenerated,
        onResult,
        onReject,
        onError,
      } = qb
        .disclose('firstname')
        .disclose('lastname')
        .disclose('birthdate')
        .disclose('nationality')
        .disclose('document_type')
        .disclose('document_number')
        .gte('age', 18)
        .done()

      setUrl(url); setRequestId(requestId); setLoading(false)

      onRequestReceived(() => { /* opcional */ })
      onGeneratingProof(() => { setLoading(true) })

      onProofGenerated(async ({ proof }) => {
        if (sentRef.current) return
        if (!walletRef.current) {
          pendingProofRef.current = proof
          setError('Connect your wallet to continue.')
          setShowAuthFlow?.(true)
          setLoading(false)
          return
        }
        sentRef.current = true
        await submitProof(proof)
      })

      onResult((_e) => { /* opcional: logs/telemetría */ })
      onReject(() => { setLoading(false); setVerified(false); setError('Request rejected in the app.') })
      onError((_err) => { setLoading(false); setVerified(false); setError('Proof generation error.') })
    } catch (e) {
      console.error('[zkp] init error', e)
      setLoading(false); setVerified(false); setError('Failed to initialize zkPassport.')
    }
  }

  useEffect(() => { void generateQR() }, [])

  const busy = loading || submitting

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="p-2 cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-semibold">zkPassport</h2>
          <InfoTip
            label={
              <div className="max-w-xs">
                <div className="font-semibold mb-1">Privacy</div>
                <div className="text-[11px] leading-snug">
                    We verify your zk proof and link selected passport attributes to your wallet to
                    assess eligibility. Personal data stays off-chain; only minimal attestations are
                    written on-chain.
                </div>
              </div>
            }
            contentClassName="font-display text-[11px] leading-snug"
          />
        </div>
      </div>

      {/* Card */}
      <Card className="relative p-6 border-2 border-border/50 overflow-hidden">
        {busy && (
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10">
            <div className="h-6 w-6 rounded-full border-2 border-foreground/40 border-t-transparent animate-spin" />
            <div className="text-xs text-muted-foreground">Processing…</div>
          </div>
        )}

        <div className="mb-2 text-center">
          <h3 className="text-xl font-bold mb-2">Verify with zkPassport</h3>
          <p className="text-sm text-muted-foreground">
            Not registered? Scan this code with your zkPassport mobile app to create a proof and
            link it to your wallet. This helps us build your reputation-based credit score.&nbsp;
            <InfoTip
            label={
              <div className="max-w-xs">
                <div className="font-semibold mb-1">What is this?</div>
                <div className="text-[11px] leading-snug">
                  Scan with your zkPassport app to generate a zero-knowledge proof. We’ll link it to
                  your Ethereum account to bootstrap a reputation-based credit score—without
                  revealing your private data.
                </div>
              </div>
            }
            contentClassName="font-display text-[11px] leading-snug"
          />
          </p>
        </div>

        {/* QR */}
        <div className="mx-auto mb-4 w-[232px] flex items-center justify-center">
          {verified === true ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="w-16 h-16 text-green-600" />
              <span className="text-sm text-green-600 font-medium">Verified!</span>
            </div>
          ) : url ? (
            <div className="rounded-md border border-border/70 bg-background p-2">
              <QRCode value={url} size={208} />
            </div>
          ) : (
            <div className="w-[224px] h-[224px] qr-skeleton">
              <div className="qr-skeleton-band" />
            </div>
          )}
        </div>

        {/* Estado */}
        {!busy && (
          <>
            {verified === false && error && (
              <div className="text-sm text-red-600">{error}</div>
            )}
            {verified === null && error && (
              <div className="text-sm text-amber-600">{error}</div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
