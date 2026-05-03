import { fetch } from "undici";
import type { PerfResult } from "./types.ts";
import type { SubmissionHandle } from "./lifecycle.ts";

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return Number.NaN;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx]!;
}

async function timeOnce(fn: () => Promise<unknown>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

export async function runPerformance(handle: SubmissionHandle, productId: string): Promise<PerfResult> {
  // Warm up — discard 10 requests.
  for (let i = 0; i < 10; i++) await fetch(`${handle.baseUrl}/api/cart`);

  // GET /api/cart x50
  const getSamples: number[] = [];
  for (let i = 0; i < 50; i++) {
    getSamples.push(await timeOnce(() => fetch(`${handle.baseUrl}/api/cart`).then((r) => r.text())));
  }
  getSamples.sort((a, b) => a - b);

  // POST /api/cart/items x20
  const postSamples: number[] = [];
  for (let i = 0; i < 20; i++) {
    postSamples.push(await timeOnce(() =>
      fetch(`${handle.baseUrl}/api/cart/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      }).then((r) => r.text()),
    ));
  }
  postSamples.sort((a, b) => a - b);

  return {
    get_cart_p50_ms: Math.round(percentile(getSamples, 50) * 100) / 100,
    get_cart_p95_ms: Math.round(percentile(getSamples, 95) * 100) / 100,
    post_item_p50_ms: Math.round(percentile(postSamples, 50) * 100) / 100,
    post_item_p95_ms: Math.round(percentile(postSamples, 95) * 100) / 100,
  };
}
