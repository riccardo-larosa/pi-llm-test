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
