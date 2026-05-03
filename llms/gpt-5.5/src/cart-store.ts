import Database from 'better-sqlite3';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { CartItem, Product } from './types.js';

const SEED_PRODUCTS: Product[] = [
  { id: 'coffee-beans', name: 'Coffee Beans', priceCents: 1299 },
  { id: 'ceramic-mug', name: 'Ceramic Mug', priceCents: 1599 },
  { id: 'tea-sampler', name: 'Tea Sampler', priceCents: 999 },
  { id: 'honey-jar', name: 'Wildflower Honey', priceCents: 749 },
  { id: 'biscotti-box', name: 'Biscotti Box', priceCents: 899 },
];

type ProductRow = {
  id: string;
  name: string;
  price_cents: number;
};

type CartItemRow = {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  price_cents: number;
};

export class CartStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  close(): void {
    this.db.close();
  }

  getProducts(): Product[] {
    return this.db
      .prepare('SELECT id, name, price_cents FROM products ORDER BY rowid')
      .all()
      .map((row) => this.productFromRow(row as ProductRow));
  }

  getCartItems(): CartItem[] {
    return this.db
      .prepare(`
        SELECT cart_items.id, cart_items.product_id, products.name, cart_items.quantity, products.price_cents
        FROM cart_items
        JOIN products ON products.id = cart_items.product_id
        ORDER BY cart_items.rowid
      `)
      .all()
      .map((row) => this.cartItemFromRow(row as CartItemRow));
  }

  addCartItem(productId: string, quantity: number): CartItem {
    this.assertPositiveInteger(quantity, 'quantity');
    this.assertProductExists(productId);

    const existing = this.findCartItemByProductId(productId);
    if (existing) {
      return this.updateCartItem(existing.id, existing.quantity + quantity) as CartItem;
    }

    const id = randomUUID();
    this.db
      .prepare('INSERT INTO cart_items (id, product_id, quantity) VALUES (?, ?, ?)')
      .run(id, productId, quantity);

    return this.getCartItem(id) as CartItem;
  }

  updateCartItem(id: string, quantity: number): CartItem | null {
    this.assertNonNegativeInteger(quantity, 'quantity');
    this.assertCartItemExists(id);

    if (quantity === 0) {
      this.deleteCartItem(id);
      return null;
    }

    this.db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, id);
    return this.getCartItem(id) as CartItem;
  }

  deleteCartItem(id: string): void {
    this.db.prepare('DELETE FROM cart_items WHERE id = ?').run(id);
  }

  getCartItem(id: string): CartItem | null {
    const row = this.db
      .prepare(`
        SELECT cart_items.id, cart_items.product_id, products.name, cart_items.quantity, products.price_cents
        FROM cart_items
        JOIN products ON products.id = cart_items.product_id
        WHERE cart_items.id = ?
      `)
      .get(id) as CartItemRow | undefined;

    return row ? this.cartItemFromRow(row) : null;
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price_cents INTEGER NOT NULL CHECK (price_cents > 0)
      );

      CREATE TABLE IF NOT EXISTS cart_items (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0)
      );
    `);

    const productCount = this.db.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number };
    if (productCount.count === 0) {
      const insert = this.db.prepare('INSERT INTO products (id, name, price_cents) VALUES (?, ?, ?)');
      const seed = this.db.transaction(() => {
        for (const product of SEED_PRODUCTS) {
          insert.run(product.id, product.name, product.priceCents);
        }
      });
      seed();
    }
  }

  private findCartItemByProductId(productId: string): CartItem | null {
    const row = this.db
      .prepare(`
        SELECT cart_items.id, cart_items.product_id, products.name, cart_items.quantity, products.price_cents
        FROM cart_items
        JOIN products ON products.id = cart_items.product_id
        WHERE cart_items.product_id = ?
      `)
      .get(productId) as CartItemRow | undefined;

    return row ? this.cartItemFromRow(row) : null;
  }

  private assertProductExists(productId: string): void {
    const product = this.db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!product) {
      throw new Error('Product not found');
    }
  }

  private assertCartItemExists(id: string): void {
    const item = this.db.prepare('SELECT id FROM cart_items WHERE id = ?').get(id);
    if (!item) {
      throw new Error('Cart item not found');
    }
  }

  private assertPositiveInteger(value: number, field: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${field} must be a positive integer`);
    }
  }

  private assertNonNegativeInteger(value: number, field: string): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${field} must be a non-negative integer`);
    }
  }

  private productFromRow(row: ProductRow): Product {
    return {
      id: row.id,
      name: row.name,
      priceCents: row.price_cents,
    };
  }

  private cartItemFromRow(row: CartItemRow): CartItem {
    return {
      id: row.id,
      productId: row.product_id,
      name: row.name,
      quantity: row.quantity,
      priceCents: row.price_cents,
    };
  }
}
