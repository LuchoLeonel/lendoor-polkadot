'use client'

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatUnits } from 'ethers'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export const DECIMALS = 4;

export function formatUSDCAmount(value: bigint | string): string {
  const asString = typeof value === 'bigint' ? formatUnits(value, DECIMALS) : value
  const num = Number(asString)
  if (!isFinite(num)) return asString
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 6,
    minimumFractionDigits: 0,
  }).format(num).replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '')
}

export function formatUSDCAmount2dp(value: bigint | string): string {
  const asString = typeof value === 'bigint' ? formatUnits(value, DECIMALS) : value
  const num = Number(asString)
  if (!isFinite(num)) return asString
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(num)
}



const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const baseImageUrl = isLocal ? 'http://localhost:3003' : 'https://lendoor.xyz';

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


