import { execa } from "execa";
import getPort from "get-port";
import { fetch } from "undici";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
import type { BuildResult, StartupResult } from "./types.ts";

export type SubmissionHandle = {
  dir: string;
  port: number;
  baseUrl: string;
  proc: ReturnType<typeof execa>;
  build: BuildResult;
  startup: StartupResult;
  dbPath: string;
};

const STARTUP_TIMEOUT_MS = 30_000;

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = performance.now();
  const result = await fn();
  return { result, ms: Math.round(performance.now() - t0) };
}

async function waitForReady(baseUrl: string, deadlineMs: number): Promise<boolean> {
  while (performance.now() < deadlineMs) {
    try {
      const res = await fetch(`${baseUrl}/api/products`, { signal: AbortSignal.timeout(1000) });
      if (res.status === 200) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

export async function buildSubmission(dir: string): Promise<BuildResult> {
  const install = await timed(() =>
    execa("npm", ["install", "--no-audit", "--no-fund"], { cwd: dir, reject: false, all: true }),
  );
  const installOk = install.result.exitCode === 0;

  let buildOk = false;
  let buildMs = 0;
  let buildLog = "";
  if (installOk) {
    const build = await timed(() =>
      execa("npm", ["run", "build"], { cwd: dir, reject: false, all: true }),
    );
    buildOk = build.result.exitCode === 0;
    buildMs = build.ms;
    buildLog = build.result.all ?? "";
  }

  return {
    install_ok: installOk,
    install_ms: install.ms,
    install_log: install.result.all ?? "",
    build_ok: buildOk,
    build_ms: buildMs,
    build_log: buildLog,
  };
}

export async function startSubmission(dir: string): Promise<SubmissionHandle> {
  const absDir = resolve(dir);
  const dbPath = resolve(absDir, "data.sqlite");
  // Always start clean.
  await rm(dbPath, { force: true });
  await rm(`${dbPath}-journal`, { force: true });
  await rm(`${dbPath}-shm`, { force: true });
  await rm(`${dbPath}-wal`, { force: true });

  const build = await buildSubmission(absDir);

  const port = await getPort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const proc = execa("npm", ["start"], {
    cwd: absDir,
    env: { ...process.env, PORT: String(port), DB_PATH: dbPath },
    reject: false,
    all: true,
    detached: true,
  });

  // Drain stdout/stderr to a buffer so we can include in startup_log on failure.
  const logChunks: string[] = [];
  proc.all?.on("data", (b: Buffer) => logChunks.push(b.toString("utf8")));

  const startedAt = performance.now();
  const ok = build.install_ok && build.build_ok
    ? await waitForReady(baseUrl, startedAt + STARTUP_TIMEOUT_MS)
    : false;

  const startup: StartupResult = {
    startup_ok: ok,
    startup_ms: Math.round(performance.now() - startedAt),
    startup_log: logChunks.join("").slice(-4096),
  };

  return { dir: absDir, port, baseUrl, proc, build, startup, dbPath };
}

async function waitForExit(proc: ReturnType<typeof execa>, ms: number): Promise<void> {
  await Promise.race([
    proc.catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

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

export async function stopSubmission(handle: SubmissionHandle): Promise<void> {
  killProcessGroup(handle.proc.pid, "SIGTERM");
  await waitForExit(handle.proc, 2000);
  killProcessGroup(handle.proc.pid, "SIGKILL");
  await waitForExit(handle.proc, 500);

  await rm(handle.dbPath, { force: true });
  await rm(`${handle.dbPath}-journal`, { force: true });
  await rm(`${handle.dbPath}-shm`, { force: true });
  await rm(`${handle.dbPath}-wal`, { force: true });
}
