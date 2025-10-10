// src/pages/Test.tsx
'use client'

import * as React from 'react'
import { parseUnits } from 'ethers'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useContracts } from '@/providers/ContractsProvider'
import { useUser } from '@/providers/UserProvider'
import { useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { DECIMALS } from '@/lib/utils'

/**
 * /test — calls direct contract methods:
 * Senior: approve (USDC→EVault), deposit, borrow, repay, withdraw
 * Junior: approve (sUSDC→Junior), deposit (sUSDC→jUSDC), demoteToSenior (jUSDC→sUSDC)
 * Shows last tx (hash + logs), basic reads, and adds noindex meta.
 */

// Paseo (Passet Hub)
const EXPECTED_CHAIN_ID = 420_420_422
const EXPECTED_CHAIN_HEX = '0x190f1b46'
const EXPLORER_BASE = 'https://blockscout-passet-hub.parity-testnet.parity.io'
const RPC_URL = 'https://testnet-passet-hub-eth-rpc.polkadot.io'
const CHAIN_NAME = 'Polkadot Hub TestNet (Paseo)'
const NATIVE = { name: 'PAS', symbol: 'PAS', decimals: 18 }

const short = (a?: string | null, n = 6) => (!a ? '—' : `${a.slice(0, n)}…${a.slice(-n)}`)
const err = (e: any) => e?.shortMessage || e?.reason || e?.message || 'Transaction failed'

/** Best-effort EIP-1193 */
async function getEip1193(primaryWallet: any): Promise<any | null> {
  try {
    if (primaryWallet?.getEthereumProvider) {
      const p = await primaryWallet.getEthereumProvider()
      if (p?.request) return p
    }
  } catch {}
  const anyWin = window as any
  if (anyWin?.ethereum?.request) return anyWin.ethereum
  return null
}

export default function Test() {
  const {
    connectedAddress,
    chainId,
    evault,
    evaultAddress,
    evaultJunior,
    evaultJuniorAddress,
    usdc,
    usdcAddress,
    controller,
    refresh: refreshContracts,
  } = useContracts()

  // reads formateados
  const {
    creditLimitDisplay,
    borrowedDisplay,
    susdcDisplay,
    jusdcDisplay,
    seniorWithdrawAvailableDisplay,
    juniorWithdrawAvailableDisplay,
  } = useUser()

  const { primaryWallet, setShowAuthFlow } = useDynamicContext()

  const [amtSenior, setAmtSenior] = React.useState('') // USDC/sUSDC
  const [amtJunior, setAmtJunior] = React.useState('') // sUSDC (for both junior deposit and demote target)
  const [busy, setBusy] = React.useState(false)
  const [lastTx, setLastTx] = React.useState<{ label: string; hash: string; logs: number } | null>(null)

  const networkOk = chainId === EXPECTED_CHAIN_ID
  const account = connectedAddress ?? (primaryWallet?.address as `0x${string}` | undefined) ?? null

  // noindex
  React.useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex,nofollow'
    document.head.appendChild(m)
    return () => { m.remove() }
  }, [])

  const switchToPaseo = React.useCallback(async () => {
    try {
      const provider = await getEip1193(primaryWallet)
      if (!provider?.request) return toast.error('No EVM provider available.')
      try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: EXPECTED_CHAIN_HEX }] })
      } catch (e: any) {
        if (e?.code !== 4902) throw e
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: EXPECTED_CHAIN_HEX,
            chainName: CHAIN_NAME,
            rpcUrls: [RPC_URL],
            nativeCurrency: NATIVE,
            blockExplorerUrls: [EXPLORER_BASE + '/'],
          }],
        })
      }
      await refreshContracts()
    } catch (e: any) {
      toast.error('Failed to switch network', { description: err(e) })
    }
  }, [primaryWallet, refreshContracts])

  // helpers
  const toBase = React.useCallback((v: string): bigint | null => {
    try {
      const cleaned = (v || '').replace(/[_,\s]/g, '')
      if (!cleaned) return null
      const x = parseUnits(cleaned, DECIMALS)
      return x > 0n ? x : null
    } catch { return null }
  }, [])

  const runTx = React.useCallback(async (label: string, fn: () => Promise<any>) => {
    if (!account) return toast.error('Connect your wallet to continue.')
    if (!networkOk) return toast.error('Wrong network', { description: 'Please switch to Paseo testnet.' })
    setBusy(true)
    const t = toast.loading(`${label} pending…`)
    try {
      const tx = await fn()
      const hash = tx?.hash ?? '0x'
      const receipt = await tx.wait()
      const logsCount = Array.isArray(receipt?.logs) ? receipt.logs.length : 0
      setLastTx({ label, hash, logs: logsCount })
      toast.success(`${label} confirmed`, { description: short(hash) })
      await refreshContracts()
    } catch (e: any) {
      toast.error(`${label} failed`, { description: err(e) })
    } finally {
      toast.dismiss(t)
      setBusy(false)
    }
  }, [account, networkOk, refreshContracts])

  // ========= Senior (USDC/sUSDC) — direct calls =========
  const onApproveUSDC = React.useCallback(async () => {
    if (!usdc || !evaultAddress) return toast.error('USDC or EVault not ready.')
    const amt = toBase(amtSenior); if (!amt) return toast.error('Enter a valid amount.')
    await runTx('Approve USDC', async () => (usdc as any).approve(evaultAddress, amt))
  }, [usdc, evaultAddress, amtSenior, toBase, runTx])

  const onDepositUSDC = React.useCallback(async () => {
    if (!evault || !account) return toast.error('EVault not ready.')
    const amt = toBase(amtSenior); if (!amt) return toast.error('Enter a valid amount.')
    await runTx('Deposit', async () => (evault as any).deposit(amt, account))
  }, [evault, account, amtSenior, toBase, runTx])

  const onBorrow = React.useCallback(async () => {
    if (!evault || !account) return toast.error('EVault not ready.')
    const amt = toBase(amtSenior); if (!amt) return toast.error('Enter a valid amount.')
    await runTx('Borrow', async () => {
      if (controller) {
        try {
          const txCtrl = await (controller as any).enableController(account, evaultAddress)
          await txCtrl.wait()
        } catch (e: any) {
          const m = err(e).toLowerCase()
          if (!m.includes('already') && !m.includes('enabled')) throw e
        }
      }
      return (evault as any).borrow(amt, account)
    })
  }, [evault, controller, evaultAddress, account, amtSenior, toBase, runTx])

  const onRepay = React.useCallback(async () => {
    if (!evault || !account) return toast.error('EVault not ready.')
    const amt = toBase(amtSenior); if (!amt) return toast.error('Enter a valid amount.')
    await runTx('Repay', async () => (evault as any).repay(amt, account))
  }, [evault, account, amtSenior, toBase, runTx])

  const onWithdrawUSDC = React.useCallback(async () => {
    if (!evault || !account) return toast.error('EVault not ready.')
    const amt = toBase(amtSenior); if (!amt) return toast.error('Enter a valid amount.')
    // withdraw(assets, receiver, owner)
    await runTx('Withdraw', async () => (evault as any).withdraw(amt, account, account))
  }, [evault, account, amtSenior, toBase, runTx])

  // ========= Junior (jUSDC) — direct calls =========
  const onApproveSUSDCForJunior = React.useCallback(async () => {
    if (!evault || !evaultJuniorAddress) return toast.error('sUSDC or Junior not ready.')
    const amt = toBase(amtJunior); if (!amt) return toast.error('Enter a valid amount.')
    // approve on sUSDC token (the EVault token) to the junior wrapper
    await runTx('Approve sUSDC→Junior', async () => (evault as any).approve(evaultJuniorAddress, amt))
  }, [evault, evaultJuniorAddress, amtJunior, toBase, runTx])

  const onDepositSUSDCtoJunior = React.useCallback(async () => {
    if (!evaultJunior || !account) return toast.error('Junior wrapper not ready.')
    const amt = toBase(amtJunior); if (!amt) return toast.error('Enter a valid amount.')
    // direct call: deposit(assets, receiver)
    await runTx('Deposit sUSDC→jUSDC', async () => (evaultJunior as any).deposit(amt, account))
  }, [evaultJunior, account, amtJunior, toBase, runTx])

  const onDemoteJuniortoSUSDC = React.useCallback(async () => {
    if (!evault || !account) return toast.error('EVault not ready.')
    const amtS = toBase(amtJunior); if (!amtS) return toast.error('Enter a valid amount.')
    await runTx('demoteToSenior (j→s)', async () => {
      // Convert desired sUSDC (shares, UI units) into j-shares required, then call demoteToSenior(jShares, receiver)
      const assetsUSDC: bigint = await (evault as any).convertToAssets(amtS)
      const jNeeded: bigint = await (evault as any).previewWithdrawJunior(assetsUSDC)
      return (evault as any).demoteToSenior(jNeeded, account)
    })
  }, [evault, account, amtJunior, toBase, runTx])

  const writeDisabled = busy || !networkOk || !account

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">/test — Direct contract calls</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect wallet, switch to <strong>Paseo</strong>, and exercise direct methods.
        </p>
      </div>

      {/* Status + Addresses */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Wallet & Network</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Account</span>
              <span className="font-mono">{short(account)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Chain ID</span>
              <span className={`font-mono ${networkOk ? 'text-green-600' : 'text-red-600'}`}>
                {chainId ?? '—'} {networkOk ? '✓' : '✗'}
              </span>
            </div>
            <div className="flex gap-2">
              {!account && <Button size="sm" onClick={() => setShowAuthFlow(true)}>Connect</Button>}
              {!networkOk && <Button size="sm" variant="outline" onClick={switchToPaseo}>Switch to Paseo</Button>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contracts</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="EVault" value={evaultAddress} />
            <Row label="EVault Junior (wrapper)" value={evaultJuniorAddress} />
            <Row label="USDC" value={usdcAddress} />
          </CardContent>
        </Card>
      </div>

      {/* WRITE — Senior */}
      <Card>
        <CardHeader><CardTitle>Senior (USDC / sUSDC)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Input
              value={amtSenior}
              onChange={(e) => setAmtSenior(e.target.value)}
              placeholder={`Amount (UI decimals = ${DECIMALS})`}
              className="max-w-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={onApproveUSDC} disabled={writeDisabled}>approve</Button>
              <Button onClick={onDepositUSDC} disabled={writeDisabled}>deposit</Button>
              <Button onClick={onBorrow} disabled={writeDisabled}>borrow</Button>
              <Button onClick={onRepay} disabled={writeDisabled} variant="secondary">repay</Button>
              <Button onClick={onWithdrawUSDC} disabled={writeDisabled} variant="secondary">withdraw</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WRITE — Junior */}
      <Card>
        <CardHeader><CardTitle>Junior (sUSDC / jUSDC)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Input
              value={amtJunior}
              onChange={(e) => setAmtJunior(e.target.value)}
              placeholder={`Amount (UI decimals = ${DECIMALS})`}
              className="max-w-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={onApproveSUSDCForJunior} disabled={writeDisabled}>approve (sUSDC→Junior)</Button>
              <Button onClick={onDepositSUSDCtoJunior} disabled={writeDisabled}>deposit (s→j)</Button>
              <Button onClick={onDemoteJuniortoSUSDC} disabled={writeDisabled} variant="secondary">demoteToSenior (j→s)</Button>
            </div>
          </div>

          {lastTx && (
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last Tx</span>
                <span className="font-medium">{lastTx.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Hash</span>
                <a
                  href={`${EXPLORER_BASE}/tx/${lastTx.hash}`}
                  target="_blank" rel="noreferrer"
                  className="font-mono underline break-all"
                >
                  {short(lastTx.hash)}
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Logs</span>
                <span className="font-mono">{lastTx.logs}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* READS */}
      <Card>
        <CardHeader><CardTitle>Read State</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Block title="Credit line (borrowed / limit)" val={`${borrowedDisplay} / ${creditLimitDisplay}`} />
          <Block title="sUSDC balance / Senior available" val={`${susdcDisplay} / ${seniorWithdrawAvailableDisplay}`} />
          <Block title="jUSDC balance / Junior available" val={`${jusdcDisplay} / ${juniorWithdrawAvailableDisplay}`} />
          <Button size="sm" className="mt-2 w-fit" variant="outline" onClick={() => void refreshContracts()}>
            Refresh
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Security note: testnet only; page is noindex.
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      {value ? (
        <a className="font-mono underline" href={`${EXPLORER_BASE}/address/${value}`} target="_blank" rel="noreferrer">
          {short(value)}
        </a>
      ) : <span>—</span>}
    </div>
  )
}

function Block({ title, val }: { title: string; val: string }) {
  return (
    <div className="rounded-lg border p-3 text-sm space-y-1">
      <div className="text-muted-foreground">{title}</div>
      <div className="font-medium">{val}</div>
    </div>
  )
}
