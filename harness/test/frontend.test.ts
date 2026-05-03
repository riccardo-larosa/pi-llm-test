import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { startSubmission, stopSubmission } from "../src/lifecycle.ts";
import { runFrontend } from "../src/frontend.ts";

const REF = resolve(import.meta.dirname, "../../llms/_reference");

test("runFrontend against reference: page renders and add/remove work", async () => {
  const handle = await startSubmission(REF);
  try {
    const result = await runFrontend(handle);
    assert.equal(result.frontend_ok, true, JSON.stringify(result));
    assert.equal(result.page_rendered, true);
    assert.equal(result.add_works, true);
    assert.equal(result.remove_works, true);
    assert.ok(result.bundle_bytes > 0);
    assert.ok(Number.isFinite(result.dom_loaded_ms));
  } finally {
    await stopSubmission(handle);
  }
});
