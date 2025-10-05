import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


  const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const baseImageUrl = isLocal ? 'http://localhost:3000' : 'https://lendoor.xyz';

  export const evmNetworks = [
  {
    blockExplorerUrls: ['https://etherscan.io'],
    chainId: 1,
    chainName: 'Ethereum Mainnet',
    iconUrls: [`${baseImageUrl}/eth_logo.png`],
    name: 'Ethereum',
    nativeCurrency: {
      decimals: 18,
      name: 'Ether',
      symbol: 'ETH',
      iconUrl: `${baseImageUrl}/eth_logo.png`,
    },
    networkId: 1,
    rpcUrls: [
      'https://eth-mainnet.g.alchemy.com/v2/K_R03CbSUiXz-EaoiaeE4FuglxgxE_Nt',
      'https://rpc.ankr.com/eth',
    ],
    vanityName: 'Ethereum Mainnet',
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


