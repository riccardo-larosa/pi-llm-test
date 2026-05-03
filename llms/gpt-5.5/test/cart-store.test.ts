import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { CartStore } from '../src/cart-store.js';

let tempDir: string;
let dbPath: string;
let store: CartStore;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'cart-store-'));
  dbPath = join(tempDir, 'cart.db');
  store = new CartStore(dbPath);
});

afterEach(() => {
  store.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('CartStore', () => {
  it('seeds products on first startup', () => {
    const products = store.getProducts();

    assert.equal(products.length, 5);
    assert.ok(products.every((product) => product.id && product.name && product.priceCents > 0));
  });

  it('persists cart items across store restarts', () => {
    const product = store.getProducts()[0];
    const item = store.addCartItem(product.id, 2);
    store.close();

    store = new CartStore(dbPath);

    assert.deepEqual(store.getCartItems(), [item]);
  });

  it('adds quantity to an existing cart item for the same product', () => {
    const product = store.getProducts()[0];
    const first = store.addCartItem(product.id, 2);
    const second = store.addCartItem(product.id, 3);

    assert.equal(second.id, first.id);
    assert.equal(second.quantity, 5);
    assert.deepEqual(store.getCartItems(), [{ ...first, quantity: 5 }]);
  });

  it('updates cart item quantity', () => {
    const product = store.getProducts()[0];
    const item = store.addCartItem(product.id, 1);

    const updated = store.updateCartItem(item.id, 4);

    assert.deepEqual(updated, { ...item, quantity: 4 });
  });

  it('removes cart item when quantity is updated to zero', () => {
    const product = store.getProducts()[0];
    const item = store.addCartItem(product.id, 1);

    const updated = store.updateCartItem(item.id, 0);

    assert.equal(updated, null);
    assert.deepEqual(store.getCartItems(), []);
  });

  it('deletes cart item', () => {
    const product = store.getProducts()[0];
    const item = store.addCartItem(product.id, 1);

    store.deleteCartItem(item.id);

    assert.deepEqual(store.getCartItems(), []);
  });
});
