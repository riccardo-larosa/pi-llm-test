# Shopping Cart LLM Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a harness that runs each LLM submission under `llms/<name>/`, probes its API + frontend, and produces a JSON record and Markdown leaderboard scored by the composite formula in the spec.

**Architecture:** A single Node + TypeScript harness in `harness/`. It iterates each subdirectory under `llms/`, runs `npm install` → `npm run build` → `npm start` with a unique port, then runs four phase modules (correctness, performance, frontend, score). Phase modules return structured results that `run.ts` aggregates. `report.ts` writes `results/results.json` and `results/RESULTS.md`. A built-in reference submission under `llms/_reference/` is used to validate the harness end-to-end via TDD.

**Tech Stack:**
- Harness: Node 20+, TypeScript, `tsx` for execution, `playwright` for frontend probes, `node:test` + `node:assert` for harness self-tests, `execa` for subprocess control, `get-port` for port allocation, `undici` for HTTP probes.
- Reference submission: TypeScript, Hono, `better-sqlite3`, vanilla HTML/JS — same constraints we impose on LLMs.

---

## File structure

Plan-of-record for what files exist and what each owns. Files are designed for isolation: each phase module is independently testable.

**Spec (already from design doc, materialized here):**
- `spec/PROMPT.md` — verbatim prompt sent to each LLM.
- `spec/CONTRACT.md` — thin contract (endpoints, scripts, testids, behavior).

**Harness (`harness/`):**
- `harness/package.json` — deps + `npm test` + `npm run bench` scripts.
- `harness/tsconfig.json` — strict TS config.
- `harness/src/types.ts` — shared types: `SubmissionResult`, `CorrectnessResult`, `PerfResult`, `FrontendResult`, `BuildResult`, etc.
- `harness/src/lifecycle.ts` — start/stop a submission server (spawn, wait-for-ready, kill, cleanup).
- `harness/src/correctness.ts` — Phase 3: 7 API CRUD + restart-persistence tests. Pure function: `(baseUrl, lifecycle) => CorrectnessResult`.
- `harness/src/performance.ts` — Phase 4: latency probes. `(baseUrl, primedItemId) => PerfResult`.
- `harness/src/frontend.ts` — Phase 5: Playwright headless. `(baseUrl) => FrontendResult`.
- `harness/src/score.ts` — composite score + per-metric normalization. Pure: `(SubmissionResult[]) => SubmissionResult[]` (mutates in `perf_pct` + `composite`).
- `harness/src/report.ts` — writes `results/results.json` and `results/RESULTS.md`. Pure given inputs.
- `harness/src/run.ts` — entry point. Discovers `llms/*/`, runs full pipeline per submission, calls `score.ts` + `report.ts`.
- `harness/test/correctness.test.ts` — runs against reference submission.
- `harness/test/performance.test.ts` — runs against reference submission.
- `harness/test/frontend.test.ts` — runs against reference submission.
- `harness/test/score.test.ts` — pure unit tests with synthetic inputs.
- `harness/test/report.test.ts` — pure unit tests with synthetic inputs.
- `harness/test/lifecycle.test.ts` — runs against reference submission.

**Reference submission (`llms/_reference/`):**
- `llms/_reference/package.json` — `install`, `build` (no-op), `start` scripts.
- `llms/_reference/tsconfig.json`
- `llms/_reference/src/server.ts` — Hono app + sqlite + static file serving + seed.
- `llms/_reference/public/index.html` — single-page frontend with required `data-testid` attrs.
- `llms/_reference/public/app.js` — vanilla JS that hits the API.
- `llms/_reference/public/style.css`
- `llms/_reference/.gitignore` — ignore `*.sqlite`, `node_modules`.

**Top-level:**
- `README.md` — what this is, how to add a submission, how to run the harness.
- `.gitignore` — `node_modules`, `results/*.json` (keep `RESULTS.md`), `*.sqlite`, `playwright-report/`.

**Output:**
- `results/results.json` — generated.
- `results/RESULTS.md` — generated.

---

## Conventions

- **Each task is fully self-contained.** Code blocks include the entire file contents the first time a file is touched, and full replacement contents on later edits. The implementer never has to look at another task's code to know what a file currently contains.
- **TDD discipline:** for every phase module, write a test against the reference submission first, see it fail (because the module doesn't exist yet or returns wrong values), then implement.
- **Reference submission is built first** so the phase tests have something to run against. It's also the canary: if the harness ever flags it as failing the contract, the contract or harness has a bug.
- **Commit after every passing step.** Commit messages use conventional commits (`feat:`, `test:`, `chore:`).

---

## Task 1: Top-level scaffolding

**Files:**
- Create: `README.md`
- Create: `.gitignore`
- Create: `spec/PROMPT.md`
- Create: `spec/CONTRACT.md`

- [ ] **Step 1: Write `.gitignore`**

```
node_modules/
*.sqlite
*.sqlite-journal
*.sqlite-shm
*.sqlite-wal
playwright-report/
.playwright/
results/results.json
.DS_Store
*.log
dist/
```

- [ ] **Step 2: Write `README.md`**

```markdown
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
```

- [ ] **Step 3: Write `spec/PROMPT.md`** (verbatim from the design doc)

```markdown
# Shopping Cart Coding Test

Build a small shopping cart application. You have full freedom over implementation details, file structure, and styling — only the items below are required.

## Required stack
- **Language:** TypeScript
- **Backend:** Hono
- **Database:** SQLite via `better-sqlite3` (file-based, must survive process restart)
- **Frontend:** vanilla HTML/CSS/JS — no React, Vue, Svelte, or other UI frameworks

## Required behavior
- Single anonymous cart (no auth, no users). Server holds one cart.
- Seed ~5 products on first startup (you pick names/prices in cents).
- Frontend served at `/`, lets the user view the cart, add a product, change quantity, and remove items. It must use the API below — no separate client state store.
- Each "add to cart" button must have `data-testid="add-to-cart"`. Each "remove item" button must have `data-testid="remove-item"`.

## Required API

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

## Required scripts (in `package.json`)
- `npm install` — installs dependencies
- `npm run build` — produces a frontend bundle if your setup needs one (no-op is fine; script must exit 0)
- `npm start` — starts the server on the port given by `PORT` (default 3000), serving both the API and the frontend

## Deliverables
A complete project at the root of your working directory: `package.json`, source files, and any config needed. The grader will run `npm install`, `npm run build`, then `npm start`, and probe the API and frontend.
```

- [ ] **Step 4: Write `spec/CONTRACT.md`** (machine-readable summary mirroring the prompt)

```markdown
# Contract

This file is authoritative for the harness. The prompt (`PROMPT.md`) is the human-facing version.

## Process contract

The submission directory must support:

```bash
npm install
npm run build         # may be a no-op; must exit 0
PORT=<n> npm start    # starts server on port <n>, serves API + frontend at /
```

`npm start` must keep running until killed. The server must respond to `GET /api/products` with 200 within 30s of spawn.

## API contract

| Method   | Path                  | Request body                               | Success response                |
|----------|-----------------------|--------------------------------------------|---------------------------------|
| `GET`    | `/api/products`       | —                                          | `200 { products: Product[] }`   |
| `GET`    | `/api/cart`           | —                                          | `200 { items: CartItem[] }`     |
| `POST`   | `/api/cart/items`     | `{ productId: string, quantity: number }`  | `201 { item: CartItem }`        |
| `PATCH`  | `/api/cart/items/:id` | `{ quantity: number }`                     | `200 { item: CartItem }`        |
| `DELETE` | `/api/cart/items/:id` | —                                          | `204` (no body)                 |

```ts
type Product  = { id: string; name: string; priceCents: number }
type CartItem = { id: string; productId: string; name: string; quantity: number; priceCents: number }
```

- `priceCents` is a non-negative integer.
- `quantity` is a positive integer for `POST` and `PATCH`. `PATCH` with `quantity: 0` is undefined behavior; the harness will not send it.
- Duplicate `POST` for the same `productId` may either merge into one row (incrementing quantity) or create a second row. Both are accepted.
- Restart persistence: after killing and restarting the server, `GET /api/cart` must still return previously added items.

## Frontend contract

- `GET /` returns HTML.
- The HTML, after loading and any client-side init, must show cart-item names from the API.
- Each "add to cart" control: `data-testid="add-to-cart"`.
- Each "remove item" control: `data-testid="remove-item"`.
- After clicking the first `[data-testid="add-to-cart"]`, `GET /api/cart` must show one more item (or one more unit of quantity).
- After clicking the first `[data-testid="remove-item"]`, `GET /api/cart` must show one fewer item (or one fewer unit of quantity).

## Stack constraint

- TypeScript.
- Hono on the backend.
- `better-sqlite3` (file-based, not in-memory).
- Vanilla HTML/CSS/JS frontend; no React/Vue/Svelte/etc.
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold spec and top-level files"
```

---

## Task 2: Reference submission — package + server skeleton

**Files:**
- Create: `llms/_reference/package.json`
- Create: `llms/_reference/tsconfig.json`
- Create: `llms/_reference/.gitignore`
- Create: `llms/_reference/src/server.ts`

- [ ] **Step 1: Write `llms/_reference/package.json`**

```json
{
  "name": "_reference",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "build": "echo 'no build step' && exit 0",
    "start": "tsx src/server.ts"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.7",
    "better-sqlite3": "^11.5.0",
    "hono": "^4.6.10"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^22.9.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Write `llms/_reference/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write `llms/_reference/.gitignore`**

```
node_modules/
*.sqlite
*.sqlite-journal
*.sqlite-shm
*.sqlite-wal
```

- [ ] **Step 4: Write `llms/_reference/src/server.ts`**

```ts
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import Database from "better-sqlite3";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ?? resolve(__dirname, "../data.sqlite");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0)
  );
`);

const productCount = db.prepare("SELECT COUNT(*) AS c FROM products").get() as { c: number };
if (productCount.c === 0) {
  const insert = db.prepare("INSERT INTO products (id, name, price_cents) VALUES (?, ?, ?)");
  const seed = [
    ["p_apple", "Apple", 99],
    ["p_bread", "Sourdough Loaf", 599],
    ["p_milk", "Whole Milk 1L", 349],
    ["p_eggs", "Eggs (dozen)", 499],
    ["p_cheese", "Aged Cheddar 200g", 799],
  ] as const;
  const tx = db.transaction(() => {
    for (const [id, name, price] of seed) insert.run(id, name, price);
  });
  tx();
}

type ProductRow = { id: string; name: string; price_cents: number };
type CartRow = { id: string; product_id: string; quantity: number; name: string; price_cents: number };

const app = new Hono();

app.get("/api/products", (c) => {
  const rows = db.prepare("SELECT id, name, price_cents FROM products").all() as ProductRow[];
  return c.json({ products: rows.map((r) => ({ id: r.id, name: r.name, priceCents: r.price_cents })) });
});

app.get("/api/cart", (c) => {
  const rows = db.prepare(`
    SELECT ci.id, ci.product_id, ci.quantity, p.name, p.price_cents
    FROM cart_items ci JOIN products p ON p.id = ci.product_id
  `).all() as CartRow[];
  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      name: r.name,
      quantity: r.quantity,
      priceCents: r.price_cents,
    })),
  });
});

app.post("/api/cart/items", async (c) => {
  const body = await c.req.json().catch(() => null) as { productId?: string; quantity?: number } | null;
  if (!body || typeof body.productId !== "string" || typeof body.quantity !== "number" || body.quantity <= 0) {
    return c.json({ error: "invalid body" }, 400);
  }
  const product = db.prepare("SELECT id, name, price_cents FROM products WHERE id = ?").get(body.productId) as ProductRow | undefined;
  if (!product) return c.json({ error: "unknown product" }, 404);

  const existing = db.prepare("SELECT id, quantity FROM cart_items WHERE product_id = ?").get(body.productId) as { id: string; quantity: number } | undefined;
  let id: string;
  let quantity: number;
  if (existing) {
    quantity = existing.quantity + body.quantity;
    db.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").run(quantity, existing.id);
    id = existing.id;
  } else {
    id = randomUUID();
    quantity = body.quantity;
    db.prepare("INSERT INTO cart_items (id, product_id, quantity) VALUES (?, ?, ?)").run(id, body.productId, quantity);
  }
  return c.json({ item: { id, productId: product.id, name: product.name, quantity, priceCents: product.price_cents } }, 201);
});

app.patch("/api/cart/items/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null) as { quantity?: number } | null;
  if (!body || typeof body.quantity !== "number" || body.quantity <= 0) {
    return c.json({ error: "invalid body" }, 400);
  }
  const row = db.prepare(`
    SELECT ci.id, ci.product_id, p.name, p.price_cents
    FROM cart_items ci JOIN products p ON p.id = ci.product_id
    WHERE ci.id = ?
  `).get(id) as { id: string; product_id: string; name: string; price_cents: number } | undefined;
  if (!row) return c.json({ error: "not found" }, 404);
  db.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").run(body.quantity, id);
  return c.json({ item: { id, productId: row.product_id, name: row.name, quantity: body.quantity, priceCents: row.price_cents } });
});

app.delete("/api/cart/items/:id", (c) => {
  const id = c.req.param("id");
  const result = db.prepare("DELETE FROM cart_items WHERE id = ?").run(id);
  if (result.changes === 0) return c.json({ error: "not found" }, 404);
  return c.body(null, 204);
});

app.use("/*", serveStatic({ root: resolve(__dirname, "../public"), rewriteRequestPath: (p) => (p === "/" ? "/index.html" : p) }));

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => {
  console.log(`reference listening on :${port}`);
});
```

- [ ] **Step 5: Install reference deps and verify it boots**

Run:
```bash
cd llms/_reference
npm install
PORT=4321 npm start &
sleep 3
curl -s http://localhost:4321/api/products
kill %1 2>/dev/null || pkill -f "tsx src/server.ts" || true
cd ../..
```

Expected: a JSON response with `{"products":[...5 items...]}`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(reference): server with API + sqlite seed"
```

---

## Task 3: Reference submission — frontend

**Files:**
- Create: `llms/_reference/public/index.html`
- Create: `llms/_reference/public/app.js`
- Create: `llms/_reference/public/style.css`

- [ ] **Step 1: Write `llms/_reference/public/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cart</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <h1>Shopping Cart</h1>
    <section>
      <h2>Products</h2>
      <ul id="products"></ul>
    </section>
    <section>
      <h2>Your cart</h2>
      <ul id="cart"></ul>
      <p id="empty" hidden>Your cart is empty.</p>
    </section>
    <script src="/app.js" type="module"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `llms/_reference/public/style.css`**

```css
:root { font-family: system-ui, sans-serif; }
body { max-width: 40rem; margin: 2rem auto; padding: 0 1rem; }
ul { list-style: none; padding: 0; }
li { display: flex; align-items: center; justify-content: space-between; padding: .5rem 0; border-bottom: 1px solid #ddd; }
button { cursor: pointer; }
```

- [ ] **Step 3: Write `llms/_reference/public/app.js`**

```js
const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok && res.status !== 204) throw new Error(`${url} ${res.status}`);
  return res.status === 204 ? null : res.json();
}

async function loadProducts() {
  const data = await fetchJSON("/api/products");
  const ul = document.getElementById("products");
  ul.innerHTML = "";
  for (const p of data.products) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${p.name} — ${fmt(p.priceCents)}`;
    const btn = document.createElement("button");
    btn.textContent = "Add to cart";
    btn.dataset.testid = "add-to-cart";
    btn.addEventListener("click", async () => {
      await fetchJSON("/api/cart/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: p.id, quantity: 1 }),
      });
      await loadCart();
    });
    li.appendChild(label);
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

async function loadCart() {
  const data = await fetchJSON("/api/cart");
  const ul = document.getElementById("cart");
  const empty = document.getElementById("empty");
  ul.innerHTML = "";
  empty.hidden = data.items.length > 0;
  for (const item of data.items) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${item.name} × ${item.quantity} — ${fmt(item.priceCents * item.quantity)}`;
    const btn = document.createElement("button");
    btn.textContent = "Remove";
    btn.dataset.testid = "remove-item";
    btn.addEventListener("click", async () => {
      await fetchJSON(`/api/cart/items/${item.id}`, { method: "DELETE" });
      await loadCart();
    });
    li.appendChild(label);
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

await loadProducts();
await loadCart();
```

- [ ] **Step 4: Manual verify**

Run:
```bash
cd llms/_reference
PORT=4321 npm start &
sleep 3
curl -s http://localhost:4321/ | grep -q "Shopping Cart" && echo "FRONTEND OK"
curl -s http://localhost:4321/app.js | grep -q "add-to-cart" && echo "JS OK"
kill %1 2>/dev/null || pkill -f "tsx src/server.ts" || true
cd ../..
rm -f llms/_reference/data.sqlite*
```

Expected output includes:
```
FRONTEND OK
JS OK
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(reference): vanilla JS frontend with required testids"
```

---

## Task 4: Harness — package + types

**Files:**
- Create: `harness/package.json`
- Create: `harness/tsconfig.json`
- Create: `harness/src/types.ts`

- [ ] **Step 1: Write `harness/package.json`**

```json
{
  "name": "harness",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "test": "tsx --test test/*.test.ts",
    "bench": "tsx src/run.ts"
  },
  "dependencies": {
    "execa": "^9.5.1",
    "get-port": "^7.1.0",
    "playwright": "^1.48.2",
    "undici": "^6.21.0"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Write `harness/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Write `harness/src/types.ts`**

```ts
export type BuildResult = {
  install_ok: boolean;
  install_ms: number;
  install_log: string;
  build_ok: boolean;
  build_ms: number;
  build_log: string;
};

export type StartupResult = {
  startup_ok: boolean;
  startup_ms: number;
  startup_log: string;
};

export type CorrectnessResult = {
  correctness_total: number;
  correctness_passed: number;
  tests: {
    products_listed: boolean;
    cart_initially_empty: boolean;
    post_creates_item: boolean;
    duplicate_post_handled: boolean;
    patch_updates_quantity: boolean;
    delete_removes_item: boolean;
    restart_persistence: boolean;
  };
  primed_item_id: string | null;
};

export type PerfResult = {
  get_cart_p50_ms: number;
  get_cart_p95_ms: number;
  post_item_p50_ms: number;
  post_item_p95_ms: number;
};

export type FrontendResult = {
  frontend_ok: boolean;
  page_rendered: boolean;
  add_works: boolean;
  remove_works: boolean;
  bundle_bytes: number;
  dom_loaded_ms: number;
};

export type SubmissionResult = {
  name: string;
  build: BuildResult;
  startup: StartupResult;
  correctness: CorrectnessResult;
  perf: PerfResult | null;
  frontend: FrontendResult | null;

  // populated by score.ts
  correctness_pct: number;
  frontend_pct: number;
  perf_pct: number;
  build_pct: number;
  composite: number;
};
```

- [ ] **Step 4: Install harness deps**

Run:
```bash
cd harness
npm install
cd ..
```

Expected: dependencies install with no errors. Playwright will print a note about needing browsers; we install them in the next task.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(harness): package, tsconfig, shared types"
```

---

## Task 5: Harness — lifecycle module (TDD)

**Files:**
- Create: `harness/src/lifecycle.ts`
- Create: `harness/test/lifecycle.test.ts`

- [ ] **Step 1: Write the failing test `harness/test/lifecycle.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fetch } from "undici";
import { startSubmission, stopSubmission } from "../src/lifecycle.ts";

const REF = resolve(import.meta.dirname, "../../llms/_reference");

test("startSubmission boots reference and reaches /api/products", async () => {
  const handle = await startSubmission(REF);
  try {
    assert.equal(handle.startup.startup_ok, true);
    const res = await fetch(`${handle.baseUrl}/api/products`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { products: unknown[] };
    assert.ok(Array.isArray(body.products));
    assert.ok(body.products.length > 0);
  } finally {
    await stopSubmission(handle);
  }
});

test("stopSubmission cleans up sqlite files", async () => {
  const handle = await startSubmission(REF);
  await stopSubmission(handle);
  // start again — fresh DB means cart is empty
  const handle2 = await startSubmission(REF);
  try {
    const res = await fetch(`${handle2.baseUrl}/api/cart`);
    const body = (await res.json()) as { items: unknown[] };
    assert.deepEqual(body.items, []);
  } finally {
    await stopSubmission(handle2);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd harness && npm test 2>&1 | tail -20
```

Expected: FAIL with module-not-found or similar (lifecycle.ts doesn't exist yet).

- [ ] **Step 3: Implement `harness/src/lifecycle.ts`**

```ts
import { execa, type ResultPromise } from "execa";
import getPort from "get-port";
import { fetch } from "undici";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
import type { BuildResult, StartupResult } from "./types.ts";

export type SubmissionHandle = {
  dir: string;
  port: number;
  baseUrl: string;
  proc: ResultPromise<{ reject: false }>;
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

export async function stopSubmission(handle: SubmissionHandle): Promise<void> {
  try {
    handle.proc.kill("SIGTERM", { forceKillAfterDelay: 2000 });
    await handle.proc.catch(() => undefined);
  } catch {
    // ignore
  }
  await rm(handle.dbPath, { force: true });
  await rm(`${handle.dbPath}-journal`, { force: true });
  await rm(`${handle.dbPath}-shm`, { force: true });
  await rm(`${handle.dbPath}-wal`, { force: true });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd harness && npm test -- --test-name-pattern lifecycle 2>&1 | tail -20
```

Expected: both tests in `lifecycle.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(harness): lifecycle module (build, start, stop)"
```

---

## Task 6: Harness — correctness module (TDD)

**Files:**
- Create: `harness/src/correctness.ts`
- Create: `harness/test/correctness.test.ts`

- [ ] **Step 1: Write the failing test `harness/test/correctness.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { startSubmission, stopSubmission, buildSubmission } from "../src/lifecycle.ts";
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd harness && npm test -- --test-name-pattern correctness 2>&1 | tail -20
```

Expected: FAIL — `correctness.ts` does not exist.

- [ ] **Step 3: Implement `harness/src/correctness.ts`**

```ts
import { fetch } from "undici";
import { rm } from "node:fs/promises";
import { execa } from "execa";
import getPort from "get-port";
import type { CorrectnessResult } from "./types.ts";
import type { SubmissionHandle } from "./lifecycle.ts";

type Product = { id: string; name: string; priceCents: number };
type CartItem = { id: string; productId: string; name: string; quantity: number; priceCents: number };

async function safeJson<T>(res: Response | { status: number; json: () => Promise<unknown> }): Promise<T | null> {
  try { return (await res.json()) as T; } catch { return null; }
}

function isProduct(p: unknown): p is Product {
  return !!p && typeof (p as Product).id === "string"
    && typeof (p as Product).name === "string"
    && Number.isFinite((p as Product).priceCents);
}

function isCartItem(c: unknown): c is CartItem {
  if (!c || typeof c !== "object") return false;
  const i = c as CartItem;
  return typeof i.id === "string"
    && typeof i.productId === "string"
    && typeof i.name === "string"
    && Number.isFinite(i.quantity)
    && Number.isFinite(i.priceCents);
}

async function waitForReady(baseUrl: string, deadlineMs: number): Promise<boolean> {
  while (performance.now() < deadlineMs) {
    try {
      const res = await fetch(`${baseUrl}/api/products`, { signal: AbortSignal.timeout(1000) });
      if (res.status === 200) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

export async function runCorrectness(handle: SubmissionHandle): Promise<CorrectnessResult> {
  const tests = {
    products_listed: false,
    cart_initially_empty: false,
    post_creates_item: false,
    duplicate_post_handled: false,
    patch_updates_quantity: false,
    delete_removes_item: false,
    restart_persistence: false,
  };
  let primedItemId: string | null = null;

  // Test 1: products listed
  let firstProductId: string | null = null;
  {
    const res = await fetch(`${handle.baseUrl}/api/products`);
    const body = await safeJson<{ products: unknown }>(res as any);
    if (res.status === 200 && body && Array.isArray(body.products) && body.products.length > 0 && body.products.every(isProduct)) {
      tests.products_listed = true;
      firstProductId = (body.products[0] as Product).id;
    }
  }

  // Test 2: cart initially empty
  {
    const res = await fetch(`${handle.baseUrl}/api/cart`);
    const body = await safeJson<{ items: unknown }>(res as any);
    if (res.status === 200 && body && Array.isArray(body.items) && body.items.length === 0) {
      tests.cart_initially_empty = true;
    }
  }

  // Test 3: POST creates item
  let createdItemId: string | null = null;
  if (firstProductId) {
    const res = await fetch(`${handle.baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId: firstProductId, quantity: 2 }),
    });
    const body = await safeJson<{ item: unknown }>(res as any);
    if (res.status === 201 && body && isCartItem(body.item) && body.item.productId === firstProductId && body.item.quantity === 2) {
      tests.post_creates_item = true;
      createdItemId = body.item.id;
      primedItemId = body.item.id;
    }
  }

  // Test 4: duplicate POST handled (merge OR new row, both accepted)
  if (firstProductId) {
    const before = await fetch(`${handle.baseUrl}/api/cart`).then((r) => r.json()) as { items: CartItem[] };
    const res = await fetch(`${handle.baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId: firstProductId, quantity: 1 }),
    });
    if (res.status === 201) {
      const after = await fetch(`${handle.baseUrl}/api/cart`).then((r) => r.json()) as { items: CartItem[] };
      const totalQtyBefore = before.items.filter((i) => i.productId === firstProductId).reduce((s, i) => s + i.quantity, 0);
      const totalQtyAfter = after.items.filter((i) => i.productId === firstProductId).reduce((s, i) => s + i.quantity, 0);
      if (totalQtyAfter === totalQtyBefore + 1) tests.duplicate_post_handled = true;
    }
  }

  // Test 5: PATCH updates quantity
  if (createdItemId) {
    const res = await fetch(`${handle.baseUrl}/api/cart/items/${createdItemId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quantity: 5 }),
    });
    const body = await safeJson<{ item: unknown }>(res as any);
    if (res.status === 200 && body && isCartItem(body.item) && body.item.quantity === 5) {
      const cart = await fetch(`${handle.baseUrl}/api/cart`).then((r) => r.json()) as { items: CartItem[] };
      const found = cart.items.find((i) => i.id === createdItemId);
      if (found && found.quantity === 5) tests.patch_updates_quantity = true;
    }
  }

  // Test 6: DELETE removes
  if (createdItemId) {
    const res = await fetch(`${handle.baseUrl}/api/cart/items/${createdItemId}`, { method: "DELETE" });
    if (res.status === 204) {
      const cart = await fetch(`${handle.baseUrl}/api/cart`).then((r) => r.json()) as { items: CartItem[] };
      if (!cart.items.some((i) => i.id === createdItemId)) tests.delete_removes_item = true;
    }
  }

  // Test 7: restart persistence — add an item, kill server, restart on same DB, verify it's still there.
  if (firstProductId) {
    // Add an item we expect to survive.
    const addRes = await fetch(`${handle.baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId: firstProductId, quantity: 3 }),
    });
    const added = await safeJson<{ item: CartItem }>(addRes as any);
    if (addRes.status === 201 && added && isCartItem(added.item)) {
      // Kill the original server but DO NOT delete the DB.
      handle.proc.kill("SIGTERM", { forceKillAfterDelay: 2000 });
      await handle.proc.catch(() => undefined);

      // Restart on the same DB path, new port.
      const newPort = await getPort();
      const newBaseUrl = `http://127.0.0.1:${newPort}`;
      const restarted = execa("npm", ["start"], {
        cwd: handle.dir,
        env: { ...process.env, PORT: String(newPort), DB_PATH: handle.dbPath },
        reject: false,
        all: true,
      });
      try {
        const ready = await waitForReady(newBaseUrl, performance.now() + 30_000);
        if (ready) {
          const cart = await fetch(`${newBaseUrl}/api/cart`).then((r) => r.json()) as { items: CartItem[] };
          if (cart.items.some((i) => i.productId === firstProductId && i.quantity >= 3)) {
            tests.restart_persistence = true;
          }
        }
      } finally {
        restarted.kill("SIGTERM", { forceKillAfterDelay: 2000 });
        await restarted.catch(() => undefined);
      }

      // Mutate handle so stopSubmission doesn't try to kill the dead original.
      // The caller uses handle.proc.kill which is a no-op on an already-dead process.
      // We don't restart on the original port; subsequent phases must not assume the server is running.
      handle.startup.startup_ok = false;
    }
  }

  const passed = Object.values(tests).filter(Boolean).length;
  return {
    correctness_total: 7,
    correctness_passed: passed,
    tests,
    primed_item_id: primedItemId,
  };
}
```

> Note: the restart-persistence test leaves the submission server stopped. The orchestrator (`run.ts`, Task 9) will detect this via `handle.startup.startup_ok` and re-start the server before running the performance and frontend phases.

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd harness && npm test -- --test-name-pattern correctness 2>&1 | tail -20
```

Expected: `correctness_passed = 7`, test passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(harness): correctness module with 7 API tests"
```

---

## Task 7: Harness — performance module (TDD)

**Files:**
- Create: `harness/src/performance.ts`
- Create: `harness/test/performance.test.ts`

- [ ] **Step 1: Write the failing test `harness/test/performance.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fetch } from "undici";
import { startSubmission, stopSubmission } from "../src/lifecycle.ts";
import { runPerformance } from "../src/performance.ts";

const REF = resolve(import.meta.dirname, "../../llms/_reference");

test("runPerformance returns finite latencies for reference", async () => {
  const handle = await startSubmission(REF);
  try {
    // Prime: add one item so /api/cart isn't empty.
    const products = (await (await fetch(`${handle.baseUrl}/api/products`)).json()) as { products: { id: string }[] };
    const productId = products.products[0]!.id;
    const result = await runPerformance(handle, productId);
    assert.ok(Number.isFinite(result.get_cart_p50_ms));
    assert.ok(Number.isFinite(result.get_cart_p95_ms));
    assert.ok(Number.isFinite(result.post_item_p50_ms));
    assert.ok(Number.isFinite(result.post_item_p95_ms));
    assert.ok(result.get_cart_p95_ms >= result.get_cart_p50_ms);
    assert.ok(result.post_item_p95_ms >= result.post_item_p50_ms);
  } finally {
    await stopSubmission(handle);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd harness && npm test -- --test-name-pattern performance 2>&1 | tail -20
```

Expected: FAIL — `performance.ts` does not exist.

- [ ] **Step 3: Implement `harness/src/performance.ts`**

```ts
import { fetch } from "undici";
import type { PerfResult } from "./types.ts";
import type { SubmissionHandle } from "./lifecycle.ts";

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return Number.NaN;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx]!;
}

async function timeOnce(fn: () => Promise<unknown>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

export async function runPerformance(handle: SubmissionHandle, productId: string): Promise<PerfResult> {
  // Warm up — discard 10 requests.
  for (let i = 0; i < 10; i++) await fetch(`${handle.baseUrl}/api/cart`);

  // GET /api/cart x50
  const getSamples: number[] = [];
  for (let i = 0; i < 50; i++) {
    getSamples.push(await timeOnce(() => fetch(`${handle.baseUrl}/api/cart`).then((r) => r.text())));
  }
  getSamples.sort((a, b) => a - b);

  // POST /api/cart/items x20
  const postSamples: number[] = [];
  for (let i = 0; i < 20; i++) {
    postSamples.push(await timeOnce(() =>
      fetch(`${handle.baseUrl}/api/cart/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      }).then((r) => r.text()),
    ));
  }
  postSamples.sort((a, b) => a - b);

  return {
    get_cart_p50_ms: Math.round(percentile(getSamples, 50) * 100) / 100,
    get_cart_p95_ms: Math.round(percentile(getSamples, 95) * 100) / 100,
    post_item_p50_ms: Math.round(percentile(postSamples, 50) * 100) / 100,
    post_item_p95_ms: Math.round(percentile(postSamples, 95) * 100) / 100,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd harness && npm test -- --test-name-pattern performance 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(harness): performance module (p50/p95)"
```

---

## Task 8: Harness — frontend module (TDD)

**Files:**
- Create: `harness/src/frontend.ts`
- Create: `harness/test/frontend.test.ts`

- [ ] **Step 1: Install Playwright Chromium**

Run:
```bash
cd harness && npx playwright install chromium && cd ..
```

Expected: chromium downloaded.

- [ ] **Step 2: Write the failing test `harness/test/frontend.test.ts`**

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```bash
cd harness && npm test -- --test-name-pattern frontend 2>&1 | tail -20
```

Expected: FAIL — `frontend.ts` does not exist.

- [ ] **Step 4: Implement `harness/src/frontend.ts`**

```ts
import { chromium } from "playwright";
import { fetch } from "undici";
import type { FrontendResult } from "./types.ts";
import type { SubmissionHandle } from "./lifecycle.ts";

type CartItem = { id: string; productId: string; name: string; quantity: number; priceCents: number };

async function cartTotalQuantity(baseUrl: string): Promise<number> {
  const data = (await (await fetch(`${baseUrl}/api/cart`)).json()) as { items: CartItem[] };
  return data.items.reduce((s, i) => s + i.quantity, 0);
}

export async function runFrontend(handle: SubmissionHandle): Promise<FrontendResult> {
  const result: FrontendResult = {
    frontend_ok: false,
    page_rendered: false,
    add_works: false,
    remove_works: false,
    bundle_bytes: 0,
    dom_loaded_ms: Number.NaN,
  };

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  let bundleBytes = 0;
  page.on("response", async (res) => {
    try {
      const buf = await res.body();
      bundleBytes += buf.length;
    } catch {
      // some responses (redirects, etc) have no body
    }
  });

  try {
    const t0 = performance.now();
    await page.goto(handle.baseUrl, { waitUntil: "networkidle", timeout: 15_000 });
    result.dom_loaded_ms = Math.round(performance.now() - t0);

    // page_rendered: at least one product name from the API appears in the DOM.
    const products = (await (await fetch(`${handle.baseUrl}/api/products`)).json()) as { products: { name: string }[] };
    const sampleName = products.products[0]?.name ?? "";
    if (sampleName) {
      const visible = await page.locator("body").innerText();
      result.page_rendered = visible.includes(sampleName);
    }

    // add_works
    const qtyBefore = await cartTotalQuantity(handle.baseUrl);
    const addBtn = page.locator('[data-testid="add-to-cart"]').first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      // wait up to 3s for cart to grow
      const deadline = performance.now() + 3000;
      while (performance.now() < deadline) {
        if ((await cartTotalQuantity(handle.baseUrl)) > qtyBefore) {
          result.add_works = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    // remove_works
    const qtyBeforeRemove = await cartTotalQuantity(handle.baseUrl);
    if (qtyBeforeRemove > 0) {
      // wait for the remove button to render after the add (the page may need to re-render)
      const removeBtn = page.locator('[data-testid="remove-item"]').first();
      await removeBtn.waitFor({ state: "visible", timeout: 3000 }).catch(() => undefined);
      if (await removeBtn.count() > 0) {
        await removeBtn.click();
        const deadline = performance.now() + 3000;
        while (performance.now() < deadline) {
          if ((await cartTotalQuantity(handle.baseUrl)) < qtyBeforeRemove) {
            result.remove_works = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    }

    result.bundle_bytes = bundleBytes;
    result.frontend_ok = result.page_rendered && result.add_works && result.remove_works;
  } catch {
    // leave defaults — frontend_ok = false
  } finally {
    await browser.close();
  }

  return result;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
cd harness && npm test -- --test-name-pattern frontend 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(harness): frontend module (Playwright)"
```

---

## Task 9: Harness — score module (pure unit tests)

**Files:**
- Create: `harness/src/score.ts`
- Create: `harness/test/score.test.ts`

- [ ] **Step 1: Write the failing test `harness/test/score.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScores } from "../src/score.ts";
import type { SubmissionResult } from "../src/types.ts";

function fixture(over: Partial<SubmissionResult> = {}): SubmissionResult {
  return {
    name: over.name ?? "x",
    build: { install_ok: true, install_ms: 1000, install_log: "", build_ok: true, build_ms: 100, build_log: "" },
    startup: { startup_ok: true, startup_ms: 500, startup_log: "" },
    correctness: {
      correctness_total: 7, correctness_passed: 7,
      tests: { products_listed: true, cart_initially_empty: true, post_creates_item: true, duplicate_post_handled: true, patch_updates_quantity: true, delete_removes_item: true, restart_persistence: true },
      primed_item_id: "i1",
    },
    perf: { get_cart_p50_ms: 5, get_cart_p95_ms: 10, post_item_p50_ms: 5, post_item_p95_ms: 10 },
    frontend: { frontend_ok: true, page_rendered: true, add_works: true, remove_works: true, bundle_bytes: 1000, dom_loaded_ms: 100 },
    correctness_pct: 0, frontend_pct: 0, perf_pct: 0, build_pct: 0, composite: 0,
    ...over,
  };
}

test("perfect submission scores 100", () => {
  const [scored] = computeScores([fixture()]);
  assert.equal(scored.correctness_pct, 100);
  assert.equal(scored.frontend_pct, 100);
  assert.equal(scored.perf_pct, 100);
  assert.equal(scored.build_pct, 100);
  assert.equal(scored.composite, 100);
});

test("failed build yields composite 0 but other metrics still recorded", () => {
  const broken = fixture({
    name: "broken",
    build: { install_ok: false, install_ms: 0, install_log: "", build_ok: false, build_ms: 0, build_log: "" },
    startup: { startup_ok: false, startup_ms: 0, startup_log: "" },
    correctness: { correctness_total: 7, correctness_passed: 0, tests: { products_listed: false, cart_initially_empty: false, post_creates_item: false, duplicate_post_handled: false, patch_updates_quantity: false, delete_removes_item: false, restart_persistence: false }, primed_item_id: null },
    perf: null,
    frontend: null,
  });
  const [scored] = computeScores([broken]);
  assert.equal(scored.build_pct, 0);
  assert.equal(scored.correctness_pct, 0);
  assert.equal(scored.frontend_pct, 0);
  assert.equal(scored.perf_pct, 0);
  assert.equal(scored.composite, 0);
});

test("perf is normalized: best gets 100, slower gets less", () => {
  const fast = fixture({ name: "fast", perf: { get_cart_p50_ms: 1, get_cart_p95_ms: 2, post_item_p50_ms: 1, post_item_p95_ms: 2 }, frontend: { frontend_ok: true, page_rendered: true, add_works: true, remove_works: true, bundle_bytes: 100, dom_loaded_ms: 10 } });
  const slow = fixture({ name: "slow", perf: { get_cart_p50_ms: 2, get_cart_p95_ms: 4, post_item_p50_ms: 2, post_item_p95_ms: 4 }, frontend: { frontend_ok: true, page_rendered: true, add_works: true, remove_works: true, bundle_bytes: 200, dom_loaded_ms: 20 } });
  const scored = computeScores([fast, slow]);
  const fastS = scored.find((s) => s.name === "fast")!;
  const slowS = scored.find((s) => s.name === "slow")!;
  assert.equal(fastS.perf_pct, 100);
  assert.ok(slowS.perf_pct < fastS.perf_pct);
  assert.ok(slowS.perf_pct > 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd harness && npm test -- --test-name-pattern score 2>&1 | tail -20
```

Expected: FAIL — `score.ts` does not exist.

- [ ] **Step 3: Implement `harness/src/score.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd harness && npm test -- --test-name-pattern score 2>&1 | tail -20
```

Expected: all 3 score tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(harness): composite score with normalized perf"
```

---

## Task 10: Harness — report module (pure unit tests)

**Files:**
- Create: `harness/src/report.ts`
- Create: `harness/test/report.test.ts`

- [ ] **Step 1: Write the failing test `harness/test/report.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd harness && npm test -- --test-name-pattern report 2>&1 | tail -20
```

Expected: FAIL — `report.ts` does not exist.

- [ ] **Step 3: Implement `harness/src/report.ts`**

```ts
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
      + `| ${fe ? fe.bundle_bytes : "—"} | ${fe ? fe.dom_loaded_ms : "—"} |`
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd harness && npm test -- --test-name-pattern report 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(harness): report writer (JSON + Markdown leaderboard)"
```

---

## Task 11: Harness — orchestrator `run.ts`

**Files:**
- Create: `harness/src/run.ts`

- [ ] **Step 1: Write `harness/src/run.ts`**

```ts
import { readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execa } from "execa";
import getPort from "get-port";
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
  });
  // wait up to 30s
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
  // Couldn't restart — return as-is, downstream phases will short-circuit.
  proc.kill("SIGTERM", { forceKillAfterDelay: 2000 });
  await proc.catch(() => undefined);
  return handle;
}

async function evaluateOne(name: string): Promise<SubmissionResult> {
  console.log(`\n=== ${name} ===`);
  const dir = join(LLMS_DIR, name);

  const initial = await startSubmission(dir);
  const result: SubmissionResult = {
    name,
    build: initial.build,
    startup: initial.startup,
    correctness: { correctness_total: 7, correctness_passed: 0, tests: { products_listed: false, cart_initially_empty: false, post_creates_item: false, duplicate_post_handled: false, patch_updates_quantity: false, delete_removes_item: false, restart_persistence: false }, primed_item_id: null },
    perf: null,
    frontend: null,
    correctness_pct: 0, frontend_pct: 0, perf_pct: 0, build_pct: 0, composite: 0,
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

    if (result.correctness.primed_item_id) {
      // primed_item_id was deleted in test 6, so we just use the first product for the perf POST loop.
    }
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
```

- [ ] **Step 2: Run the orchestrator end-to-end against the reference**

Run:
```bash
cd harness && npm run bench 2>&1 | tail -40
```

Expected output ends with:
- `correctness: 7/7`
- `frontend: rendered=true add=true remove=true ...`
- `Wrote .../results/results.json and .../results/RESULTS.md`

- [ ] **Step 3: Inspect the generated leaderboard**

Run:
```bash
cat ../results/RESULTS.md
```

Expected: Markdown table with `_reference` ranked #1, composite = 100.

- [ ] **Step 4: Run all harness self-tests one more time**

Run:
```bash
npm test 2>&1 | tail -20
```

Expected: all tests across `lifecycle`, `correctness`, `performance`, `frontend`, `score`, `report` pass.

- [ ] **Step 5: Commit**

```bash
cd ..
git add -A
git commit -m "feat(harness): orchestrator + end-to-end run against reference"
```

---

## Task 12: Final polish — README run example, results check-in

**Files:**
- Modify: `README.md` — add "How to interpret results" section
- Modify: `.gitignore` — keep `results/RESULTS.md` checked in, ignore `results/results.json`

- [ ] **Step 1: Update `README.md` with a results section**

Append to existing `README.md`:

```markdown

## Interpreting results

- `results/RESULTS.md` is the human-readable leaderboard. It's checked into git so you can browse historical runs.
- `results/results.json` is the raw machine-readable record (gitignored — too noisy for git).
- The composite score weights are: 60% correctness, 20% frontend, 15% performance (normalized across the run), 5% build/startup. A submission that fails build or startup gets composite 0 even if other metrics happen to be recorded.

## Notes for adding more LLMs

- The harness discovers submissions automatically — drop a new directory under `llms/` and re-run `npm run bench`.
- Submissions whose name starts with `.` are skipped (e.g. `.draft/`). `_reference/` is included on purpose so you can see the harness self-validate every run.
```

- [ ] **Step 2: Confirm `.gitignore` already has the right entries**

The `.gitignore` from Task 1 includes `results/results.json` but not `results/RESULTS.md`, so this is already correct. Just verify:

Run:
```bash
grep -E "^results/" .gitignore
```

Expected output:
```
results/results.json
```

- [ ] **Step 3: Run the harness once more to refresh `RESULTS.md`**

Run:
```bash
cd harness && npm run bench && cd ..
```

Expected: `_reference` scores 100 again, `results/RESULTS.md` updated.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: add interpretation section, check in initial RESULTS.md"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Plan coverage |
|---|---|
| Repo layout | Tasks 1, 2, 4 (creates every directory listed) |
| Thin contract — required stack | Task 2 (reference pins it) + Task 1 (CONTRACT.md/PROMPT.md document it) |
| Required scripts | Tasks 1, 2 — `package.json` for reference, contract documents requirement |
| Required API + shapes | Task 2 (server.ts implements all 5 endpoints) + Task 6 (correctness probes all of them) |
| Required behavior (single anonymous cart, ~5 seed products) | Task 2 (server.ts seeds 5 products, no auth) |
| Required frontend test hooks (data-testid) | Task 3 (HTML uses both testids) + Task 8 (Playwright clicks them) |
| Prompt (PROMPT.md) | Task 1 step 3 |
| Phase 1 — Build | Task 5 (`buildSubmission` in lifecycle.ts) |
| Phase 2 — Startup | Task 5 (`startSubmission` waits for ready) |
| Phase 3 — Correctness (7 tests) | Task 6 (all 7 tests, including restart persistence) |
| Phase 4 — Performance | Task 7 (50 GET + 20 POST, p50/p95) |
| Phase 5 — Frontend | Task 8 (page render + add/remove + bundle bytes + DOMContentLoaded) |
| Phase 6 — Cleanup | Task 5 (`stopSubmission` deletes sqlite) |
| Composite score formula | Task 9 (60/20/15/5 + relative perf normalization) |
| Output files | Task 10 (results.json + RESULTS.md sorted by composite) |
| Out-of-scope items (auth, checkout, multi-user, CI, automated LLM invocation) | Not implemented — correctly out of scope |

All spec sections are covered.

**2. Placeholder scan**

No "TBD"/"TODO"/"implement later". One inline comment in `run.ts` explains why we look up the product ID fresh for the perf POST loop — that's clarification, not a placeholder.

**3. Type consistency**

- `SubmissionHandle` (lifecycle.ts) is consumed by `runCorrectness`, `runPerformance`, `runFrontend`, and `run.ts` — same shape everywhere.
- `SubmissionResult` (types.ts) is the only canonical result shape; `score.ts` mutates it; `report.ts` reads it.
- `CorrectnessResult.tests` keys are identical in `types.ts`, `correctness.ts`, `report.ts`, and the score test fixture.
- `PerfResult` keys (`get_cart_p50_ms` etc) are identical in `types.ts`, `performance.ts`, `score.ts`, `report.ts`.
- `FrontendResult` keys are identical across `types.ts`, `frontend.ts`, `score.ts`, `report.ts`.

No drift.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-03-shopping-cart-llm-benchmark.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
