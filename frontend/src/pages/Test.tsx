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
import { DECIMALS_USDC, DECIMALS_4616 } from '@/lib/utils'

/**
 * /test — direct calls using the **new stack**:
 * Senior:
 *   - approve (USDC → sUSDC), sUSDC.deposit, LendMarket.borrow, LendMarket.repay, sUSDC.withdraw
 * Junior:
 *   - approve (sUSDC → jUSDC), jUSDC.deposit (s→j), jUSDC.redeem (j→s)
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

    // Contracts
    usdc,
    usdcAddress,
    sUSDC,
    sUSDCAddress,
    jUSDC,
    jUSDCAddress,
    lendMarket,
    lendMarketAddress,

    // Helpers
    refresh: refreshContracts,
    usdcDecimals,
  } = useContracts()

  const aDec = usdcDecimals ?? 6 // on-chain USDC decimals

  // formatted reads (from your UserProvider)
  const {
    creditLimitDisplay,
    borrowedDisplay,
    susdcDisplay,
    jusdcDisplay,
    seniorWithdrawAvailableDisplay,
    juniorWithdrawAvailableDisplay,
  } = useUser()

  const { primaryWallet, setShowAuthFlow } = useDynamicContext()

  // Inputs:
  // - amtUSDC: UI amount for USDC assets (uses DECIMALS_USDC)
  // - amtSShare: UI amount for sUSDC shares (uses DECIMALS_4616)
  const [amtUSDC, setAmtUSDC] = React.useState('')   // USDC (deposit/borrow/repay/withdraw)
  const [amtSShare, setAmtSShare] = React.useState('') // sUSDC shares (deposit to j / redeem j->s)
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

  // ===== helpers =====
  const clean = (v: string) => (v || '').replace(/[_,\s]/g, '')

  // parse UI → base bigint with chosen decimals (returns null if empty/zero/invalid)
  const toBase = React.useCallback((v: string, decimals: number): bigint | null => {
    try {
      const cleaned = clean(v)
      if (!cleaned) return null
      const x = parseUnits(cleaned, decimals)
      return x > 0n ? x : null
    } catch { return null }
  }, [])

  // unified tx runner with toasts + receipt summary
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

  // ========= Senior (USDC / sUSDC) =========

  // approve USDC -> sUSDC (spender = sUSDC address)
  const onApproveUSDC = React.useCallback(async () => {
    if (!usdc || !sUSDCAddress) return toast.error('USDC or sUSDC not ready.')
    const amt = toBase(amtUSDC, DECIMALS_USDC); if (!amt) return toast.error('Enter a valid USDC amount.')
    await runTx('Approve USDC', async () => (usdc as any).approve(sUSDCAddress, amt))
  }, [usdc, sUSDCAddress, amtUSDC, toBase, runTx])

  // deposit USDC -> sUSDC
  const onDepositUSDC = React.useCallback(async () => {
    if (!sUSDC || !account) return toast.error('sUSDC not ready.')
    const amt = toBase(amtUSDC, DECIMALS_USDC); if (!amt) return toast.error('Enter a valid USDC amount.')
    await runTx('Deposit USDC → sUSDC', async () => (sUSDC as any).deposit(amt, account))
  }, [sUSDC, account, amtUSDC, toBase, runTx])

  // borrow from market (USDC)
  const onBorrow = React.useCallback(async () => {
    if (!lendMarket || !account) return toast.error('LendMarket not ready.')
    const amt = toBase(amtUSDC, DECIMALS_USDC); if (!amt) return toast.error('Enter a valid USDC amount.')
    // Convert UI (DECIMALS_USDC) to on-chain USDC decimals (aDec)
    const amt6 = (() => {
      const from = BigInt(DECIMALS_USDC)
      const to = BigInt(aDec)
      if (to === from) return amt
      return to > from ? amt * 10n ** (to - from) : amt / 10n ** (from - to)
    })()
    await runTx('Borrow', async () => (lendMarket as any).borrow(amt6, account))
  }, [lendMarket, account, amtUSDC, aDec, runTx])

  // repay to market (USDC)
  const onRepay = React.useCallback(async () => {
    if (!lendMarket || !account) return toast.error('LendMarket not ready.')
    const amt = toBase(amtUSDC, DECIMALS_USDC); if (!amt) return toast.error('Enter a valid USDC amount.')
    const amt6 = (() => {
      const from = BigInt(DECIMALS_USDC)
      const to = BigInt(aDec)
      if (to === from) return amt
      return to > from ? amt * 10n ** (to - from) : amt / 10n ** (from - to)
    })()
    await runTx('Repay', async () => (lendMarket as any).repay(amt6, account))
  }, [lendMarket, account, amtUSDC, aDec, runTx])

  // withdraw USDC from sUSDC
  const onWithdrawUSDC = React.useCallback(async () => {
    if (!sUSDC || !account) return toast.error('sUSDC not ready.')
    const amt = toBase(amtUSDC, DECIMALS_USDC); if (!amt) return toast.error('Enter a valid USDC amount.')
    // sUSDC.withdraw(assets, receiver, owner)
    await runTx('Withdraw sUSDC → USDC', async () => (sUSDC as any).withdraw(amt, account, account))
  }, [sUSDC, account, amtUSDC, toBase, runTx])

  // ========= Junior (sUSDC / jUSDC) =========

  // approve sUSDC -> jUSDC (spender = jUSDC address)
  const onApproveSUSDCForJunior = React.useCallback(async () => {
    if (!sUSDC || !jUSDCAddress) return toast.error('sUSDC or jUSDC not ready.')
    const amt = toBase(amtSShare, DECIMALS_4616); if (!amt) return toast.error('Enter a valid sUSDC share amount.')
    await runTx('Approve sUSDC→jUSDC', async () => (sUSDC as any).approve(jUSDCAddress, amt))
  }, [sUSDC, jUSDCAddress, amtSShare, toBase, runTx])

  // deposit sUSDC -> jUSDC (assets = sUSDC shares)
  const onDepositSUSDCtoJunior = React.useCallback(async () => {
    if (!jUSDC || !account) return toast.error('jUSDC not ready.')
    const amt = toBase(amtSShare, DECIMALS_4616); if (!amt) return toast.error('Enter a valid sUSDC share amount.')
    await runTx('Deposit sUSDC → jUSDC', async () => (jUSDC as any).deposit(amt, account))
  }, [jUSDC, account, amtSShare, toBase, runTx])

  // redeem jUSDC -> sUSDC
  const onRedeemJuniorToSUSDC = React.useCallback(async () => {
    if (!jUSDC || !account) return toast.error('jUSDC not ready.')
    const sDesired = toBase(amtSShare, DECIMALS_4616); if (!sDesired) return toast.error('Enter a valid sUSDC share amount.')
    // Compute j-shares required for the target s-shares (assets) and redeem
    await runTx('Redeem jUSDC → sUSDC', async () => {
      const jNeeded: bigint = await (jUSDC as any).convertToShares(sDesired)
      return (jUSDC as any).redeem(jNeeded, account, account)
    })
  }, [jUSDC, account, amtSShare, toBase, runTx])

  const writeDisabled = busy || !networkOk || !account

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">/test — Direct contract calls</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your wallet, switch to <strong>Paseo</strong>, and exercise direct methods.
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
            <Row label="sUSDC (ERC4626)" value={sUSDCAddress} />
            <Row label="jUSDC (ERC4626)" value={jUSDCAddress} />
            <Row label="LendMarket" value={lendMarketAddress} />
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
              value={amtUSDC}
              onChange={(e) => setAmtUSDC(e.target.value)}
              placeholder={`USDC amount (UI decimals = ${DECIMALS_USDC})`}
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
              value={amtSShare}
              onChange={(e) => setAmtSShare(e.target.value)}
              placeholder={`sUSDC shares (UI decimals = ${DECIMALS_4616})`}
              className="max-w-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={onApproveSUSDCForJunior} disabled={writeDisabled}>approve (s→j)</Button>
              <Button onClick={onDepositSUSDCtoJunior} disabled={writeDisabled}>deposit (s→j)</Button>
              <Button onClick={onRedeemJuniorToSUSDC} disabled={writeDisabled} variant="secondary">redeem (j→s)</Button>
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
