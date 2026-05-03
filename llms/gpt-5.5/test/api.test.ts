import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { CartStore } from '../src/cart-store.js';
import { createApp } from '../src/app.js';

let tempDir: string;
let store: CartStore;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'cart-api-'));
  store = new CartStore(join(tempDir, 'cart.db'));
  app = createApp(store);
});

afterEach(() => {
  store.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('API', () => {
  it('returns seeded products', async () => {
    const response = await app.request('/api/products');
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.products.length, 5);
  });

  it('adds, updates, and deletes a cart item', async () => {
    const product = store.getProducts()[0];

    const addResponse = await app.request('/api/cart/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: product.id, quantity: 2 }),
    });
    const addBody = await addResponse.json();

    assert.equal(addResponse.status, 201);
    assert.equal(addBody.item.productId, product.id);
    assert.equal(addBody.item.quantity, 2);

    const cartResponse = await app.request('/api/cart');
    assert.deepEqual(await cartResponse.json(), { items: [addBody.item] });

    const patchResponse = await app.request(`/api/cart/items/${addBody.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quantity: 4 }),
    });
    const patchBody = await patchResponse.json();

    assert.equal(patchResponse.status, 200);
    assert.equal(patchBody.item.quantity, 4);

    const deleteResponse = await app.request(`/api/cart/items/${addBody.item.id}`, { method: 'DELETE' });
    assert.equal(deleteResponse.status, 204);
    assert.deepEqual(store.getCartItems(), []);
  });

  it('returns 400 for invalid quantities and 404 for missing resources', async () => {
    const product = store.getProducts()[0];

    const invalidAdd = await app.request('/api/cart/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: product.id, quantity: 0 }),
    });
    assert.equal(invalidAdd.status, 400);

    const missingProduct = await app.request('/api/cart/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: 'missing', quantity: 1 }),
    });
    assert.equal(missingProduct.status, 404);

    const missingItem = await app.request('/api/cart/items/missing', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quantity: 1 }),
    });
    assert.equal(missingItem.status, 404);
  });

  it('serves frontend HTML at root', async () => {
    const response = await app.request('/');
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /data-testid="add-to-cart"/);
    assert.match(html, /Shopping Cart/);
  });
});
