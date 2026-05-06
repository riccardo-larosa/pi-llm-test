# Shopping Cart Implementation Evaluation by gpt-5.5

## Scope

I evaluated the implementations under `../llms/` against `../../spec/PROMPT.md` for the shopping-cart coding test.

Implementations reviewed:

- `_reference`
- `deepseek4`
- `gpt-5.5`
- `kimi2.6`
- `opus4.7`
- `qwen3.6`

## Methodology

For each implementation I reviewed:

1. `package.json` scripts and dependencies.
2. Backend/API implementation.
3. SQLite schema, seeding, and persistence approach.
4. Frontend behavior and API usage.
5. Build/start behavior.
6. Basic live smoke-test results for:
   - `GET /`
   - `GET /api/products`
   - `GET /api/cart`
   - `POST /api/cart/items`
   - `PATCH /api/cart/items/:id`
   - `DELETE /api/cart/items/:id`

All implementations built successfully and responded to the basic API smoke test when run with a unique `PORT`.

## Ranking

| Rank | Implementation | Score | Summary |
|---:|---|---:|---|
| 1 | `gpt-5.5` | 91/100 | Best overall: complete behavior, clean API/store separation, persistent SQLite, good validation, and tests. Main drawback is a large inline frontend in `src/app.ts`. |
| 2 | `opus4.7` | 86/100 | Very strong and compact implementation with clean public frontend files and good API validation. Slightly less robust than `gpt-5.5` due to no tests and some stricter-than-specified quantity handling. |
| 3 | `deepseek4` | 79/100 | Functional and polished frontend, but cart rows denormalize product name/price and error handling/build structure are less clean. |
| 4 | `qwen3.6` | 72/100 | Works in smoke tests and has a good-looking inline frontend, but uses a custom Node HTTP adapter instead of the standard Hono server adapter, has weaker quantity validation, and does not emit build output. |
| 5 | `kimi2.6` | 67/100 | Meets happy-path behavior but has weak validation, no real TypeScript build, missing foreign-key enforcement, and can return malformed API responses for invalid product/item cases. |
| 6 | `_reference` | 62/100 | Solid API baseline, but frontend does not implement quantity changes, which is an explicit required behavior. |

## Best implementation

**Best overall: `gpt-5.5`**

It is the most complete implementation relative to the prompt. It satisfies the required stack, scripts, API, persistence, frontend interactions, and includes automated tests. Its architecture separates the data layer (`CartStore`) from Hono routing (`createApp`) and server startup (`server.ts`), making it easier to test and reason about than most alternatives.

The main improvement I would request before production use is extracting the large inline HTML/CSS/JS from `src/app.ts` into static frontend files or a focused template module.

---

## Detailed evaluations

## `_reference`

### What works well

- Uses TypeScript, Hono, `better-sqlite3`, and vanilla frontend assets.
- Seeds five products on first startup.
- Uses a file-backed SQLite database at `data.sqlite` by default.
- API happy paths work:
  - `GET /api/products` returns products.
  - `GET /api/cart` returns cart items.
  - `POST /api/cart/items` returns `201 { item }`.
  - `PATCH /api/cart/items/:id` returns `200 { item }`.
  - `DELETE /api/cart/items/:id` returns `204`.
- Handles unknown products and missing cart items with sensible `404` responses.
- Merges duplicate products into one cart line item, which is a reasonable cart model.

### Issues

- **Frontend misses required quantity editing.** The frontend can view products, add items, view cart, and remove items, but it does not expose a quantity input/control for changing quantity. This is a direct miss against the prompt.
- `npm start` uses `tsx src/server.ts`; this is acceptable after `npm install`, but less production-like than running compiled JS.
- Backend and database logic are all in one `src/server.ts` file. For a small test this is acceptable, but it is less modular.
- Frontend `data-testid` attributes are added dynamically in `public/app.js`; they are not present in the initial HTML. This is probably acceptable for rendered-DOM tests but less obvious for static HTML probes.

### Verdict

Good backend baseline, but the missing frontend quantity-change feature prevents it from being fully compliant.

---

## `deepseek4`

### What works well

- Uses the required stack: TypeScript, Hono, `better-sqlite3`, vanilla HTML/CSS/JS.
- `npm run build` compiles with `tsc`; `npm start` runs `node dist/server.js`.
- Seeds five products on first startup.
- File-backed SQLite database at `cart.db` in the project root.
- API happy paths pass smoke tests.
- Frontend is polished and includes products, cart, total, add, quantity patch, and remove.
- Required `data-testid="add-to-cart"` and `data-testid="remove-item"` appear in the frontend.
- Handles missing products/items with `404` on the main API paths.

### Issues

- Cart rows duplicate `name` and `price_cents` in `cart_items` instead of joining to `products`. This works for immutable seeded products, but it creates unnecessary denormalization and potential stale data.
- Quantity validation accepts non-integer numbers because it checks `Number.isFinite(qty)` rather than `Number.isInteger(qty)`. The prompt says quantity is a number, but shopping-cart quantities should be integral.
- Static file serving is manual and only explicitly serves `/` and `/style.css`; the inline script avoids needing `/app.js`, but the setup is less general than using `serveStatic` for the whole public directory.
- No automated tests.
- Database singleton in `db.ts` makes isolated tests harder.

### Verdict

A functional and user-friendly implementation with good happy-path compliance. It loses points for denormalized cart data, weak integer validation, and lack of tests.

---

## `gpt-5.5`

### What works well

- Uses the required stack: TypeScript, Hono, `better-sqlite3`, vanilla HTML/CSS/JS.
- `npm run build` compiles with `tsc`; `npm start` runs `node dist/server.js`.
- Uses a persistent SQLite file at `data/shopping-cart.sqlite` by default, with `DATABASE_PATH` override support.
- Seeds five stable products on first startup.
- Clear backend separation:
  - `src/cart-store.ts` owns SQLite schema and cart operations.
  - `src/app.ts` owns Hono routing and frontend response.
  - `src/server.ts` owns startup, port handling, DB path, and shutdown.
- API happy paths pass smoke tests.
- Frontend supports viewing products/cart, adding products, changing quantity, removing items, and total calculation.
- Frontend uses the API as the source of truth and refreshes from the API after mutations.
- Required `data-testid` attributes are present.
- Includes automated tests for store behavior, API behavior, frontend root response, and startup helpers.
- Good validation for JSON bodies, missing product IDs, product existence, missing item IDs, and integer quantities.

### Issues

- `src/app.ts` is large because it contains the entire HTML, CSS, and browser JS inline. This keeps deployment simple, but hurts readability and maintainability.
- `PATCH /api/cart/items/:id` accepts quantity `0`, deletes the item, and returns `200 { item: null }`. This is convenient for the frontend but does not exactly match the table's `200 { item: CartItem }` response shape. The frontend also has a separate remove button, so quantity-zero-as-delete is not required.
- `DELETE /api/cart/items/:id` returns `204` even for a missing item. The spec does not define missing-item behavior, so this is acceptable, but it is less explicit than returning `404`.
- The hidden placeholder `data-testid="add-to-cart"` button in the initial HTML is unnecessary because real add buttons are rendered dynamically. It may help static probes, but it is a bit artificial.

### Verdict

Best overall. It is the most complete, testable, and robust implementation. The main weakness is frontend colocation inside a large server-side string.

---

## `kimi2.6`

### What works well

- Uses TypeScript, Hono, `better-sqlite3`, and vanilla frontend files.
- `npm start` respects `PORT` and starts with `tsx`.
- Seeds five products on first startup.
- File-backed SQLite database at `cart.db`.
- API happy paths pass smoke tests.
- Frontend supports product display, cart display, add, quantity update, and remove.
- Required `data-testid` attributes are present in the frontend.
- Code is short and easy to scan.

### Issues

- `npm run build` is only `echo 'No build needed'`; TypeScript is not typechecked or emitted. A no-op build is allowed by the prompt, but this misses an easy quality check.
- Foreign keys are declared but `PRAGMA foreign_keys = ON` is not enabled, so invalid cart rows can be inserted.
- `addCartItem()` does not validate that the product exists before insert. With foreign keys off, invalid product IDs can create orphaned cart rows and return malformed/undefined item data.
- `updateCartItem()` does not check whether the cart item exists before updating. A missing item can produce `undefined` as the returned item.
- `PATCH` rejects quantity `0`; not necessarily wrong, but the frontend only permits min `1`, so quantity-zero removal is not supported through quantity editing.
- API errors are not consistently handled. Invalid JSON can throw rather than return a clean `400`.
- Global database instance makes tests harder.

### Verdict

Good happy-path demo, but weaker than the top implementations due to insufficient validation and lack of real build/typecheck.

---

## `opus4.7`

### What works well

- Uses the required stack: TypeScript, Hono, `better-sqlite3`, vanilla frontend files.
- `npm run build` compiles with `tsc`; `npm start` runs compiled JS.
- Seeds five products on first startup.
- File-backed SQLite database at `cart.db`, with `DB_PATH` override.
- Enables `journal_mode = WAL` and `foreign_keys = ON`.
- API happy paths pass smoke tests.
- Backend is concise and understandable.
- Cart schema is normalized: cart items reference products and cart reads join to products.
- Frontend is separated into `public/index.html`, `public/app.js`, and CSS, which is cleaner than large inline HTML.
- Frontend supports product display, cart display, add, quantity update, remove, empty state, and total.
- Required `data-testid` attributes are dynamically rendered in the frontend.
- Good API validation for JSON, product existence, missing cart items, and integer quantities.

### Issues

- No automated tests.
- `PATCH` rejects quantity `0`, so quantity editing cannot remove an item. The prompt separately requires remove buttons, so this is not a major issue.
- Static serving relies on `./public` relative to the process working directory. This works under normal `npm start` from the project root, but is slightly less robust than resolving from module location.
- The root route is registered after `app.use("/*", serveStatic(...))`; it worked in smoke tests, but route ordering is a bit less explicit than serving `/` first or configuring index fallback.
- Initial static HTML does not contain the final add/remove test IDs because they are rendered by JS. This is acceptable for browser tests, but may fail overly simplistic static probes.

### Verdict

Second-best overall. It is arguably the cleanest small implementation structurally. `gpt-5.5` edges it out because of automated tests and slightly more explicit startup/database-path handling.

---

## `qwen3.6`

### What works well

- Uses TypeScript, Hono, `better-sqlite3`, and vanilla inline HTML/CSS/JS.
- Seeds five products on first startup.
- Uses a persistent SQLite file under `data/cart.db`.
- API happy paths pass smoke tests.
- Frontend is visually complete and supports display, add, quantity update, remove, and total.
- Required `data-testid` attributes are present in the frontend.
- Deterministic product IDs make data easy to inspect.

### Issues

- Does not use `@hono/node-server`; instead it manually adapts Node `http` requests into Hono requests. This still uses Hono, but it is more complex and less idiomatic than necessary.
- `npm run build` only runs `tsc --noEmit`, so no compiled server is produced. `npm start` runs TypeScript through `ts-node` with an ESM loader.
- `npm start` emits experimental/deprecation warnings from the loader path under current Node.
- Quantity validation is weak:
  - `POST` defaults missing quantity to `1` even though the API body requires `quantity`.
  - `POST` does not reject non-integer, zero, or negative quantities.
  - `PATCH` accepts non-integer quantities and treats `<= 0` as deletion.
- `PATCH` with quantity `<= 0` returns `200 { item: null }`, which does not match the specified `200 { item: CartItem }` shape.
- Each `POST /api/cart/items` creates a new cart row even if the same product is already present. This is not explicitly forbidden, but it is a less conventional cart model and can make the UI noisier.
- Cart rows denormalize product name and price into `cart_items`.
- No automated tests.

### Verdict

Works on the happy path, but the custom server adapter and weaker API validation make it less robust and less idiomatic than the top implementations.

---

## Comparative notes

### API compliance

All implementations passed the basic happy-path API smoke test. The strongest API implementations are:

1. `gpt-5.5`
2. `opus4.7`
3. `_reference`

The weakest are `kimi2.6` and `qwen3.6`, mainly due to missing validation and malformed edge-case responses.

### Frontend compliance

All except `_reference` implement the required frontend quantity-change behavior. `_reference` is the only clear frontend miss.

Best frontend structure:

1. `opus4.7` — clean separated static files.
2. `deepseek4` — polished inline-in-HTML frontend.
3. `gpt-5.5` — complete behavior, but too much inline code in `src/app.ts`.

### Persistence/data model

Best data models:

1. `gpt-5.5` — normalized, explicit store, stable seed IDs, testable DB path.
2. `opus4.7` — normalized, foreign keys enabled, DB path override.
3. `_reference` — normalized and simple.

Weaker data models:

- `deepseek4` and `qwen3.6` duplicate product name/price in cart rows.
- `kimi2.6` declares foreign keys but does not enable enforcement.

### Maintainability

Best maintainability:

1. `opus4.7` — concise and separated frontend assets.
2. `gpt-5.5` — best backend boundaries and tests, but large inline frontend.
3. `deepseek4` — reasonable split, but less clean data model.

### Test coverage

Only `gpt-5.5` includes meaningful automated tests. This is a major differentiator for confidence.

## Final recommendation

Choose **`gpt-5.5`** as the best implementation.

If improving it further, I would:

1. Move the inline frontend from `src/app.ts` into `public/index.html`, `public/app.js`, and `public/styles.css`.
2. Decide whether `PATCH quantity: 0` should be rejected, deleted with `204`, or kept as `200 { item: null }`; then align the API response with the table.
3. Remove the hidden placeholder test button from the initial HTML once the grader is confirmed to evaluate the rendered DOM.

If prioritizing minimal code and frontend/backend separation over tests, `opus4.7` is the closest alternative.
