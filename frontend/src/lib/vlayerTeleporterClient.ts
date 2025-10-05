import { createVlayerClient } from "@vlayer/sdk";

export const vlayerClient = createVlayerClient({
  url: import.meta.env.VITE_PUBLIC_VLAYER_PROVER_URL!,
  token: import.meta.env.VITE_PUBLIC_VLAYER_API_TOKEN!,
});