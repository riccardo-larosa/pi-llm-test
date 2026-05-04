import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "cart.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initSchema();
    seedProducts();
  }
  return db;
}

function initSchema(): void {
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
      quantity INTEGER NOT NULL,
      price_cents INTEGER NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);
}

function seedProducts(): void {
  const count = db.prepare("SELECT COUNT(*) AS cnt FROM products").get() as {
    cnt: number;
  };
  if (count.cnt > 0) return;

  const products = [
    { id: randomUUID(), name: "Coffee Mug", priceCents: 1299 },
    { id: randomUUID(), name: "Notebook", priceCents: 599 },
    { id: randomUUID(), name: "T-Shirt", priceCents: 2499 },
    { id: randomUUID(), name: "Pen Set", priceCents: 899 },
    { id: randomUUID(), name: "Water Bottle", priceCents: 1599 },
  ];

  const insert = db.prepare(
    "INSERT INTO products (id, name, price_cents) VALUES (@id, @name, @priceCents)",
  );

  const tx = db.transaction(() => {
    for (const p of products) {
      insert.run(p);
    }
  });
  tx();
}
