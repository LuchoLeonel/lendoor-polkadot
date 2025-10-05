// src/components/providers/DynamicProvider.tsx
import React from 'react';
import { DynamicContextProvider, mergeNetworks } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { evmNetworks as customNetworks } from '@/lib/utils';

export function DynamicProvider({ children }: { children: React.ReactNode }) {
  const mergedNetworks = mergeNetworks(customNetworks, []);

  const envId =
    import.meta.env.VITE_PUBLIC_DYNAMIC_ENV_ID ??
    import.meta.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;

  if (!envId) {
    console.error('⛔ Missing VITE_PUBLIC_DYNAMIC_ENV_ID (o NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID).');
    // Evitá crashear el árbol si falta la env
    return <>{children}</>;
  }

  return (
    <DynamicContextProvider
      settings={{
        environmentId: envId,
        walletConnectors: [EthereumWalletConnectors],
        overrides: { evmNetworks: mergedNetworks },
        recommendedWallets: [
          { walletKey: 'metamask', label: 'Recommended' },
          { walletKey: 'defiant', label: 'Popular' },
        ],
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}
