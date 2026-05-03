import { readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execa } from "execa";
import getPort from "get-port";
import { fetch } from "undici";
import { startSubmission, stopSubmission, type SubmissionHandle } from "./lifecycle.ts";
import { runCorrectness } from "./correctness.ts";
import { runPerformance } from "./performance.ts";
import { runFrontend } from "./frontend.ts";
import { computeScores } from "./score.ts";
import { writeReports } from "./report.ts";
import type { SubmissionResult } from "./types.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const LLMS_DIR = join(ROOT, "llms");
const RESULTS_DIR = join(ROOT, "results");

function killProcessGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (!pid) return;
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // already gone
    }
  }
}

async function waitForExit(proc: ReturnType<typeof execa>, ms: number): Promise<void> {
  await Promise.race([
    proc.catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

async function listSubmissions(): Promise<string[]> {
  const entries = await readdir(LLMS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

async function restartIfNeeded(handle: SubmissionHandle): Promise<SubmissionHandle> {
  if (handle.startup.startup_ok) return handle;
  // The correctness restart-persistence test stopped the original server.
  // Spin up a new one on a fresh port for the perf + frontend phases.
  const port = await getPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const proc = execa("npm", ["start"], {
    cwd: handle.dir,
    env: { ...process.env, PORT: String(port), DB_PATH: handle.dbPath },
    reject: false,
    all: true,
    detached: true,
  });
  const deadline = performance.now() + 30_000;
  while (performance.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/products`, { signal: AbortSignal.timeout(1000) });
      if (res.status === 200) {
        return { ...handle, port, baseUrl, proc, startup: { ...handle.startup, startup_ok: true } };
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  killProcessGroup(proc.pid, "SIGTERM");
  await waitForExit(proc, 2000);
  killProcessGroup(proc.pid, "SIGKILL");
  await waitForExit(proc, 500);
  return handle;
}

function emptyCorrectness() {
  return {
    correctness_total: 7,
    correctness_passed: 0,
    tests: {
      products_listed: false,
      cart_initially_empty: false,
      post_creates_item: false,
      duplicate_post_handled: false,
      patch_updates_quantity: false,
      delete_removes_item: false,
      restart_persistence: false,
    },
    primed_item_id: null,
  };
}

async function evaluateOne(name: string): Promise<SubmissionResult> {
  console.log(`\n=== ${name} ===`);
  const dir = join(LLMS_DIR, name);

  const initial = await startSubmission(dir);
  const result: SubmissionResult = {
    name,
    build: { ...initial.build },
    startup: { ...initial.startup },
    correctness: emptyCorrectness(),
    perf: null,
    frontend: null,
    correctness_pct: 0,
    frontend_pct: 0,
    perf_pct: 0,
    build_pct: 0,
    composite: 0,
  };
  console.log(`  build:   install=${initial.build.install_ok} (${initial.build.install_ms}ms)  build=${initial.build.build_ok} (${initial.build.build_ms}ms)`);
  console.log(`  startup: ok=${initial.startup.startup_ok} (${initial.startup.startup_ms}ms)`);

  let active = initial;
  try {
    if (!initial.startup.startup_ok) return result;

    result.correctness = await runCorrectness(active);
    console.log(`  correctness: ${result.correctness.correctness_passed}/${result.correctness.correctness_total}`);

    // Restart server for perf + frontend (correctness ended by killing the server).
    active = await restartIfNeeded(active);
    if (!active.startup.startup_ok) return result;

    const products = (await (await fetch(`${active.baseUrl}/api/products`)).json()) as { products: { id: string }[] };
    const productId = products.products[0]?.id;
    if (productId) {
      result.perf = await runPerformance(active, productId);
      console.log(`  perf: GET p95=${result.perf.get_cart_p95_ms}ms  POST p95=${result.perf.post_item_p95_ms}ms`);
    }

    result.frontend = await runFrontend(active);
    console.log(`  frontend: rendered=${result.frontend.page_rendered}  add=${result.frontend.add_works}  remove=${result.frontend.remove_works}  bundle=${result.frontend.bundle_bytes}B`);
  } finally {
    await stopSubmission(active);
  }

  return result;
}

async function main() {
  const names = await listSubmissions();
  if (names.length === 0) {
    console.error(`No submissions found in ${LLMS_DIR}`);
    process.exit(1);
  }
  console.log(`Evaluating ${names.length} submission(s): ${names.join(", ")}`);

  const results: SubmissionResult[] = [];
  for (const name of names) {
    try {
      results.push(await evaluateOne(name));
    } catch (err) {
      console.error(`  FAILED ${name}: ${(err as Error).message}`);
    }
  }

  computeScores(results);
  await writeReports(RESULTS_DIR, results);
  console.log(`\nWrote ${join(RESULTS_DIR, "results.json")} and ${join(RESULTS_DIR, "RESULTS.md")}`);
}

await main();
