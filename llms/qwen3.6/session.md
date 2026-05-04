# Session Summary: Shopping Cart Coding Test

## Goal
Implement a shopping cart application per `../../spec/PROMPT.md` in the `qwen3.6` directory.

## What Was Built
A complete shopping cart app with:
- **Backend**: Hono + `better-sqlite3` (file-based SQLite, survives restart)
- **Frontend**: Vanilla HTML/CSS/JS served at `/`
- **API**: All 5 required endpoints (`GET /api/products`, `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/:id`, `DELETE /api/cart/items/:id`)
- **Frontend**: `data-testid="add-to-cart"` and `data-testid="remove-item"` on respective buttons

## Files Created
| File | Purpose |
|---|---|
| `package.json` | Scripts (`build`, `start`) + deps (Hono, better-sqlite3, ts-node, TypeScript) |
| `tsconfig.json` | ES2022 / NodeNext modules / strict mode |
| `src/index.ts` | Hono server, SQLite schema, seeding, API routes, frontend serving |
| `src/index.html` | Frontend with inline CSS/JS |

## Key Challenges
- `better-sqlite3` returns raw snake-case column names — had to use `SELECT price_cents as priceCents` etc. throughout
- Hono's `app.fetch()` doesn't accept Node `IncomingMessage` directly — implemented a manual HTTP adapter converting Node streams to/from Web Streams API
- `hono/node-server` import failed (missing types on this version) — switched to manual adapter
- Nested template literals in inline HTML/JS caused TS parsing errors — extracted frontend to a separate `.html` file read at runtime

## Iterations (28 assistant messages)
1. Initial package.json, tsconfig, index.ts with inline HTML → TS errors from nested backticks
2. Extracted HTML template into array-joined function → still had escaping issues
3. Extracted HTML to separate `src/index.html` file (`fs.readFileSync`)
4. `import.meta` + `hono/node-server` not available → switched to manual Node HTTP adapter with `createServer`
5. `serveStatic` import failed → removed, using `fs.readFileSync` directly
6. Snake-case vs camel-case DB columns → added aliases to all SELECT queries
7. Port conflict on testing → killed old processes, ran full integration tests

## Verification
All three scripts work:
- `npm install` ✓
- `npm run build` ✓ (TypeScript `--noEmit` exits 0)
- `npm start` ✓ (server starts on `$PORT`, default 3000)

API tested with curl: products seeded, add/update/remove/delete cart items all return correct response shapes and status codes.

## Token Usage
- Input: 598,815 · Output: 23,437 · Total: 622,252
- Cost: $0.27
