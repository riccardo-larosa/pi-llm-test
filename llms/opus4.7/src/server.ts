import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { randomUUID } from "node:crypto";
import { db, seedProducts } from "./db.js";

seedProducts();

type ProductRow = { id: string; name: string; price_cents: number };
type CartRow = { id: string; product_id: string; name: string; quantity: number; price_cents: number };

const app = new Hono();

app.get("/api/products", (c) => {
  const rows = db.prepare("SELECT id, name, price_cents FROM products ORDER BY name").all() as ProductRow[];
  return c.json({
    products: rows.map((r) => ({ id: r.id, name: r.name, priceCents: r.price_cents })),
  });
});

app.get("/api/cart", (c) => {
  const rows = db
    .prepare(
      `SELECT ci.id, ci.product_id, p.name, ci.quantity, p.price_cents
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       ORDER BY ci.id`
    )
    .all() as CartRow[];
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
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  const productId = body?.productId;
  const quantity = Number(body?.quantity);
  if (typeof productId !== "string" || !Number.isInteger(quantity) || quantity <= 0) {
    return c.json({ error: "invalid body" }, 400);
  }

  const product = db.prepare("SELECT id, name, price_cents FROM products WHERE id = ?").get(productId) as
    | ProductRow
    | undefined;
  if (!product) return c.json({ error: "product not found" }, 404);

  // Merge with existing line item for the same product, otherwise insert.
  const existing = db
    .prepare("SELECT id, quantity FROM cart_items WHERE product_id = ?")
    .get(productId) as { id: string; quantity: number } | undefined;

  let id: string;
  let finalQty: number;
  if (existing) {
    finalQty = existing.quantity + quantity;
    db.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").run(finalQty, existing.id);
    id = existing.id;
  } else {
    id = randomUUID();
    finalQty = quantity;
    db.prepare("INSERT INTO cart_items (id, product_id, quantity) VALUES (?, ?, ?)").run(id, productId, finalQty);
  }

  return c.json(
    {
      item: {
        id,
        productId: product.id,
        name: product.name,
        quantity: finalQty,
        priceCents: product.price_cents,
      },
    },
    201
  );
});

app.patch("/api/cart/items/:id", async (c) => {
  const id = c.req.param("id");
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  const quantity = Number(body?.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return c.json({ error: "invalid quantity" }, 400);
  }

  const row = db
    .prepare(
      `SELECT ci.id, ci.product_id, p.name, ci.quantity, p.price_cents
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.id = ?`
    )
    .get(id) as CartRow | undefined;
  if (!row) return c.json({ error: "item not found" }, 404);

  db.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").run(quantity, id);

  return c.json({
    item: {
      id: row.id,
      productId: row.product_id,
      name: row.name,
      quantity,
      priceCents: row.price_cents,
    },
  });
});

app.delete("/api/cart/items/:id", (c) => {
  const id = c.req.param("id");
  const info = db.prepare("DELETE FROM cart_items WHERE id = ?").run(id);
  if (info.changes === 0) return c.json({ error: "item not found" }, 404);
  return c.body(null, 204);
});

// Serve static frontend from ./public
app.use("/*", serveStatic({ root: "./public" }));
app.get("/", serveStatic({ path: "./public/index.html" }));

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`);
});
