# Evaluation of Shopping Cart Implementations

**Evaluator:** Claude Sonnet 4.6  
**Date:** 2026-05-03  
**Spec:** `../../spec/PROMPT.md` — Shopping Cart Coding Test  
**Candidates:** `_reference`, `deepseek4`, `gpt-5.5`, `kimi2.6`, `opus4.7`, `qwen3.6` (self)

---

## Requirement Checklist

| Requirement | _reference | deepseek4 | gpt-5.5 | kimi2.6 | opus4.7 | qwen3.6 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| TypeScript | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hono backend | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SQLite via `better-sqlite3` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| File-based, survives restart | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vanilla HTML/CSS/JS (no framework) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Single anonymous cart | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Seed ~5 products on first startup | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Frontend served at `/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View cart, add product, change qty, remove | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Frontend uses API (no client state) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `data-testid="add-to-cart"` | ⚠️ `dataset.testid` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `data-testid="remove-item"` | ⚠️ `dataset.testid` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /api/products` → 200 `{ products }` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /api/cart` → 200 `{ items }` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /api/cart/items` → 201 `{ item }` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PATCH /api/cart/items/:id` → 200 `{ item }` | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| `DELETE /api/cart/items/:id` → 204 | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ✅ |
| `npm install` works | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `npm run build` exits 0 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `npm start` on `PORT` (default 3000) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cart initially empty on fresh DB | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| Cart persists across restart | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Product` type matches spec | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| `CartItem` type matches spec | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| Normalizes duplicate POST (merge quantities) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## Per-Candidate Analysis

### 1. `_reference`

**Score: 7/10**

**Strengths:**
- Clean, production-quality separation: `src/server.ts`, `public/index.html`, `public/app.js`, `public/style.css`
- Correct use of `@hono/node-server` for Node HTTP serving — the proper recommended approach
- Proper `productName normalization` via explicit mapping from snake-case DB rows
- SMART normalization of duplicate cart via `UPDATE` on existing product
- Minimal and well-structured code

**Weaknesses:**
- **CRITICAL BUG:** Uses `dataset.testid` instead of `data-testid` attribute. Setting `btn.dataset.testid = "add-to-cart"` produces `data-testid="add-to-cart"` in the DOM, NOT `data-testid="add-to-cart"`. The grader will not find the correct test IDs.
- Cart items table stores only `quantity` (no `name` or `price_cents`) — relies on JOIN with products table at query time. This is actually fine architecturally (avoids denormalization drift) but means `getCartItem` queries are more complex.
- `tsconfig.json` uses `moduleResolution: "bundler"` which is less portable than `NodeNext`.

**Verdict:** Solid architecture but the `data-testid` vs `data-testid` bug is a test failure.

---

### 2. `deepseek4`

**Score: 6/10**

**Strengths:**
- Good modular structure: `src/db.ts`, `src/server.ts`, `src/types.ts`
- Properly uses `@hono/node-server`
- Handles duplicate POST normalization (merge quantities)
- `data-testid` attributes correctly set via template literals in HTML
- XSS protection via `esc()` function in frontend
- Quantity increment/decrement buttons (+/−) alongside direct input
- Compiles to `dist/` and `npm start` runs `node dist/server.js`

**Weaknesses:**
- **`DELETE /api/cart/items/:id` returns 204 correctly**, but `PATCH` with `quantity=0` also returns 204 instead of 200 — spec says PATCH always returns 200.
- **`cart_initially_empty` risk:** The `getDb()` singleton pattern is lazy-initialized on first request. If the grader checks cart before making any API call, the DB won't be initialized yet. However — `GET /` serves HTML which doesn't trigger `getDb()`, so technically the DB init is deferred until the first API request. This shouldn't cause `cart_initially_empty` to fail since the cart table would just be empty.
- Product IDs are `randomUUID()` at seed time, stored in DB, but not deterministic across runs. This is fine for a single-user cart but means `GET /api/products` returns different IDs on fresh installs.
- The `cart_items` table denormalizes `name` AND `price_cents` — redundant with products table, can drift if product price changes.
- Manual static file serving (`/style.css` route + `/` route) instead of `serveStatic` middleware.

**Verdict:** Competent but some API contract deviations. Works for most tests.

---

### 3. `gpt-5.5`

**Score: 9/10**

**Strengths:**
- **Excellent architecture:** Clean three-layer separation — `cart-store.ts` (data/persistence), `app.ts` (routes/logic), `server.ts` (HTTP bootstrap). This is proper layered design.
- `CartStore` class encapsulates all DB logic with proper `close()` and SIGINT/SIGTERM shutdown handlers
- `FOREIGN_KEYS = ON` pragma for referential integrity
- CHECK constraints in schema (`price_cents > 0`, `quantity > 0`)
- `product_id UNIQUE` constraint in `cart_items` naturally enforces single-line per product
- Handle duplicate POST by merging into existing line item
- Proper validation with discriminated unions (`{ ok: true, quantity }` vs `{ ok: false, error }`)
- Only stores `id, product_id, quantity` in cart_items (no denormalization) — uses JOINs to get `name` and `price_cents` from products table
- `npm start` properly reads `PORT` env var with validation
- Tests included (`test/api.test.ts`, `test/cart-store.test.ts`, `test/server-start.test.ts`)
- Beautiful frontend with responsive two-column layout, `Intl.NumberFormat` for currency, busy state management, XSS escaping
- Deterministic product IDs (`'coffee-beans'`, `'ceramic-mug'`, etc.)
- `data-testid` attributes correctly set

**Weaknesses:**
- HTML is inlined as a String.raw template literal inside `app.ts` — technically works but mixes concerns (could be a separate file). The `style` block is also embedded rather than a CSS file.
- `npm start` uses `node dist/server.js` which means the server won't auto-restart on code changes (fine for the spec, but `tsx` would be nicer for dev).
- `handleStoreError` in `app.ts` string-matches on `"not found"` which is fragile.
- Uses `String.raw` for HTML which is undocumented/non-standard (though widely supported).

**Verdict:** Best overall implementation. Production-quality architecture, correct API contract, great code organization, proper validation, clean DB design, and a polished frontend.

---

### 4. `kimi2.6`

**Score: 4/10**

**Strengths:**
- Minimal, simple structure
- No build step needed (`build: "echo 'No build needed'"`)

**Weaknesses:**
- **CRITICAL:** Uses `tsx` for `npm start` — requires `tsx` as a dependency. It's in `devDependencies`, which means `npm start` might fail if the grader only runs `npm install` (which does install devDependencies). This works but is fragile.
- **DB uses camelCase column names** (`priceCents`, `productId`) in SQLite. While SQLite allows this, `better-sqlite3` returns them as-is, so the type casts work. However this violates the spec's TS types which use camelCase keys — the DB query results happen to align by accident, not by explicit mapping.
- **CRITICAL:** `cart_items` has `productId TEXT NOT NULL UNIQUE` — this means only ONE item per product can exist. This is fine for the single-cart requirement but means `POST /api/cart/items` with the same product again would fail with a UNIQUE constraint violation. Wait — actually the `addCartItem` function checks for existing and merges, so it handles this. But if the check-and-merge happens in a race condition... (not an issue for single user, but shows lack of defense).
- **DB stores products with camelCase column names** which works but looks odd. The type cast `as Product[]` works because the column names happen to match, but this is fragile.
- **PATCH validation requires `quantity >= 1`** but spec allows setting quantity to any positive integer. This rejects `quantity=0` which could be interpreted as "remove item" — debatable but inconsistent with spec.
- **Seed uses `randomUUID()` for product IDs** — nondeterministic. Different IDs on each fresh install.
- **No explicit mapping from DB to API types** — relies entirely on `as` casts, which is fragile.
- `serveStatic` uses `root: './public'` — relative to `process.cwd()`, which is correct for the grader environment but fragile in other contexts.
- No `.gitignore` for `cart.db`.

**Verdict:** Minimal and somewhat fragile. Works for basic tests but has design issues.

---

### 5. `opus4.7`

**Score: 8/10**

**Strengths:**
- Clean two-file structure (`src/server.ts`, `src/db.ts`)
- Proper `@hono/node-server` usage
- Correct `serveStatic` middleware for frontend
- Proper row-to-API-type mapping via `.map()` (not raw casts)
- Handle duplicate POST by merging into existing line item
- `FOREIGN_KEYS = ON` pragma
- CHECK constraint on `quantity > 0` in schema
- Nondeterministic product IDs via `randomUUID()` (same as deepseek)
- Clean frontend with DOM-based rendering (textNode-based, not innerHTML) for XSS safety
- `app.js` uses `textContent` instead of innerHTML for product names and prices — XSS-safe
- `data-testid` attributes correctly set

**Weaknesses:**
- `cart_items` stores only `product_id` and `quantity` (no name or price) — must JOIN with products table for all reads. This is architecturally clean but means more complex queries everywhere.
- `DB_PATH` defaults to `path.join(process.cwd(), "cart.db")` at module load time. If the grader starts the server from a different directory than expected, this could point to the wrong location. `_reference` uses `__dirname` which is more robust.
- **Product IDs are `randomUUID()`** — nondeterministic. Each fresh install produces different product IDs. If the grader checks for specific product names but uses IDs from a fresh install, this should still work since the grader presumably fetches products first, then uses those IDs.
- No `.gitignore` for `cart.db`.
- Frontend JS uses `innerHTML` for the cart items rendering (XSS risk if product names contain HTML). The products listing uses `textContent` (safe) but the cart list also constructs innerHTML... wait, actually `app.js` creates DOM elements with `innerHTML` for the structure but fills in `textContent` for the dynamic values. This is safe.

**Verdict:** Very solid, clean implementation with correct behavior, proper serving, and XSS-safe frontend rendering.

---

### 6. `qwen3.6` (self-evaluation)

**Score: 6/10**

**Strengths:**
- Minimal file count (2 source files: `src/index.ts`, `src/index.html`)
- No transpilation dependency — uses `ts-node/esm` loader directly
- Deterministic product IDs (`"1"`, `"2"`, etc.)
- `data-testid` attributes correctly set in HTML

**Weaknesses:**
- **Custom HTTP adapter** instead of using `@hono/node-server`. The spec doesn't require avoiding dependencies, and `@hono/node-server` is the standard Hono adapter for Node. This adds unnecessary complexity and a potential source of bugs (the manual Request construction, response body piping, etc.).
- **No duplicate POST normalization** — each `POST /api/cart/items` for the same product creates a separate cart item. The spec says "single anonymous cart" and the type shows CartItem has a `productId`. Having multiple items with the same `productId` is ambiguous and likely fails a grader check.
- **Denormalizes `name` and `price_cents` in `cart_items`** — if a product's name or price changes, the cart item retains the old values. This is actually reasonable for a real cart (you want the price at time of purchase), but the spec doesn't explicitly require it and it can cause inconsistency. Actually for a shopping cart, this IS the correct behavior — you want to preserve the price at add time. But it wastes space.
- **`ts-node/esm` via `--loader` flag** is experimental and deprecated. `tsx` is a more standard approach for running TypeScript directly.
- Snake-case to camel-case conversion uses `AS` aliases in SQL, which works but is verbose and repeated everywhere. A utility function or ORM layer would be cleaner.
- No error handling in most route handlers — missing try/catch blocks around DB operations.
- The `npm start` script uses `PORT=${PORT:-3000}` which is a bash-ism. The server also reads `process.env.PORT` internally, so the bash wrapper is redundant but doesn't hurt.
- WAL mode without `TEMP_STORE = memory` — minor performance concern but not a bug.
- No `.gitignore` for `data/` directory.

**Verdict:** Functional but with architectural shortcuts. The custom HTTP adapter is the biggest misstep — it adds complexity without benefit when `@hono/node-server` handles this cleanly. Missing duplicate-product normalization is likely a test failure.

---

## Head-to-Head Comparison

| Criterion | Best | Notes |
|---|---|---|
| Architecture / Separation of Concerns | **gpt-5.5** | Three-layer architecture with CartStore class |
| API Contract Compliance | **gpt-5.5**, **opus4.7** | Both match spec exactly |
| DB Design | **gpt-5.5**, **opus4.7** | No denormalization, proper constraints and JOINs |
| Frontend Quality | **gpt-5.5** | Polished UI, responsive layout, busy states, Intl currency |
| Frontend Safety (XSS) | **opus4.7** | DOM-based rendering with textContent |
| Reliability (npm start) | **opus4.7**, **gpt-5.5** | Proper use of `@hono/node-server` |
| Duplicate POST Handling | **gpt-5.5**, **opus4.7**, **deepseek4** | Merge into existing line item |
| `data-testid` correctness | **gpt-5.5**, **opus4.7**, **deepseek4** | _reference uses `dataset.testid` (wrong HTML attr) |
| Min. Files / Simplicity | **kimi2.6** | Only 2 source files (but fragile) |

---

## Winner: `gpt-5.5`

**Why gpt-5.5 wins:**

1. **Best architecture by a wide margin.** Three-layer separation (store → app → server) is exactly how a professional Node.js project should be structured. The `CartStore` class encapsulates all DB operations, making it testable and reusable.

2. **Correct API contract.** All endpoints return the right status codes, the right shapes, and handle edge cases (invalid JSON, missing fields, negative quantities, not-found cases).

3. **Clean DB design.** No denormalization. Uses JOINs, foreign keys, CHECK constraints, and the `UNIQUE` constraint on `product_id` in `cart_items` naturally prevents duplicate line items.

4. **Polished frontend.** Makes the best use of vanilla JS — event delegation, proper error handling, busy state management, `Intl.NumberFormat` for currency formatting, HTML escaping, responsive two-column layout.

5. **Production-ready touches.** SIGINT/SIGTERM handlers, `close()` on the DB, validation with discriminated unions, explicit error typing. Even includes test files.

**The only gaps vs perfection:**
- `String.raw` for HTML is slightly unconventional but widely supported
- Inline HTML+CSS instead of separate files (minor for this spec)
- `handleStoreError` string-matches on error messages instead of using proper error types
- Product IDs are human-readable strings but not UUIDs (doesn't matter for this spec)

**Close second:** `opus4.7` — nearly as good, but inlines a bit more logic in `server.ts`, uses nondeterministic product IDs, and the DB path is `process.cwd()`-relative rather than `__dirname`-relative.

**Flawed but notable:** `_reference` would have been the winner if not for the `dataset.testid` bug.

**Significantly behind:** `deepseek4` (PATCH contract deviation), `kimi2.6` (fragile, camelCase SQL columns, no proper type mapping), `qwen3.6` (custom HTTP adapter, no duplicate normalization, experimental ts-node loader).
