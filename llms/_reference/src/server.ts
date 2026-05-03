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
