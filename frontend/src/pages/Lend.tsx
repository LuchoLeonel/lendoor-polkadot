// app/lend/page.tsx
"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { LendMarket } from "@/components/lend/LendMarket";

export default function LendPage() {
  const { setShowAuthFlow } = useDynamicContext();

  return (
    <div className="container mx-auto w-full max-w-3xl">
        <LendMarket />
    </div>
  );
}
