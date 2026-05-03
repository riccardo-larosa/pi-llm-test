import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fetch } from "undici";
import { startSubmission, stopSubmission } from "../src/lifecycle.ts";
import { runPerformance } from "../src/performance.ts";

const REF = resolve(import.meta.dirname, "../../llms/_reference");

test("runPerformance returns finite latencies for reference", async () => {
  const handle = await startSubmission(REF);
  try {
    // Prime: add one item so /api/cart isn't empty.
    const products = (await (await fetch(`${handle.baseUrl}/api/products`)).json()) as { products: { id: string }[] };
    const productId = products.products[0]!.id;
    const result = await runPerformance(handle, productId);
    assert.ok(Number.isFinite(result.get_cart_p50_ms));
    assert.ok(Number.isFinite(result.get_cart_p95_ms));
    assert.ok(Number.isFinite(result.post_item_p50_ms));
    assert.ok(Number.isFinite(result.post_item_p95_ms));
    assert.ok(result.get_cart_p95_ms >= result.get_cart_p50_ms);
    assert.ok(result.post_item_p95_ms >= result.post_item_p50_ms);
  } finally {
    await stopSubmission(handle);
  }
});
