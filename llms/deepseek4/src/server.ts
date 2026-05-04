import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getDb } from "./db.js";
import type { Product, CartItem } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicRoot = path.resolve(__dirname, "..", "public");

const app = new Hono();

// --- API Routes ---

// GET /api/products
app.get("/api/products", (c) => {
  const db = getDb();
  const rows = db.prepare("SELECT id, name, price_cents FROM products").all() as Product[];
  const products: Array<{ id: string; name: string; priceCents: number }> = rows.map(
    (r) => ({
      id: r.id,
      name: r.name,
      priceCents: r.price_cents,
    }),
  );
  return c.json({ products });
});

// GET /api/cart
app.get("/api/cart", (c) => {
  const db = getDb();
  const rows = db
    .prepare("SELECT id, product_id, name, quantity, price_cents FROM cart_items")
    .all() as CartItem[];
  const items: Array<{
    id: string;
    productId: string;
    name: string;
    quantity: number;
    priceCents: number;
  }> = rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    name: r.name,
    quantity: r.quantity,
    priceCents: r.price_cents,
  }));
  return c.json({ items });
});

// POST /api/cart/items
app.post("/api/cart/items", async (c) => {
  const db = getDb();
  const body = await c.req.json<{ productId: string; quantity: number }>();

  if (!body.productId || typeof body.productId !== "string") {
    return c.json({ error: "productId is required" }, 400);
  }
  const qty = Number(body.quantity);
  if (!Number.isFinite(qty) || qty < 1) {
    return c.json({ error: "quantity must be a positive number" }, 400);
  }

  const product = db
    .prepare("SELECT id, name, price_cents FROM products WHERE id = ?")
    .get(body.productId) as Product | undefined;

  if (!product) {
    return c.json({ error: "product not found" }, 404);
  }

  // Check if this product already exists in the cart — if so, increment quantity
  const existing = db
    .prepare("SELECT id, quantity FROM cart_items WHERE product_id = ?")
    .get(body.productId) as { id: string; quantity: number } | undefined;

  if (existing) {
    const newQty = existing.quantity + qty;
    db.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").run(
      newQty,
      existing.id,
    );
    const item = db
      .prepare("SELECT id, product_id, name, quantity, price_cents FROM cart_items WHERE id = ?")
      .get(existing.id) as CartItem;
    return c.json(
      {
        item: {
          id: item.id,
          productId: item.product_id,
          name: item.name,
          quantity: item.quantity,
          priceCents: item.price_cents,
        },
      },
      201,
    );
  }

  const id = randomUUID();
  db.prepare(
    "INSERT INTO cart_items (id, product_id, name, quantity, price_cents) VALUES (?, ?, ?, ?, ?)",
  ).run(id, product.id, product.name, qty, product.price_cents);

  const item = db
    .prepare("SELECT id, product_id, name, quantity, price_cents FROM cart_items WHERE id = ?")
    .get(id) as CartItem;

  return c.json(
    {
      item: {
        id: item.id,
        productId: item.product_id,
        name: item.name,
        quantity: item.quantity,
        priceCents: item.price_cents,
      },
    },
    201,
  );
});

// PATCH /api/cart/items/:id
app.patch("/api/cart/items/:id", async (c) => {
  const db = getDb();
  const itemId = c.req.param("id");
  const body = await c.req.json<{ quantity: number }>();

  const qty = Number(body.quantity);
  if (!Number.isFinite(qty) || qty < 0) {
    return c.json({ error: "quantity must be a non-negative number" }, 400);
  }

  const existing = db
    .prepare("SELECT id FROM cart_items WHERE id = ?")
    .get(itemId) as { id: string } | undefined;

  if (!existing) {
    return c.json({ error: "cart item not found" }, 404);
  }

  if (qty === 0) {
    db.prepare("DELETE FROM cart_items WHERE id = ?").run(itemId);
    return c.body(null, 204);
  }

  db.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").run(qty, itemId);

  const item = db
    .prepare("SELECT id, product_id, name, quantity, price_cents FROM cart_items WHERE id = ?")
    .get(itemId) as CartItem;

  return c.json({
    item: {
      id: item.id,
      productId: item.product_id,
      name: item.name,
      quantity: item.quantity,
      priceCents: item.price_cents,
    },
  });
});

// DELETE /api/cart/items/:id
app.delete("/api/cart/items/:id", (c) => {
  const db = getDb();
  const itemId = c.req.param("id");

  const existing = db
    .prepare("SELECT id FROM cart_items WHERE id = ?")
    .get(itemId) as { id: string } | undefined;

  if (!existing) {
    return c.json({ error: "cart item not found" }, 404);
  }

  db.prepare("DELETE FROM cart_items WHERE id = ?").run(itemId);
  return c.body(null, 204);
});

// --- Static File Serving ---
app.get("/style.css", (c) => {
  const content = readFileSync(path.join(publicRoot, "style.css"), "utf-8");
  return new Response(content, { headers: { "Content-Type": "text/css" } });
});

app.get("/", (_c) => {
  const html = readFileSync(path.join(publicRoot, "index.html"), "utf-8");
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
});

// Start server
const port = parseInt(process.env.PORT || "3000", 10);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    // eslint-disable-next-line no-console
    console.log(`Server running on http://localhost:${info.port}`);
  },
);
