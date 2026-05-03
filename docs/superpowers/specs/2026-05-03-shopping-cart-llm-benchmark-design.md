# Shopping Cart LLM Benchmark — Design

## Goal

A reproducible coding test that asks each LLM to build the same small full-stack app (a shopping cart) and produces a head-to-head comparison across correctness, frontend behavior, performance, and build reliability.

## Approach summary

- **Constrained stack:** TypeScript + Hono + `better-sqlite3` + vanilla HTML/CSS/JS frontend.
- **Thin contract:** the prompt pins endpoint paths, response shapes, run scripts, and two `data-testid` attributes. Everything else (DB schema, file layout, validation, frontend styling) is up to the LLM.
- **Each LLM submission lives in its own subdirectory** under `llms/`, treated as an independent project.
- **Single harness** runs `npm install`, `npm run build`, `npm start`, then probes the API and a Playwright-driven frontend. Records all metrics to JSON and a Markdown leaderboard.
- **Composite score (0–100)** combines correctness (60%), frontend (20%), performance (15%), build (5%).

## Repo layout

```
pi-llm-test/
├── README.md
├── spec/
│   ├── PROMPT.md                # the exact prompt sent to each LLM
│   └── CONTRACT.md              # the thin contract (endpoints, scripts, testids)
├── harness/
│   ├── package.json
│   ├── run.ts                   # entry: orchestrates all LLM evaluations
│   ├── correctness.ts           # API CRUD + persistence tests
│   ├── performance.ts           # latency, bundle size
│   ├── frontend.ts              # Playwright headless check
│   └── report.ts                # writes results.json + RESULTS.md
├── llms/
│   ├── claude-sonnet-4-5/       # one subdir per LLM, each is a full app
│   ├── gpt-5/
│   └── gemini-2.5/
└── results/
    ├── results.json             # all runs, all metrics
    └── RESULTS.md               # human-readable comparison table sorted by composite score
```

## The thin contract (`spec/CONTRACT.md`)

### Required stack
- TypeScript
- Hono (backend)
- `better-sqlite3` (file-based SQLite, must survive process restart; in-memory rejected)
- Vanilla HTML/CSS/JS frontend (no React, Vue, Svelte, or other UI frameworks)

### Required scripts (in submission's `package.json`)
- `npm install` — installs dependencies
- `npm run build` — produces a frontend bundle in `./dist/` (or wherever `npm start` serves from). May be a no-op if the LLM doesn't need a build step, but the script must exist and exit 0.
- `npm start` — starts the server on port from `PORT` env var (default 3000), serving both API and frontend.

### Required API

| Method   | Path                  | Body                                       | Response                       |
|----------|-----------------------|--------------------------------------------|--------------------------------|
| `GET`    | `/api/products`       | —                                          | `200 { products: Product[] }`  |
| `GET`    | `/api/cart`           | —                                          | `200 { items: CartItem[] }`    |
| `POST`   | `/api/cart/items`     | `{ productId: string, quantity: number }`  | `201 { item: CartItem }`       |
| `PATCH`  | `/api/cart/items/:id` | `{ quantity: number }`                     | `200 { item: CartItem }`       |
| `DELETE` | `/api/cart/items/:id` | —                                          | `204`                          |

```ts
type Product  = { id: string; name: string; priceCents: number }
type CartItem = { id: string; productId: string; name: string; quantity: number; priceCents: number }
```

### Required behavior
- Single anonymous cart per server instance. No auth, no users.
- Seed ~5 products on first startup (LLM picks names/prices in cents). Products must exist before the harness probes `/api/products`.
- Frontend served at `/`. Must display cart items (name + quantity + price), allow adding a product, changing quantity, and removing items. Must use the API above — no separate client state store.

### Required frontend test hooks
- Each "add to cart" control must have `data-testid="add-to-cart"`.
- Each "remove item" control must have `data-testid="remove-item"`.

### Free for the LLM
DB schema details, table count, validation rules, error response shape, frontend layout/styling, file organization, persistence implementation. Multi-row vs. quantity-merge on duplicate `POST` is the LLM's choice — the harness accepts either.

## The prompt (`spec/PROMPT.md`)

Verbatim text shipped to each LLM:

> # Shopping Cart Coding Test
>
> Build a small shopping cart application. You have full freedom over implementation details, file structure, and styling — only the items below are required.
>
> ## Required stack
> - **Language:** TypeScript
> - **Backend:** Hono
> - **Database:** SQLite via `better-sqlite3` (file-based, must survive process restart)
> - **Frontend:** vanilla HTML/CSS/JS — no React, Vue, Svelte, or other UI frameworks
>
> ## Required behavior
> - Single anonymous cart (no auth, no users). Server holds one cart.
> - Seed ~5 products on first startup (you pick names/prices in cents).
> - Frontend served at `/`, lets the user view the cart, add a product, change quantity, and remove items. It must use the API below — no separate client state store.
> - Each "add to cart" button must have `data-testid="add-to-cart"`. Each "remove item" button must have `data-testid="remove-item"`.
>
> ## Required API
>
> | Method   | Path                  | Body                                       | Response                       |
> |----------|-----------------------|--------------------------------------------|--------------------------------|
> | `GET`    | `/api/products`       | —                                          | `200 { products: Product[] }`  |
> | `GET`    | `/api/cart`           | —                                          | `200 { items: CartItem[] }`    |
> | `POST`   | `/api/cart/items`     | `{ productId: string, quantity: number }`  | `201 { item: CartItem }`       |
> | `PATCH`  | `/api/cart/items/:id` | `{ quantity: number }`                     | `200 { item: CartItem }`       |
> | `DELETE` | `/api/cart/items/:id` | —                                          | `204`                          |
>
> ```ts
> type Product  = { id: string; name: string; priceCents: number }
> type CartItem = { id: string; productId: string; name: string; quantity: number; priceCents: number }
> ```
>
> ## Required scripts (in `package.json`)
> - `npm install` — installs dependencies
> - `npm run build` — produces a frontend bundle if your setup needs one (no-op is fine; script must exit 0)
> - `npm start` — starts the server on the port given by `PORT` (default 3000), serving both the API and the frontend
>
> ## Deliverables
> A complete project at the root of your working directory: `package.json`, source files, and any config needed. The grader will run `npm install`, `npm run build`, then `npm start`, and probe the API and frontend.

## Harness pipeline

For each `llms/<name>/`, the harness runs all phases in order, capturing logs and metrics. Failure in an early phase records 0 on downstream metrics but does not abort the overall run.

### Phase 1 — Build
1. `npm install` (timed)
2. `npm run build` (timed)

Metrics: `install_ms`, `build_ms`, `install_ok`, `build_ok`.

### Phase 2 — Startup
3. Spawn `npm start` with a unique `PORT`. Poll `GET /api/products` until 200 OK or 30s timeout.

Metrics: `startup_ms`, `startup_ok`.

### Phase 3 — Correctness
Sequence of API probes (each pass/fail):
1. `GET /api/products` returns ≥1 product matching `Product` shape.
2. `GET /api/cart` on fresh DB returns `{ items: [] }`.
3. `POST /api/cart/items` with valid productId returns 201 + correct shape.
4. Duplicate `POST` → quantity merges OR second row appears (both accepted).
5. `PATCH /api/cart/items/:id` updates quantity; `GET /api/cart` reflects it.
6. `DELETE /api/cart/items/:id` returns 204; `GET /api/cart` no longer contains it.
7. **Restart persistence:** kill server, restart, `GET /api/cart` still contains an item added before the kill.

Metrics: `correctness_passed`, `correctness_total` (= 7), plus per-test booleans.

### Phase 4 — API performance
With cart pre-populated:
- 50 warm `GET /api/cart` requests, record p50 and p95 latency.
- 20 warm `POST /api/cart/items` requests, record p50 and p95.

Metrics: `get_cart_p50_ms`, `get_cart_p95_ms`, `post_item_p50_ms`, `post_item_p95_ms`.

### Phase 5 — Frontend (Playwright headless)
1. Load `/`, wait for network idle.
2. Assert page text contains the name of at least one cart item (proves API was called).
3. Click first `[data-testid="add-to-cart"]`; assert cart length increased via API.
4. Click first `[data-testid="remove-item"]`; assert cart length decreased via API.
5. Capture total bytes for `/` + all sub-resources; capture DOMContentLoaded time.

Metrics: `frontend_ok`, `page_rendered`, `add_works`, `remove_works`, `bundle_bytes`, `dom_loaded_ms`.

### Phase 6 — Cleanup
Kill server, delete the submission's SQLite file, move on.

## Composite score

```
score = correctness_pct * 0.60
      + frontend_pct    * 0.20
      + perf_pct        * 0.15
      + build_pct       * 0.05
```

- `correctness_pct` = `correctness_passed / correctness_total * 100` (7 API tests including restart persistence).
- `frontend_pct` = `(page_rendered + add_works + remove_works) / 3 * 100`.
- `perf_pct` = normalized latency + bundle score, scaled so the best submission gets 100 and others scale linearly. Computed *after* all LLMs finish (relative). Formula: average of four normalized sub-scores — one per metric `m` in `{get_cart_p95_ms, post_item_p95_ms, bundle_bytes, dom_loaded_ms}`, where `sub = best_m / submission_m * 100`.
- `build_pct` = 100 if `install_ok && build_ok && startup_ok`, else 0.

Failing build/startup yields composite 0, but all collected metrics still appear in the table.

## Output

- **`results/results.json`** — full structured record per LLM (all phase logs + metrics + booleans).
- **`results/RESULTS.md`** — human-readable table sorted by composite score, columns for each headline metric, with a footnote linking each row to its log file.

## Out of scope (YAGNI)

- No multi-user / auth / sessions.
- No checkout / payment flow.
- No product catalog management API (products are LLM-seeded and static).
- No CI integration in v1 — local run only.
- No re-running an LLM in a loop / averaging across runs in v1 (single run per submission).
- No automated LLM invocation — submissions are placed in `llms/<name>/` manually.
