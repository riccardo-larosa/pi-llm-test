import { Hono } from "hono";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import fs from "node:fs";

export type Product = { id: string; name: string; priceCents: number };
export type CartItem = { id: string; productId: string; name: string; quantity: number; priceCents: number };

// --- Paths ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "cart.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// --- Database ---
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
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price_cents INTEGER NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// --- Seed products ---
const seedProducts: Product[] = [
  { id: "1", name: "Wireless Mouse", priceCents: 2999 },
  { id: "2", name: "Mechanical Keyboard", priceCents: 7499 },
  { id: "3", name: "USB-C Hub", priceCents: 4599 },
  { id: "4", name: "Webcam HD", priceCents: 5999 },
  { id: "5", name: "Desk Lamp", priceCents: 3499 },
];

const existingCount = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
if (existingCount.count === 0) {
  const insert = db.prepare(
    "INSERT INTO products (id, name, price_cents) VALUES (@id, @name, @priceCents)"
  );
  const tx = db.transaction((items: Product[]) => {
    for (const item of items) {
      insert.run(item);
    }
  });
  tx(seedProducts);
}

// --- App ---
const app = new Hono();

app.get("/api/products", (c) => {
  const products = db.prepare("SELECT id, name, price_cents as priceCents FROM products").all() as Product[];
  return c.json({ products });
});

app.get("/api/cart", (c) => {
  const items = db.prepare("SELECT id, product_id as productId, name, quantity, price_cents as priceCents FROM cart_items ORDER BY id").all() as CartItem[];
  return c.json({ items });
});

app.post("/api/cart/items", async (c) => {
  const body = await c.req.json();
  const productId = body.productId;
  const quantity = body.quantity ?? 1;

  if (!productId) return c.json({ error: "productId is required" }, 400);

  const product = db.prepare("SELECT id, name, price_cents as priceCents FROM products WHERE id = ?").get(productId) as Product | undefined;
  if (!product) return c.json({ error: "Product not found" }, 404);

  const id = randomUUID();
  db.prepare(
    "INSERT INTO cart_items (id, product_id, name, quantity, price_cents) VALUES (?, ?, ?, ?, ?)"
  ).run(id, product.id, product.name, quantity, product.priceCents);

  const item = db.prepare("SELECT id, product_id as productId, name, quantity, price_cents as priceCents FROM cart_items WHERE id = ?").get(id) as CartItem;
  return c.json({ item }, 201);
});

app.patch("/api/cart/items/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const quantity = body.quantity;

  if (quantity === undefined || quantity === null) {
    return c.json({ error: "quantity is required" }, 400);
  }

  const existing = db.prepare("SELECT id, product_id as productId, name, quantity, price_cents as priceCents FROM cart_items WHERE id = ?").get(id) as CartItem | undefined;
  if (!existing) return c.json({ error: "Not found" }, 404);

  if (quantity <= 0) {
    db.prepare("DELETE FROM cart_items WHERE id = ?").run(id);
    return c.json({ item: null }, 200);
  }

  db.prepare("UPDATE cart_items SET quantity = ? WHERE id = ?").run(quantity, id);
  const updated = db.prepare("SELECT id, product_id as productId, name, quantity, price_cents as priceCents FROM cart_items WHERE id = ?").get(id) as CartItem;
  return c.json({ item: updated });
});

app.delete("/api/cart/items/:id", (c) => {
  const id = c.req.param("id");
  const existing = db.prepare("SELECT id FROM cart_items WHERE id = ?").get(id);
  if (!existing) return c.notFound();
  db.prepare("DELETE FROM cart_items WHERE id = ?").run(id);
  return new Response(null, { status: 204 });
});

// --- Frontend ---
const htmlPath = path.join(__dirname, "index.html");
const htmlContent = fs.readFileSync(htmlPath, "utf-8");

app.get("/", (c) => c.html(htmlContent));

// --- Adapter: Node http to Hono ---
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Build Request from IncomingMessage
  const url = new URL(`http://${req.headers.host || `localhost:${port}`}${req.url || "/"}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    } else if (value) {
      headers.set(key, value);
    }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = chunks.length > 0 ? Buffer.concat(chunks) : null;

  const request = new Request(url.toString(), {
    method: req.method || "GET",
    headers,
    body: body ?? undefined,
  });

  const response = await app.request(request);

  // Write response
  const resHeaders: [string, string][] = [];
  response.headers.forEach((v, k) => {
    resHeaders.push([k, v]);
  });

  // Don't override content-length if already set
  resHeaders.forEach(([k, v]) => res.setHeader(k, v));
  res.writeHead(response.status, response.statusText);

  if (response.body) {
    const reader = response.body.getReader();
    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read();
      if (done) { res.end(); return; }
      res.write(Buffer.from(value));
      await pump();
    };
    await pump();
  } else {
    res.end();
  }
}

// --- Start ---
const port = parseInt(process.env.PORT || "3000", 10);

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  try {
    await handleRequest(req, res);
  } catch (e) {
    console.error("Handler error:", e);
    res.writeHead(500);
    res.end("Internal server error");
  }
});

server.listen(port, () => {
  console.log(`Shopping cart server running on port ${port}`);
});
