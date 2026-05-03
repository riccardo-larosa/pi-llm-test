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
