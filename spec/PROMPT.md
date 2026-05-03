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
