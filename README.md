# 💳 Lendoor — Reputation‑Based Money Market

<p align="center">
  <img src="frontend/public/landing.png" alt="Lendoor" style="max-width: 100%; border-radius: 12px;" />
</p>

**Lendoor** is a decentralized money market that enables **uncollateralized lending**, powered by zero‑knowledge identity and on‑chain reputation.  
This demo targets **Polkadot Asset Hub (EVM testnet, “Paseo”)**.

---

## Network

- **Network:** Polkadot Asset Hub — **Paseo (EVM testnet)**
- **Chain ID (dec):** `420420422`
- **Chain ID (hex):** `0x190f1b46`
- **RPC URL:** `https://testnet-passet-hub-eth-rpc.polkadot.io`
- **Block Explorer:** `https://blockscout-passet-hub.parity-testnet.parity.io`

<details>
<summary><strong>Wallet add (JSON)</strong></summary>

```json
{
  "chainId": "0x190f1b46",
  "chainName": "Polkadot Hub TestNet (Paseo)",
  "rpcUrls": ["https://testnet-passet-hub-eth-rpc.polkadot.io"],
  "nativeCurrency": { "name": "PAS", "symbol": "PAS", "decimals": 18 },
  "blockExplorerUrls": ["https://blockscout-passet-hub.parity-testnet.parity.io/"]
}
```
</details>

---

## Deployed Contracts (Testnet)

> Replace these with your latest deployments if you redeploy.

- **EVault (Senior eToken / lending vault):** `0x521555e6cf3a0062D22b6D08aAFc2F3a4761B8e2`  
- **Junior ERC‑4626 (jUSDC wrapper):** `0x9D075E2EA814ba0537607aD657a80fCd8f7ce131`  
- **CreditLimitManager:** `0xf100c356aF3DC43DBB6bb3d62D4eE915E98cc8a9`  
- **vLayer AverageBalance Verifier:** `0x2C244c18b9D4E24Ad3f21e6BA7bFE0fFa492aB05`  
- **USDC (test token):** `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` *(adjust if different on Paseo)*

---

## Contract ABIs (subset used by the app)

> Full ABIs live in the repository under `frontend/src/contracts/` (e.g., `IEVault.json`, `IEVC.json`).  
> Below are the **minimal fragments** required for the demo UI and hooks.

### EVault (subset)

```json
[
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
  "function borrow(uint256 assets, address receiver) returns (uint256)",
  "function repay(uint256 assets, address receiver) returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function previewWithdrawJunior(uint256 assets) view returns (uint256)",
  "function demoteToSenior(uint256 jShares, address receiver) returns (uint256)",
  "function psSeniorRay() view returns (uint256)",
  "function psJuniorRay() view returns (uint256)",
  "function availableCashAssets() view returns (uint256)",
  "function debtOf(address) view returns (uint256)",
  "function MODULE_RISKMANAGER() view returns (address)"
]
```

### Junior ERC‑4626 (subset)

```json
[
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
  "function maxWithdraw(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
]
```

### ERC‑20 (minimal)

```json
[
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
  "function transferFrom(address,address,uint256) returns (bool)"
]
```

---

## How it Works (High level)

Borrowers unlock credit without collateral by proving:

- **Identity/KYC** with **zkPassport** (privacy-preserving).
- **Financial reputation** with **vLayer**:
  - **Time‑Travel**: prove historical average balances.
  - **Teleporter**: prove cross‑chain liquidity without doxxing addresses.

Lenders provide liquidity in two tranches:

- **Senior (sUSDC)** — lower risk, priority in repayments, protected by junior buffer.  
- **Junior (jUSDC)** — higher yield, higher risk, absorbs first losses (can be negative in stress).

---

## Repository

```
/backend     → NestJS API (users, zk-passport, user journey, DB)
/contracts   → Solidity (Vault, Tranches, CreditLimitManager, RiskManager, Deploy scripts, Verifiers)
/frontend    → Vite + React + Tailwind (Borrow/Lend UI, proofs, /test page)
```

---

## Quick Start

### 1) Clone

```bash
git clone https://github.com/<your-org-or-user>/lendoor-polkadot
cd lendoor-polkadot
```

### 2) Backend

```bash
cd backend
cp .env.example .env   # if present
# fill values from the sample below
yarn install
yarn dev
```

**Backend `.env` sample**

```dotenv
# Self URL
VITE_PUBLIC_BACKEND_URL="http://localhost:5001"

# Dynamic (wallet)
VITE_PUBLIC_DYNAMIC_ENV_ID="7c0129ea-c276-419f-a158-a5ba44df52a3"

# vLayer (optional server-side)
VITE_PUBLIC_VLAYER_API_TOKEN=""
VITE_PUBLIC_VLAYER_PROVER_URL="https://stable-prod-prover.vlayer.xyz"

# vLayer verifier (Average Balance)
VITE_VLAYER_AVERAGE_BALANCE_ADDRESS="0x2C244c18b9D4E24Ad3f21e6BA7bFE0fFa492aB05"

# Protocol contracts
VITE_CREDIT_MANAGER_ADDRESS="0xf100c356aF3DC43DBB6bb3d62D4eE915E98cc8a9"

# Signer & network (Paseo EVM)
PRIVATE_KEY="<your_test_private_key>"
BASE_URL="http://localhost:5001"
RPC_URL="https://testnet-passet-hub-eth-rpc.polkadot.io"
```

### 3) Frontend

```bash
cd ../frontend
cp .env.example .env   # if present
# fill values from the sample below
yarn install
yarn dev
```

**Frontend `.env` sample**

```dotenv
VITE_PUBLIC_BACKEND_URL="http://localhost:5001"

# Dynamic (wallet) environment
VITE_PUBLIC_DYNAMIC_ENV_ID="7c0129ea-c276-419f-a158-a5ba44df52a3"

# vLayer (public)
VITE_PUBLIC_VLAYER_API_TOKEN="<your_vlayer_jwt_token>"
VITE_PUBLIC_VLAYER_PROVER_URL="https://stable-prod-prover.vlayer.xyz"

# vLayer verifier (Average Balance)
VITE_VLAYER_AVERAGE_BALANCE_ADDRESS="0x2C244c18b9D4E24Ad3f21e6BA7bFE0fFa492aB05"

# Deployed contracts (Paseo)
VITE_EVAULT="0x521555e6cf3a0062D22b6D08aAFc2F3a4761B8e2"
VITE_EVAULT_JUNIOR="0x9D075E2EA814ba0537607aD657a80fCd8f7ce131"
VITE_USDC="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"

# Optional (backend reads)
VITE_CREDIT_MANAGER_ADDRESS="0xf100c356aF3DC43DBB6bb3d62D4eE915E98cc8a9"
```

### 4) Contracts (Foundry)

```bash
cd ../contracts
forge install
forge build

# Example deploys (update RPC/PK)
forge script script/DeployCLM.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
forge script script/03_EVault.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
forge script script/DeployJuniorERC4626.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```

> Ensure `$RPC_URL` is the **Paseo** EVM RPC and the deploy key is funded test PK.  
> Update the addresses in your `.env` files after deploying.

---

## How to Test the Project

The frontend includes a minimal **`/test`** page that exercises read/write flows end‑to‑end.

1. **Connect Wallet** (Dynamic) and **switch to Paseo** if needed.
2. **Approve** USDC for the EVault (senior) and/or sUSDC for the Junior wrapper.
3. **Deposit**:
   - **USDC → sUSDC**: `EVault.deposit(assets, receiver)`
   - **sUSDC → jUSDC**: `JuniorERC4626.deposit(assets, receiver)` (via the junior wrapper)
4. **Borrow** within your **credit limit**: `EVault.borrow(assets, receiver)`
5. **Repay**: `EVault.repay(assets, receiver)`
6. **Withdraw**:
   - **sUSDC → USDC**: `EVault.withdraw(assets, receiver, owner)`
   - **jUSDC → sUSDC** (demote): `EVault.demoteToSenior(jShares, receiver)`  
     *(the UI computes `jShares` using `previewWithdrawJunior` and `convertToAssets`)*

The page also shows:

- Current **chain** and **account**,
- **Contract addresses** (linked to the explorer),
- Read‑only widgets for **credit line**, **sUSDC** and **jUSDC** balances,
- The **last transaction hash** and **log count**.

---

## Security & Disclaimers

- Hackathon demo — unaudited, experimental. Do **not** use in production or with real funds.
- Never commit secrets. Keep `.env` files private.
- Double‑check addresses and network endpoints before sending value.

---

## 🤝 Credits

Built with ❤️ by the **Lendoor** team for the **Latin Hack** (Polkadot).
