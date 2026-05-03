import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";

const dbPath = process.env.DB_PATH || path.join(process.cwd(), "cart.db");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

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

export function seedProducts() {
  const count = (db.prepare("SELECT COUNT(*) AS c FROM products").get() as { c: number }).c;
  if (count > 0) return;

  const seed = [
    { name: "Coffee Mug", priceCents: 1299 },
    { name: "Notebook", priceCents: 899 },
    { name: "T-Shirt", priceCents: 1999 },
    { name: "Sticker Pack", priceCents: 499 },
    { name: "Water Bottle", priceCents: 1599 },
  ];

  const insert = db.prepare("INSERT INTO products (id, name, price_cents) VALUES (?, ?, ?)");
  const tx = db.transaction(() => {
    for (const p of seed) insert.run(randomUUID(), p.name, p.priceCents);
  });
  tx();
}
