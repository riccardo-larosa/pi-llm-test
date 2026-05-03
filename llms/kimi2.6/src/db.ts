import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'cart.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    priceCents INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY,
    productId TEXT NOT NULL UNIQUE,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (productId) REFERENCES products(id)
  );
`);

export function seedProducts() {
  const count = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (count.count === 0) {
    const insert = db.prepare('INSERT INTO products (id, name, priceCents) VALUES (?, ?, ?)');
    const products = [
      { id: randomUUID(), name: 'Wireless Mouse', priceCents: 2999 },
      { id: randomUUID(), name: 'Mechanical Keyboard', priceCents: 8999 },
      { id: randomUUID(), name: 'USB-C Cable', priceCents: 1299 },
      { id: randomUUID(), name: 'Webcam 1080p', priceCents: 4999 },
      { id: randomUUID(), name: 'Laptop Stand', priceCents: 3499 },
    ];
    for (const p of products) {
      insert.run(p.id, p.name, p.priceCents);
    }
  }
}

export type Product = { id: string; name: string; priceCents: number };
export type CartItem = { id: string; productId: string; name: string; quantity: number; priceCents: number };

export function getProducts(): Product[] {
  return db.prepare('SELECT id, name, priceCents FROM products').all() as Product[];
}

export function getCartItems(): CartItem[] {
  return db.prepare(`
    SELECT ci.id, ci.productId, p.name, ci.quantity, p.priceCents
    FROM cart_items ci
    JOIN products p ON ci.productId = p.id
  `).all() as CartItem[];
}

export function addCartItem(productId: string, quantity: number): CartItem {
  const existing = db.prepare('SELECT id, quantity FROM cart_items WHERE productId = ?').get(productId) as { id: string; quantity: number } | undefined;
  if (existing) {
    const newQty = existing.quantity + quantity;
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(newQty, existing.id);
    const row = db.prepare(`
      SELECT ci.id, ci.productId, p.name, ci.quantity, p.priceCents
      FROM cart_items ci
      JOIN products p ON ci.productId = p.id
      WHERE ci.id = ?
    `).get(existing.id) as CartItem;
    return row;
  }
  const id = randomUUID();
  db.prepare('INSERT INTO cart_items (id, productId, quantity) VALUES (?, ?, ?)').run(id, productId, quantity);
  const row = db.prepare(`
    SELECT ci.id, ci.productId, p.name, ci.quantity, p.priceCents
    FROM cart_items ci
    JOIN products p ON ci.productId = p.id
    WHERE ci.id = ?
  `).get(id) as CartItem;
  return row;
}

export function updateCartItem(id: string, quantity: number): CartItem {
  db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, id);
  const row = db.prepare(`
    SELECT ci.id, ci.productId, p.name, ci.quantity, p.priceCents
    FROM cart_items ci
    JOIN products p ON ci.productId = p.id
    WHERE ci.id = ?
  `).get(id) as CartItem;
  return row;
}

export function deleteCartItem(id: string): void {
  db.prepare('DELETE FROM cart_items WHERE id = ?').run(id);
}
