import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fetch } from "undici";
import { startSubmission, stopSubmission } from "../src/lifecycle.ts";

const REF = resolve(import.meta.dirname, "../../llms/_reference");

test("startSubmission boots reference and reaches /api/products", async () => {
  const handle = await startSubmission(REF);
  try {
    assert.equal(handle.startup.startup_ok, true);
    const res = await fetch(`${handle.baseUrl}/api/products`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { products: unknown[] };
    assert.ok(Array.isArray(body.products));
    assert.ok(body.products.length > 0);
  } finally {
    await stopSubmission(handle);
  }
});

test("stopSubmission cleans up sqlite files", async () => {
  const handle = await startSubmission(REF);
  await stopSubmission(handle);
  // start again — fresh DB means cart is empty
  const handle2 = await startSubmission(REF);
  try {
    const res = await fetch(`${handle2.baseUrl}/api/cart`);
    const body = (await res.json()) as { items: unknown[] };
    assert.deepEqual(body.items, []);
  } finally {
    await stopSubmission(handle2);
  }
});
