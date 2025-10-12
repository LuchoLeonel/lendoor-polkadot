'use client'

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatUnits } from 'ethers'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export const DECIMALS_USDC = 4;
export const DECIMALS_4616 = 14;


/** Rescale bigint between decimal systems (floors on downscale). */
export function scaleDecimals(value: bigint, fromDec: number, toDec: number): bigint {
  const f = BigInt(fromDec)
  const t = BigInt(toDec)
  if (t === f) return value
  if (t > f) return value * 10n ** (t - f)
  return value / 10n ** (f - t)
}

/** Internal: normalize a bigint/string (UI-based) to a JS number using given decimals. */
function toUiNumber(value: bigint | string, decimals: number): number | null {
  const s = typeof value === 'bigint' ? formatUnits(value, decimals) : value
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Format a USDC UI amount (default `DECIMALS_USDC`) with up to 6 fractional digits, trimming trailing zeros. */
export function formatUSDCAmount(value: bigint | string, decimals = DECIMALS_USDC): string {
  const n = toUiNumber(value, decimals)
  if (n == null) return typeof value === 'bigint' ? value.toString() : value
  const out = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 6,
    minimumFractionDigits: 0,
  }).format(n)
  // Trim trailing zeros like "1.230000" -> "1.23", "2.0" -> "2"
  return out.replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '')
}

/** Format a USDC UI amount (default `DECIMALS_USDC`) with exactly 2 fractional digits. */
export function formatUSDCAmount2dp(value: bigint | string, decimals = DECIMALS_USDC): string {
  const n = toUiNumber(value, decimals)
  if (n == null) return typeof value === 'bigint' ? value.toString() : value
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(n)
}

const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const baseImageUrl = isLocal ? 'http://localhost:3003' : 'https://polkadot.lendoor.xyz';

export const evmNetworks = [
  {
    blockExplorerUrls: ['https://blockscout-passet-hub.parity-testnet.parity.io/'],
    chainId: 420420422,
    chainName: 'Polkadot Hub TestNet',
    iconUrls: [`${baseImageUrl}/polkadot_logo.png`],
    name: 'Polkadot Hub TestNet',
    nativeCurrency: {
      decimals: 18,
      name: 'Paseo',
      symbol: 'PAS',
      iconUrl: `${baseImageUrl}/polkadot_logo.png`,
    },
    networkId: 420420422,
    rpcUrls: ['https://testnet-passet-hub-eth-rpc.polkadot.io'],
    vanityName: 'Polkadot Hub TestNet',
  },
];




export const tokensToCheckTeleporter = [
  /*
  {
    addr: "0xE69711C55f6E87F4c39321D3aDeCc4C2CAddc471",
    chainId: 11155111,
    blockNumber: 8442172,
    balance: 0,
  },
  {
    addr: "0x92A08a34488Fcc8772Af2269186e015Eca494Baa",
    chainId: 11155420,
    blockNumber: 28421349,
    balance: 0,
  },
  {
    addr: "0x7B4707070b8851F82B5339aaC7F6759d8e737E88",
    chainId: 84532,
    blockNumber: 26438476,
    balance: 0,
  },*/
];


