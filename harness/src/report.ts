import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SubmissionResult } from "./types.ts";

export async function writeReports(outDir: string, results: SubmissionResult[]): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const sorted = [...results].sort((a, b) => b.composite - a.composite);

  await writeFile(join(outDir, "results.json"), JSON.stringify(sorted, null, 2), "utf8");

  const lines: string[] = [];
  lines.push("# Shopping Cart LLM Benchmark — Results", "");
  lines.push(`Generated: ${new Date().toISOString()}`, "");
  lines.push("| Rank | Submission | Composite | Correctness | Frontend | Perf | Build | Install ms | Build ms | Startup ms | GET p95 | POST p95 | Bundle bytes | DOM ms |");
  lines.push("|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");

  sorted.forEach((r, i) => {
    const perf = r.perf;
    const fe = r.frontend;
    lines.push(
      `| ${i + 1} | \`${r.name}\` | ${r.composite} | ${r.correctness_pct} | ${r.frontend_pct} | ${r.perf_pct} | ${r.build_pct} `
      + `| ${r.build.install_ms} | ${r.build.build_ms} | ${r.startup.startup_ms} `
      + `| ${perf ? perf.get_cart_p95_ms : "—"} | ${perf ? perf.post_item_p95_ms : "—"} `
      + `| ${fe ? fe.bundle_bytes : "—"} | ${fe ? fe.dom_loaded_ms : "—"} |`,
    );
  });

  lines.push("", "## Per-submission correctness breakdown", "");
  for (const r of sorted) {
    lines.push(`### \`${r.name}\` — passed ${r.correctness.correctness_passed}/${r.correctness.correctness_total}`);
    for (const [k, v] of Object.entries(r.correctness.tests)) {
      lines.push(`- ${v ? "✅" : "❌"} ${k}`);
    }
    lines.push("");
  }

  await writeFile(join(outDir, "RESULTS.md"), lines.join("\n"), "utf8");
}
