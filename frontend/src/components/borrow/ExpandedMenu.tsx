"use client";

import React, { useState } from 'react';
import { InfoTip } from "../common/InfoTooltip"
import { useIsLoggedIn } from '@dynamic-labs/sdk-react-core'
import { Button } from "../ui/button";
import { useVLayer } from '@/components/providers/VLayerProvider';

const ExpandedMenu = ({score}) => {
  const isLoggedIn = useIsLoggedIn();
  const { isReady, userAddress, proveAverageBalance } = useVLayer();

  const [loading, setLoading] = useState(false);
  const [avgResult, setAvgResult] = useState<any>(null);
  const [error, setError] = useState<string>();
  const onTeleport = () => {

  }
  const onTimeTravel = async () => {
    console.log(isReady);
  if (!isReady || !userAddress) {
    setError('Wallet no conectada o provider no listo');
    return;
  }

  try {
    setLoading(true);
    setError(undefined);

    // Llama al helper del contexto; por defecto usa userAddress si no le pasás owner
    const res = await proveAverageBalance(userAddress);

    setAvgResult({
      owner: res.owner,
      avgBalance: res.avgBalance.toString(),
      proof: res.proof,
    });
  } catch (err: any) {
    console.error(err);
    setError(err?.message ?? 'Error desconocido');
  } finally {
    setLoading(false);
  }
};

    return <div className="mt-3 space-y-3">
        <div className="text-xs font-medium text-muted-foreground">CREDIT SCORE</div>

        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary rounded-full" />
            <span className="text-xs">Lendoor Score</span>
            <InfoTip
                contentClassName="font-display text-[11px] leading-snug"
                label={"Reputation-based score used to size limits and price risk."}
                side="top"
            />
            </div>
            <span className="text-xs">{score}</span>
        </div>

        <div className="text-xs font-medium text-muted-foreground mt-3">ASSETS</div>

        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="text-xs">🕰️</span>
                <span className="text-xs">Time Travel</span>
                <InfoTip
                label="Average wallet balance over the last 12 months for the presented wallet."
                variant="light" side="top"
                />
            </div>
            {isLoggedIn ? (
                <Button size="sm" className="cursor-pointer h-7" onClick={onTimeTravel}>
                    Check   
                </Button>
            ) : (
                <span className="text-xs">$0</span>
            )}
        </div>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="text-xs">🛸</span>
                <span className="text-xs">Teleport</span>
                <InfoTip
                label="Current cross-chain wallet balance (aggregated across supported networks)."
                variant="light" side="top"
                />
            </div>
            {isLoggedIn ? (
                <Button size="sm" className="h-7" disabled onClick={onTeleport}>
                    Soon..
                </Button>
            ) : (
                <span className="text-xs">$0</span>
            )}
        </div>
    </div>
}

export default ExpandedMenu