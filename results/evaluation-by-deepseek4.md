# Evaluation of Shopping Cart Implementations

**Evaluated by:** DeepSeek V4
**Date:** 2026-05-03

## Overview

Six implementations of the [Shopping Cart Coding Test](../../spec/PROMPT.md) were evaluated. Each uses TypeScript, Hono, SQLite via `better-sqlite3`, and vanilla HTML/CSS/JS — with varying degrees of polish, correctness, and engineering discipline.

## Rankings

| Rank | Implementation | Verdict |
|------|---------------|---------|
| **1** | **gpt-5.5** | Best overall — professional-grade code with tests and excellent architecture |
| 2 | _reference | Excellent minimalism — the gold standard for "just enough" |
| 3 | opus4.7 | Solid, well-structured, only minor issues |
| 4 | deepseek4 | Good structure but denormalized DB schema and some rough edges |
| 5 | kimi2.6 | Decent architecture ruined by inline event handlers |
| 6 | qwen3.6 | Bypasses Hono adapter, fragile runtime, missing dependency |

---

## Detailed Evaluations

### 1. gpt-5.5 — ⭐ WINNER

**Architecture:** `server.ts` → `app.ts` → `cart-store.ts` → `types.ts`

This is the only implementation that treats the codebase as production software. Highlights:

- **Dependency injection:** `createApp(store: CartStore)` makes the Hono app testable by receiving the store as a parameter. Every route handler calls `store.method()` — the API layer never touches raw SQL.
- **Test suite:** Three test files using `node:test` (zero extra dependencies). Tests cover CartStore persistence, add/merge/update/delete logic, API status codes, and frontend HTML. Tests create temporary databases and clean up.
- **Database design:** The `cart_items` table has `product_id TEXT NOT NULL UNIQUE` — the constraint is at the database level, not just application logic. Uses JOINs to fetch name/priceCents from `products` (zero denormalization). `ON DELETE CASCADE`, `CHECK (price_cents > 0)`, `CHECK (quantity > 0)`.
- **Input validation:** Typed discriminated unions (`{ ok: true; ... } | { ok: false; error }`) for validate functions — cleaner than ad-hoc checks.
- **Frontend:** Busy/locking with `withBusy()` disables all buttons during API calls to prevent double-click races. `aria-live="polite"` and `role="status"` for accessibility. Displays error messages in a status bar. Uses `Intl.NumberFormat` for currency. `Promise.all` for parallel data fetching. Proper regex-based escape function (handles `&`, `<`, `>`, `"`, `'`).
- **Shutdown:** SIGINT/SIGTERM handlers call `store.close()`.
- **Configurability:** Supports `DATABASE_PATH` env var.
- **Extra:** `.gitignore`, `mkdirSync` for data directory creation, clean modular CSS with responsive breakpoint.

**Minor criticisms:**
- CSS and HTML are inline in `app.ts` as a template literal — makes `app.ts` large at ~280 lines. A separate file would be cleaner.
- Slightly over-engineered for a 5-endpoint cart (the class-based store with typed assertion helpers is maybe YAGNI for this scope — but it's defensible).

---

### 2. _reference (Reference Implementation)

**Architecture:** Flat `server.ts` (117 lines), separate `app.js`, `index.html`, `style.css`

This is the "minimal but correct" gold standard. What it does right:

- **Lean DB design:** `cart_items` stores only `id`, `product_id`, `quantity`. Name and price come from JOINs — no redundant data.
- **Hardcoded product IDs:** `p_apple`, `p_bread`, etc. — deterministic, easy to test, no UUID generation for seed data.
- **Transaction for seeding:** `const tx = db.transaction(() => { ... })` — proper atomicity.
- **Clean error handling:** `.catch(() => null)` pattern on JSON parsing, then explicit type checks.
- **Efficient DELETE check:** Uses `result.changes === 0` instead of a separate SELECT.
- **serveStatic:** Clean `rewriteRequestPath` to serve `/` → `/index.html` with one `app.use("/*", ...)` line.
- **Frontend JS is a module:** Separate `app.js` loaded with `<script type="module">`, no inline handlers.

**Criticisms:**
- All server logic in one file — no separation of DB access from HTTP handling.
- No dedicated types file.
- No tests.
- `.catch(() => null)` discards JSON parse errors — doesn't distinguish between missing body and malformed JSON.

---

### 3. opus4.7

**Architecture:** `server.ts` + `db.ts`, separate `app.js`, `index.html`, `styles.css`

Very solid implementation. Highlights:

- **Clean DB design:** Uses JOINs (no denormalization), `foreign_keys = ON`, `CHECK (quantity > 0)`.
- **Merge-on-add:** Same product increments existing cart item quantity — good UX.
- **Transactional seed:** Uses `db.transaction()`.
- **Frontend:** Separate `app.js` module with clean `createElement`-based DOM construction. Update button + Remove button per cart item. Proper `async/await` throughout.
- **Good validation:** Type checks on `productId` and `quantity`, catches JSON parse errors.

**Criticisms:**
- `moduleResolution: "Bundler"` (uppercase B) in tsconfig — inconsistent casing, though it works on macOS case-insensitive FS.
- PATCH doesn't accept `quantity: 0` to remove an item.
- Frontend uses innerHTML with string concatenation for item rendering — less safe than createElement.
- No tests.

---

### 4. deepseek4

**Architecture:** `server.ts` + `db.ts` + `types.ts`, inline JS in `index.html`

Clean structure but with one significant design flaw:

- **DB design issue:** `cart_items` stores `name` and `price_cents` redundantly. If a product's name or price changes, cart items become stale. The JOIN-based approach used by gpt-5.5/_reference/opus4.7 is strictly better.
- **File separation:** Good — `db.ts` as a singleton via `getDb()`, `types.ts` for shared interfaces, `server.ts` for routes.
- **Input validation:** Proper checks on POST (productId type, quantity range) and PATCH (quantity).
- **Merge-on-add:** Increments existing cart item — good.
- **Frontend:** Inline JS in HTML avoids the need for a separate JS file but is harder to maintain. Quantity `+`/`−` buttons plus a direct number input — nice UX touch.

**Criticisms:**
- Denormalized schema (see above) — the biggest weakness.
- No `.gitignore`.
- No tests.
- No busy/locking state on frontend.
- No `aria-*` attributes.
- Static files served manually via `readFileSync` instead of using Hono's serveStatic.

---

### 5. kimi2.6

**Architecture:** `server.ts` + `db.ts`, separate `index.html`, `style.css`

The code is structurally reasonable, but the frontend has a critical antipattern:

- **❌ Inline event handlers:** The HTML contains `onclick="addToCart(...)"`, `onchange="updateQuantity(...)"`, and similar attributes. This couples behavior to markup, defeats CSP, and requires exposing functions on `window` (which it does: `window.addToCart = addToCart`). This is the single worst practice seen across all implementations.
- **DB design:** `UNIQUE` on `productId` in cart_items enforces one-per-product — good. But column names are camelCase (`productId`, `priceCents`) in SQLite, which technically works but is non-idiomatic for SQL (most DB conventions use snake_case).
- **No error handling:** API routes don't check if the product exists before adding to cart. `updateCartItem` and `deleteCartItem` don't check if the item exists first. Errors result in runtime crashes or silent failures.
- **No validation in PATCH:** Doesn't accept `quantity: 0`.

**Criticisms:**
- Inline event handlers are a dealbreaker.
- Missing error handling throughout.
- `onclick` handlers pass string IDs directly into template literals — XSS surface area.
- `moduleResolution: "bundler"` with no bundler — misleading.

---

### 6. qwen3.6

**Architecture:** Single `index.ts` + single `index.html`

The most structurally problematic implementation:

- **❌ Bypasses @hono/node-server:** Instead of using `serve()` from `@hono/node-server`, it manually implements an HTTP adapter using `node:http.createServer()`. It constructs `Request` objects by reading raw chunks, manually maps headers, and manually pumps response streams. This is reinventing what `@hono/node-server` already does — error-prone and unidiomatic.
- **❌ Fragile start command:** `npm start` runs `node --loader ts-node/esm src/index.ts`. This requires `ts-node` to handle ESM TypeScript at runtime — a configuration that's notoriously fragile. It produces deprecation warnings. The spec says to produce a compiled output via `npm run build`, but `build` is just `tsc --noEmit`.
- **No deduplication:** POST always creates a brand new cart item, even for the same product. You get duplicate entries.
- **DB is in `src/`:** `src/index.html` and DB in `data/` — the HTML isn't in a `public/` directory, so it can't be served by standard static middleware.
- **`var` instead of `let/const`:** The frontend JavaScript uses `var` everywhere — a dated practice.
- **Unused dependency:** `uuid` package is listed but `randomUUID` from `crypto` is used instead.
- **PATCH quantity=0 returns `{ item: null }`:** Doesn't return proper 204.
- **Clears cart on first startup:** `DELETE FROM cart_items` is called during seed — if somehow the DB already had cart items from a previous run, they get wiped.

**Criticisms:**
- Missing `@hono/node-server` dependency — a fundamental deviation from the spec (spec says "backend: Hono", not "raw node:http").
- Start script is brittle and generates deprecation warnings.
- No error handling for missing items in routes.
- Product IDs use simple numeric strings ("1", "2", "3") — collisions likely if deployed with any other system.

---

## Side-by-Side Comparison

| Criterion | gpt-5.5 | _reference | opus4.7 | deepseek4 | kimi2.6 | qwen3.6 |
|-----------|---------|------------|---------|-----------|---------|---------|
| DB denormalized? | ✅ No (JOINs) | ✅ No (JOINs) | ✅ No (JOINs) | ❌ Yes (stores name/price in cart) | ✅ No (JOINs) | ❌ Yes |
| DB constraints | UNIQUE, FK cascade, CHECK | FK reference | FK, CHECK | Basic FK | UNIQUE, FK | Basic FK |
| Dedup on add | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Tests | ✅ (3 files) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Frontend JS approach | Inline (escape) | Module file | Module file | Inline (escape) | Inline handlers | Inline (no escape) |
| Busy/lock on frontend | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Accessibility (aria) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Shutdown hooks | ✅ (SIGINT/TERM) | ❌ | ❌ | ❌ | ❌ | ❌ |
| .gitignore | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Uses @hono/node-server | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| npm start reliability | ✅ compiled JS | ✅ tsx | ✅ compiled JS | ✅ compiled JS | ✅ tsx | ⚠️ ts-node/esm |
| Spec compliance | 100% | 100% | ~95% | ~90% | ~80% | ~70% |

## Recommendation

**gpt-5.5 is the clear winner.** It's the only implementation that:

1. Has a test suite proving correctness
2. Properly separates concerns (HTTP layer, data layer, types)
3. Uses dependency injection for testability
4. Implements database constraints at the schema level
5. Handles edge cases (busy/lock states, accessibility, shutdown, configurable DB path)
6. Uses zero denormalized data in the schema

The reference implementation is excellent for its brevity and would be the pick if the criterion were "smallest correct implementation." But for a real project that needs to be maintained, tested, and deployed, gpt-5.5's engineering discipline wins decisively.
