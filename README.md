# pi-llm-test

A reproducible coding test that asks each LLM to build the same small full-stack shopping-cart app, then scores them on correctness, frontend behavior, performance, and build reliability.

## Layout

- `spec/` — the prompt and contract every LLM must satisfy.
- `harness/` — the test runner.
- `llms/<name>/` — one subdirectory per LLM submission. Each is a complete project rooted at the subdir.
- `llms/_reference/` — a hand-written submission used to validate the harness.
- `results/` — generated output.

## Add a new submission

1. Copy the LLM's output into a new directory `llms/<llm-name>/`.
2. Make sure it has `npm install`, `npm run build`, `npm start` scripts (see `spec/CONTRACT.md`).
3. Run the harness:

```bash
cd harness
npm install
npm run bench
```

## Run harness self-tests

```bash
cd harness
npm install
npm test
```

Self-tests run against `llms/_reference/`.

## Scoring

See `docs/superpowers/specs/2026-05-03-shopping-cart-llm-benchmark-design.md` for the full design and composite-score formula.

## Interpreting results

- `results/RESULTS.md` is the human-readable leaderboard. It's checked into git so you can browse historical runs.
- `results/results.json` is the raw machine-readable record (gitignored — too noisy for git).
- The composite score weights are: 60% correctness, 20% frontend, 15% performance (normalized across the run), 5% build/startup. A submission that fails build or startup gets composite 0 even if other metrics happen to be recorded.

## Notes for adding more LLMs

- The harness discovers submissions automatically — drop a new directory under `llms/` and re-run `npm run bench`.
- Submissions whose name starts with `.` are skipped (e.g. `.draft/`). `_reference/` is included on purpose so you can see the harness self-validate every run.
