import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScores } from "../src/score.ts";
import type { SubmissionResult } from "../src/types.ts";

function fixture(over: Partial<SubmissionResult> = {}): SubmissionResult {
  return {
    name: over.name ?? "x",
    build: { install_ok: true, install_ms: 1000, install_log: "", build_ok: true, build_ms: 100, build_log: "" },
    startup: { startup_ok: true, startup_ms: 500, startup_log: "" },
    correctness: {
      correctness_total: 7, correctness_passed: 7,
      tests: { products_listed: true, cart_initially_empty: true, post_creates_item: true, duplicate_post_handled: true, patch_updates_quantity: true, delete_removes_item: true, restart_persistence: true },
      primed_item_id: "i1",
    },
    perf: { get_cart_p50_ms: 5, get_cart_p95_ms: 10, post_item_p50_ms: 5, post_item_p95_ms: 10 },
    frontend: { frontend_ok: true, page_rendered: true, add_works: true, remove_works: true, bundle_bytes: 1000, dom_loaded_ms: 100 },
    correctness_pct: 0, frontend_pct: 0, perf_pct: 0, build_pct: 0, composite: 0,
    ...over,
  };
}

test("perfect submission scores 100", () => {
  const [scored] = computeScores([fixture()]);
  assert.equal(scored.correctness_pct, 100);
  assert.equal(scored.frontend_pct, 100);
  assert.equal(scored.perf_pct, 100);
  assert.equal(scored.build_pct, 100);
  assert.equal(scored.composite, 100);
});

test("failed build yields composite 0 but other metrics still recorded", () => {
  const broken = fixture({
    name: "broken",
    build: { install_ok: false, install_ms: 0, install_log: "", build_ok: false, build_ms: 0, build_log: "" },
    startup: { startup_ok: false, startup_ms: 0, startup_log: "" },
    correctness: { correctness_total: 7, correctness_passed: 0, tests: { products_listed: false, cart_initially_empty: false, post_creates_item: false, duplicate_post_handled: false, patch_updates_quantity: false, delete_removes_item: false, restart_persistence: false }, primed_item_id: null },
    perf: null,
    frontend: null,
  });
  const [scored] = computeScores([broken]);
  assert.equal(scored.build_pct, 0);
  assert.equal(scored.correctness_pct, 0);
  assert.equal(scored.frontend_pct, 0);
  assert.equal(scored.perf_pct, 0);
  assert.equal(scored.composite, 0);
});

test("perf is normalized: best gets 100, slower gets less", () => {
  const fast = fixture({ name: "fast", perf: { get_cart_p50_ms: 1, get_cart_p95_ms: 2, post_item_p50_ms: 1, post_item_p95_ms: 2 }, frontend: { frontend_ok: true, page_rendered: true, add_works: true, remove_works: true, bundle_bytes: 100, dom_loaded_ms: 10 } });
  const slow = fixture({ name: "slow", perf: { get_cart_p50_ms: 2, get_cart_p95_ms: 4, post_item_p50_ms: 2, post_item_p95_ms: 4 }, frontend: { frontend_ok: true, page_rendered: true, add_works: true, remove_works: true, bundle_bytes: 200, dom_loaded_ms: 20 } });
  const scored = computeScores([fast, slow]);
  const fastS = scored.find((s) => s.name === "fast")!;
  const slowS = scored.find((s) => s.name === "slow")!;
  assert.equal(fastS.perf_pct, 100);
  assert.ok(slowS.perf_pct < fastS.perf_pct);
  assert.ok(slowS.perf_pct > 0);
});
