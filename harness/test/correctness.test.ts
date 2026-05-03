import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { startSubmission, stopSubmission } from "../src/lifecycle.ts";
import { runCorrectness } from "../src/correctness.ts";

const REF = resolve(import.meta.dirname, "../../llms/_reference");

test("runCorrectness against reference passes all 7 tests", async () => {
  const handle = await startSubmission(REF);
  try {
    const result = await runCorrectness(handle);
    assert.equal(result.correctness_total, 7);
    assert.equal(result.correctness_passed, 7, JSON.stringify(result.tests));
    assert.ok(result.primed_item_id);
  } finally {
    await stopSubmission(handle);
  }
});
