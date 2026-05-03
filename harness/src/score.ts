import type { SubmissionResult } from "./types.ts";

const PERF_KEYS = ["get_cart_p95_ms", "post_item_p95_ms"] as const;
const FRONTEND_PERF_KEYS = ["bundle_bytes", "dom_loaded_ms"] as const;

export function computeScores(results: SubmissionResult[]): SubmissionResult[] {
  // 1. Correctness, frontend, build (independent per submission)
  for (const r of results) {
    r.correctness_pct = r.correctness.correctness_total === 0
      ? 0
      : (r.correctness.correctness_passed / r.correctness.correctness_total) * 100;

    if (r.frontend) {
      const checks = [r.frontend.page_rendered, r.frontend.add_works, r.frontend.remove_works];
      r.frontend_pct = (checks.filter(Boolean).length / checks.length) * 100;
    } else {
      r.frontend_pct = 0;
    }

    r.build_pct = r.build.install_ok && r.build.build_ok && r.startup.startup_ok ? 100 : 0;
  }

  // 2. Perf — normalize across submissions. Lower is better for all four metrics.
  // For each metric, find best (min). Submission's sub-score = best / submission_value * 100.
  // Submissions with no perf or no frontend get 0.
  const perfBests: Record<string, number> = {};
  for (const k of PERF_KEYS) {
    const vals = results.map((r) => r.perf?.[k]).filter((v): v is number => Number.isFinite(v) && (v as number) > 0);
    if (vals.length > 0) perfBests[k] = Math.min(...vals);
  }
  for (const k of FRONTEND_PERF_KEYS) {
    const vals = results.map((r) => r.frontend?.[k]).filter((v): v is number => Number.isFinite(v) && (v as number) > 0);
    if (vals.length > 0) perfBests[k] = Math.min(...vals);
  }

  for (const r of results) {
    if (!r.perf || !r.frontend) {
      r.perf_pct = 0;
      continue;
    }
    const subScores: number[] = [];
    for (const k of PERF_KEYS) {
      const v = r.perf[k];
      if (Number.isFinite(perfBests[k]) && Number.isFinite(v) && v > 0) {
        subScores.push((perfBests[k]! / v) * 100);
      }
    }
    for (const k of FRONTEND_PERF_KEYS) {
      const v = r.frontend[k];
      if (Number.isFinite(perfBests[k]) && Number.isFinite(v) && v > 0) {
        subScores.push((perfBests[k]! / v) * 100);
      }
    }
    r.perf_pct = subScores.length === 0 ? 0 : subScores.reduce((a, b) => a + b, 0) / subScores.length;
  }

  // 3. Composite. Build failure zeroes the whole thing.
  for (const r of results) {
    if (r.build_pct === 0) {
      r.composite = 0;
      continue;
    }
    r.composite = r.correctness_pct * 0.6
      + r.frontend_pct * 0.2
      + r.perf_pct * 0.15
      + r.build_pct * 0.05;
  }

  // Round all percentages to 1 decimal for cleanliness.
  for (const r of results) {
    r.correctness_pct = Math.round(r.correctness_pct * 10) / 10;
    r.frontend_pct = Math.round(r.frontend_pct * 10) / 10;
    r.perf_pct = Math.round(r.perf_pct * 10) / 10;
    r.build_pct = Math.round(r.build_pct * 10) / 10;
    r.composite = Math.round(r.composite * 10) / 10;
  }

  return results;
}
