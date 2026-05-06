# Evaluation — Shopping Cart Coding Test

**Evaluator**: kimi2.6  
**Date**: 2026-05-03  
**Spec**: `../../spec/PROMPT.md` — Shopping Cart with Hono, SQLite, vanilla frontend

---

## Evaluation Criteria

| # | Criterion | Weight |
|---|-----------|--------|
| 1 | **Spec Compliance** — Correct API responses, status codes, data-testid attributes, PORT env var support | High |
| 2 | **Correctness** — No functional bugs: cart merging, quantity updates, 404 handling, DB integrity | High |
| 3 | **Code Quality** — TypeScript strictness, type safety, clean code, no dead code | Medium |
| 4 | **Architecture** — Separation of concerns, DB abstraction, layering, testability | Medium |
| 5 | **Frontend UX** — Usability, accessibility hints, responsive layout, event handling | Low |
| 6 | **Error Handling** — Validation, 404s, graceful failures, input sanitization | Medium |

---

## 1. `gpt-5.5` — Best Overall ⭐

| Criterion | Score | Notes |
|-----------|-------|-------|
| Spec Compliance | ✅ 10/10 | Every endpoint exact. `build` compiles via `tsc`, `start` runs compiled JS. `data-testid` present. PORT honored. |
| Correctness | ✅ 10/10 | POST merges quantities on duplicate productId. PATCH quantity=0 deletes (returns `null` item). DELETE 404 when missing. |
| Code Quality | ✅ 10/10 | Strictest TypeScript (`NodeNext` resolution). Explicit validation types (`QuantityValidation`, `AddValidation`). No `any`. |
| Architecture | ✅ 10/10 | 4-layer separation: `types.ts` → `cart-store.ts` (DB class) → `app.ts` (routing + HTML) → `server.ts` (bootstrap). Includes test suite. |
| Frontend UX | ✅ 9/10 | Inline HTML string rendered by backend. Responsive grid layout, busy-state locking, `Intl.NumberFormat`, ARIA attributes, polished design. |
| Error Handling | ✅ 10/10 | Exhaustive validation with descriptive messages. `handleStoreError` maps exceptions to 404/400. |

### Highlights
- `CartStore` class fully encapsulates DB access with prepared statements, transactions, and assertion helpers (`assertProductExists`, `assertPositiveInteger`).
- Validation uses discriminated unions: `| { ok: true; ... } | { ok: false; error: string }` — elegantly typed.
- `app.ts` inlines the entire frontend as a TypeScript template literal. Unusual but means zero static file serving complexity.
- Has a `test/` folder with test cases.

### Downsides
- Inline HTML means frontend cannot be served as static files — unusual for a coding test but functionally valid.
- `test` script in `package.json` requires `tsx` as devDependency; not needed for grading but adds noise.

---

## 2. `opus4.7` — Clean & Minimal

| Criterion | Score | Notes |
|-----------|-------|-------|
| Spec Compliance | ✅ 10/10 | All endpoints correct. `data-testid` present. PORT env var support. |
| Correctness | ✅ 10/10 | POST merges existing quantities. DELETE 404 when missing. PATCH requires quantity > 0. |
| Code Quality | ✅ 9/10 | Good TypeScript. Uses `ProductRow` / `CartRow` type aliases for DB rows. Minor `let body: any` smell. |
| Architecture | ✅ 8/10 | Clean separation: `db.ts` (schema + seed), `server.ts` (routes). `db` exported as singleton — okay for test scope. |
| Frontend UX | ✅ 8/10 | Separate `public/app.js` with event delegation. ± quantity buttons add nice UX. `type="module"` on script. Clean layout. |
| Error Handling | ✅ 8/10 | 400 on invalid JSON, 404 on missing items. Could validate `quantity` more strictly (only checks `<= 0`). |

### Highlights
- `app.js` uses DOM element creation (`createElement`) instead of `innerHTML` — XSS-safe by default.
- Event delegation pattern in `app.js` is clean and maintainable.
- `serveStatic` from `@hono/node-server` used correctly with root `./public`.
- Good visual design with mobile-responsive grid.

### Downsides
- `db` is a module-level singleton exported and mutated globally — works but less testable than a class.
- `app.js` has a slight bug: `fetch` sets `"Content-Type": "application/json"` on all requests including GET/DELETE, which is harmless but sloppy.

---

## 3. `_reference` — Minimal but Correct

| Criterion | Score | Notes |
|-----------|-------|-------|
| Spec Compliance | ✅ 10/10 | Exact API contract. `data-testid` present. PORT env var. Separate `app.js` module. |
| Correctness | ✅ 10/10 | POST merges. PATCH validates quantity>0. DELETE 404 on missing. WAL mode enabled. |
| Code Quality | ✅ 8/10 | Good TypeScript. Snake_case mapping in routes is manual but clear. |
| Architecture | ✅ 7/10 | Single `server.ts` file with everything (DB, routes, static). `public/` directory for statics. Fits in one file at the cost of testability. |
| Frontend UX | ✅ 6/10 | Very basic flat layout. Works but no quantity ± buttons, no responsive grid. `app.js` uses top-level `await` with `type="module"`. |
| Error Handling | ✅ 8/10 | 400 on invalid body, 404 on missing. Could be more robust on JSON parse. |

### Highlights
- `rewriteRequestPath` on `serveStatic` correctly maps `/` → `/index.html`.
- Uses `DB_PATH` env var with fallback — good for portability.
- `app.js` uses template literals instead of `innerHTML` for buttons — XSS-safe.
- Most compact reference implementation.

### Downsides
- No separate `db.ts` — schema and queries inline in `server.ts`. Not a bug, just less maintainable.
- Frontend is bare-bones: no subtotal display, no quantity input (only add/remove).

---

## 4. `deepseek4` — Functional but Denormalized

| Criterion | Score | Notes |
|-----------|-------|-------|
| Spec Compliance | ✅ 9/10 | All endpoints present. `data-testid` present. PORT env var. Minor: no `@hono/node-server/serve-static`, serves files manually. |
| Correctness | ⚠️ 7/10 | POST merges quantities. PATCH quantity=0 deletes (deviation from 200 response, returns 204). DELETE 404. |
| Code Quality | ⚠️ 7/10 | `types.ts` has bizarre interface: both `priceCents` and `price_cents` on same type. Strict mode on. |
| Architecture | ✅ 7/10 | 3-file backend + `public/`. `getDb()` singleton pattern with lazy init. |
| Frontend UX | ✅ 8/10 | Inline JS in HTML with event listeners. Good visual design with header banner. ± quantity buttons in cart. Responsive. |
| Error Handling | ✅ 7/10 | 400 on invalid input, 404 on missing product/item. PATCH quantity=0 returns 204 instead of 200 per spec. |

### Highlights
- Good visual design with header banner, grid layout, nice button styling.
- `CSS.escape()` used before passing IDs to querySelector — good practice.

### Downsides
- **Denormalized DB schema**: `cart_items` stores `name` and `price_cents` instead of joining to `products`. If product prices change, cart items show stale data. This is a design smell.
- **Manual static file serving**: Uses `readFileSync` for `/` and `/style.css` instead of `serveStatic` middleware. Brittle and doesn't handle content-type negotiation.
- **Type issues**: `types.ts` mixes camelCase and snake_case on same interface. The DB type `Product` has both `priceCents` and `price_cents`, which is confusing.

---

## 5. `qwen3.6` — Overengineered & Buggy ❌

| Criterion | Score | Notes |
|-----------|-------|-------|
| Spec Compliance | ⚠️ 6/10 | Endpoints present but behavior deviates. Has PORT support. `data-testid` present. |
| Correctness | ❌ 4/10 | **POST does NOT merge quantities** — creates duplicate cart items for same product. **PATCH quantity≤0 returns `{item:null}`** instead of deleting per spec. |
| Code Quality | ⚠️ 6/10 | `ES2022` target, `NodeNext` module. But `c.notFound()` usage is suspicious. |
| Architecture | ⚠️ 4/10 | Single `index.ts` with inline DB, inline custom HTTP adapter. `src/index.html` is the only frontend file (inline everything). |
| Frontend UX | ⚠️ 6/10 | Inline CSS + JS in one HTML file. Functional but quantity change only fires on `change` event (no ± buttons). |
| Error Handling | ⚠️ 5/10 | Returns 404 in some cases. PATCH with quantity≤0 returns 200 `{item:null}` — non-standard. |

### Highlights
- `data-testid` attributes correctly placed.

### Downsides
- **Custom Node HTTP adapter (~80 lines)**: Instead of `@hono/node-server`, builds own `handleRequest` that manually transforms `IncomingMessage` → `Request` and `Response` → `ServerResponse` with readable stream pumping. This is unnecessary, fragile, and error-prone for a coding test.
- **Denormalized cart_items**: Same issue as deepseek4 — stores `name` and `price_cents` in cart_items.
- **No `UNIQUE` constraint on `product_id` in cart_items**: This is why POST creates duplicates. The schema allows multiple cart rows for the same product.
- **Wrong `build`/`start` workflow**: `build` compiles `tsc` to `dist/`, but `start` reads `src/index.html` at runtime via `__dirname` relative path. If `dist/` is the runtime directory (as `start` script implies), `__dirname` becomes `dist/` and `../data` path logic may mismatch.

---

## 6. `kimi2.6` (Self)

| Criterion | Score | Notes |
|-----------|-------|-------|
| Spec Compliance | ✅ 10/10 | All endpoints correct. `data-testid` present. PORT env var. |
| Correctness | ✅ 10/10 | POST merges quantities. PATCH quantity>0 enforced. DELETE 404 on missing. |
| Code Quality | ✅ 7/10 | Good TypeScript. `src/db.ts` has clear types. Could benefit from stricter input validation helpers. |
| Architecture | ✅ 7/10 | Clean 2-layer backend (`db.ts` + `server.ts`) with `public/` for statics. `db.ts` is a module of functions, not a class. |
| Frontend UX | ✅ 7/10 | Responsive layout, product cards, cart table with totals. Uses `innerHTML` with `escapeHtml` helper. Uses global `window.onclick` handlers (old school but works). |
| Error Handling | ✅ 7/10 | 400 on invalid input. Returns error JSON but doesn't distinguish 404 vs 400 as precisely as gpt-5.5. |

### Highlights
- Uses `@hono/node-server` correctly.
- Good normalised DB schema: `cart_items` only stores product reference + quantity; `name`/`priceCents` come from JOIN.
- `npm start` uses `tsx` (no compilation step); `build` is a no-op.

### Downsides
- Frontend uses `onclick="..."` HTML attributes instead of event listeners — less idiomatic modern JS.
- `innerHTML` string generation with template literals (mitigated by `escapeHtml` but still riskier than DOM element creation).
- No `build` step that produces compiled output — graders might expect `dist/`.

---

## Final Ranking

| Rank | Implementation | Weighted Score | Verdict |
|------|---------------|----------------|---------|
| 1 | **`gpt-5.5`** | 9.5/10 | **Best Overall** — Production-grade architecture, exhaustive validation, clean layering, and a test suite. The inline HTML is unorthodox but well-executed. |
| 2 | **`opus4.7`** | 8.8/10 | **Best Frontend** — Cleanest separation of concerns, XSS-safe DOM manipulation, responsive UI. Would be #1 with a `CartStore` class and stricter validation. |
| 3 | **`_reference`** | 8.2/10 | **Most Minimal** — Zero-frills, 100 % correct, easy to review. The reference implementation that others should be measured against. |
| 4 | **`kimi2.6`** | 8.0/10 | **Solid** — Correct, clean, normalised schema. Held back by `innerHTML` frontend and lack of compiled `build` output. |
| 5 | **`deepseek4`** | 7.5/10 | **Functional** — Good UI but denormalised DB and manual file serving are design flaws. |
| 6 | **`qwen3.6`** | 5.2/10 | **Needs Work** — Significant correctness bugs (duplicate cart items), over-engineered HTTP adapter, denormalised schema. |

## Recommendation

For a **coding test**, choose **`gpt-5.5`** if the goal is to assess production-readiness and architecture skill, or **`opus4.7`** if the goal is clean separated static files with excellent frontend UX.

For a **minimal reference**, **`_reference`** is the gold standard — nothing extra, every requirement met precisely.
