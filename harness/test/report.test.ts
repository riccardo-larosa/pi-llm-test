import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeReports } from "../src/report.ts";
import type { SubmissionResult } from "../src/types.ts";

function s(name: string, composite: number): SubmissionResult {
  return {
    name,
    build: { install_ok: true, install_ms: 1, install_log: "", build_ok: true, build_ms: 1, build_log: "" },
    startup: { startup_ok: true, startup_ms: 1, startup_log: "" },
    correctness: { correctness_total: 7, correctness_passed: 7, tests: { products_listed: true, cart_initially_empty: true, post_creates_item: true, duplicate_post_handled: true, patch_updates_quantity: true, delete_removes_item: true, restart_persistence: true }, primed_item_id: "i1" },
    perf: { get_cart_p50_ms: 1, get_cart_p95_ms: 1, post_item_p50_ms: 1, post_item_p95_ms: 1 },
    frontend: { frontend_ok: true, page_rendered: true, add_works: true, remove_works: true, bundle_bytes: 100, dom_loaded_ms: 10 },
    correctness_pct: 100, frontend_pct: 100, perf_pct: 100, build_pct: 100, composite,
  };
}

test("writeReports writes JSON and Markdown sorted by composite desc", async () => {
  const dir = await mkdtemp(join(tmpdir(), "report-"));
  try {
    const results = [s("alpha", 80), s("beta", 95), s("gamma", 50)];
    await writeReports(dir, results);

    const json = JSON.parse(await readFile(join(dir, "results.json"), "utf8")) as SubmissionResult[];
    assert.equal(json.length, 3);

    const md = await readFile(join(dir, "RESULTS.md"), "utf8");
    const betaIdx = md.indexOf("beta");
    const alphaIdx = md.indexOf("alpha");
    const gammaIdx = md.indexOf("gamma");
    assert.ok(betaIdx >= 0 && alphaIdx >= 0 && gammaIdx >= 0);
    assert.ok(betaIdx < alphaIdx);
    assert.ok(alphaIdx < gammaIdx);
    assert.match(md, /\| Rank \| Submission \|/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
