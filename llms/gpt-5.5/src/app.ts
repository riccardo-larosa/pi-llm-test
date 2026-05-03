import { Hono } from 'hono';
import type { Context } from 'hono';
import type { CartStore } from './cart-store.js';

const html = String.raw;

export function createApp(store: CartStore): Hono {
  const app = new Hono();

  app.get('/', (c) => c.html(indexHtml()));

  app.get('/api/products', (c) => c.json({ products: store.getProducts() }));

  app.get('/api/cart', (c) => c.json({ items: store.getCartItems() }));

  app.post('/api/cart/items', async (c) => {
    const body = await readJson(c);
    const validation = validateAddBody(body);
    if (!validation.ok) {
      return c.json({ error: validation.error }, 400);
    }

    try {
      const item = store.addCartItem(validation.productId, validation.quantity);
      return c.json({ item }, 201);
    } catch (error) {
      return handleStoreError(c, error);
    }
  });

  app.patch('/api/cart/items/:id', async (c) => {
    const body = await readJson(c);
    const validation = validateQuantityBody(body);
    if (!validation.ok) {
      return c.json({ error: validation.error }, 400);
    }

    try {
      const item = store.updateCartItem(c.req.param('id'), validation.quantity);
      return c.json({ item });
    } catch (error) {
      return handleStoreError(c, error);
    }
  });

  app.delete('/api/cart/items/:id', (c) => {
    store.deleteCartItem(c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

type QuantityValidation =
  | { ok: true; quantity: number }
  | { ok: false; error: string };

type AddValidation =
  | { ok: true; productId: string; quantity: number }
  | { ok: false; error: string };

function validateQuantityBody(body: unknown): QuantityValidation {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object' };
  }

  const quantity = (body as { quantity?: unknown }).quantity;
  if (!Number.isInteger(quantity) || (quantity as number) < 0) {
    return { ok: false, error: 'quantity must be a non-negative integer' };
  }

  return { ok: true, quantity: quantity as number };
}

function validateAddBody(body: unknown): AddValidation {
  const quantity = validateQuantityBody(body);
  if (!quantity.ok) {
    return quantity;
  }

  const productId = (body as { productId?: unknown }).productId;
  if (typeof productId !== 'string' || productId.trim() === '') {
    return { ok: false, error: 'productId is required' };
  }

  if (quantity.quantity <= 0) {
    return { ok: false, error: 'quantity must be a positive integer' };
  }

  return { ok: true, productId, quantity: quantity.quantity };
}

function handleStoreError(c: Context, error: unknown): Response {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message.includes('not found')) {
    return c.json({ error: message }, 404);
  }
  return c.json({ error: message }, 400);
}

function indexHtml(): string {
  return html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Shopping Cart</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f6f7fb;
        color: #1f2937;
      }
      * { box-sizing: border-box; }
      body { margin: 0; }
      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 32px 20px 48px;
      }
      header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 28px;
      }
      h1, h2, h3, p { margin-top: 0; }
      h1 { font-size: clamp(2rem, 4vw, 3.5rem); margin-bottom: 6px; }
      .subtitle { color: #6b7280; margin-bottom: 0; }
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 380px;
        gap: 24px;
        align-items: start;
      }
      .panel {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 18px;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
        padding: 22px;
      }
      .products {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 16px;
      }
      .product, .cart-item {
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 16px;
        background: #ffffff;
      }
      .product {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .product h3 { margin-bottom: 0; }
      .price, .line-total, #cart-total { font-weight: 700; }
      button {
        border: 0;
        border-radius: 10px;
        padding: 10px 13px;
        font-weight: 700;
        cursor: pointer;
        background: #2563eb;
        color: white;
      }
      button:hover { background: #1d4ed8; }
      button:disabled { cursor: wait; opacity: 0.7; }
      .remove { background: #ef4444; }
      .remove:hover { background: #dc2626; }
      .cart-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .cart-item {
        display: grid;
        gap: 12px;
      }
      .cart-row, .cart-actions, .total-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      input[type="number"] {
        width: 82px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        padding: 9px 10px;
        font: inherit;
      }
      .empty {
        color: #6b7280;
        border: 1px dashed #d1d5db;
        border-radius: 14px;
        padding: 18px;
        text-align: center;
      }
      .status {
        min-height: 24px;
        color: #b45309;
        font-weight: 600;
      }
      .total-row {
        margin-top: 18px;
        border-top: 1px solid #e5e7eb;
        padding-top: 18px;
        font-size: 1.15rem;
      }
      @media (max-width: 840px) {
        .layout { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>Shopping Cart</h1>
          <p class="subtitle">A small anonymous cart backed by SQLite.</p>
        </div>
      </header>

      <div class="layout">
        <section class="panel" aria-labelledby="products-heading">
          <h2 id="products-heading">Products</h2>
          <div id="products" class="products" aria-live="polite">
            <button data-testid="add-to-cart" hidden>Add placeholder</button>
          </div>
        </section>

        <aside class="panel" aria-labelledby="cart-heading">
          <h2 id="cart-heading">Your cart</h2>
          <p id="status" class="status" role="status"></p>
          <div id="cart" class="cart-list" aria-live="polite"></div>
          <div class="total-row">
            <span>Total</span>
            <span id="cart-total">$0.00</span>
          </div>
        </aside>
      </div>
    </main>

    <script>
      const productsEl = document.querySelector('#products');
      const cartEl = document.querySelector('#cart');
      const statusEl = document.querySelector('#status');
      const totalEl = document.querySelector('#cart-total');

      const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
      let busy = false;

      function formatCents(cents) {
        return money.format(cents / 100);
      }

      function setStatus(message) {
        statusEl.textContent = message || '';
      }

      async function api(path, options = {}) {
        const response = await fetch(path, {
          ...options,
          headers: {
            ...(options.body ? { 'content-type': 'application/json' } : {}),
            ...(options.headers || {}),
          },
        });

        if (!response.ok) {
          let message = 'Request failed';
          try {
            const body = await response.json();
            message = body.error || message;
          } catch {}
          throw new Error(message);
        }

        if (response.status === 204) return null;
        return response.json();
      }

      async function refresh() {
        const [productsBody, cartBody] = await Promise.all([
          api('/api/products'),
          api('/api/cart'),
        ]);
        renderProducts(productsBody.products);
        renderCart(cartBody.items);
      }

      function renderProducts(products) {
        productsEl.innerHTML = products.map((product) =>
          '<article class="product">' +
            '<h3>' + escapeHtml(product.name) + '</h3>' +
            '<div class="price">' + formatCents(product.priceCents) + '</div>' +
            '<button data-testid="add-to-cart" data-product-id="' + escapeHtml(product.id) + '">Add to cart</button>' +
          '</article>'
        ).join('');
      }

      function renderCart(items) {
        if (items.length === 0) {
          cartEl.innerHTML = '<div class="empty">Your cart is empty.</div>';
        } else {
          cartEl.innerHTML = items.map((item) =>
            '<article class="cart-item">' +
              '<div class="cart-row">' +
                '<strong>' + escapeHtml(item.name) + '</strong>' +
                '<span class="line-total">' + formatCents(item.priceCents * item.quantity) + '</span>' +
              '</div>' +
              '<div class="cart-actions">' +
                '<label>' +
                  'Qty ' +
                  '<input type="number" min="0" step="1" value="' + item.quantity + '" data-item-id="' + escapeHtml(item.id) + '" aria-label="Quantity for ' + escapeHtml(item.name) + '" />' +
                '</label>' +
                '<button class="remove" data-testid="remove-item" data-item-id="' + escapeHtml(item.id) + '">Remove</button>' +
              '</div>' +
            '</article>'
          ).join('');
        }

        const total = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
        totalEl.textContent = formatCents(total);
      }

      productsEl.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-testid="add-to-cart"]');
        if (!button || !button.dataset.productId || busy) return;
        await withBusy(async () => {
          await api('/api/cart/items', {
            method: 'POST',
            body: JSON.stringify({ productId: button.dataset.productId, quantity: 1 }),
          });
          await refresh();
        });
      });

      cartEl.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-testid="remove-item"]');
        if (!button || busy) return;
        await withBusy(async () => {
          await api('/api/cart/items/' + encodeURIComponent(button.dataset.itemId), { method: 'DELETE' });
          await refresh();
        });
      });

      cartEl.addEventListener('change', async (event) => {
        const input = event.target.closest('input[type="number"][data-item-id]');
        if (!input || busy) return;
        const quantity = Number(input.value);
        if (!Number.isInteger(quantity) || quantity < 0) {
          setStatus('Quantity must be a non-negative whole number.');
          await refresh();
          return;
        }

        await withBusy(async () => {
          await api('/api/cart/items/' + encodeURIComponent(input.dataset.itemId), {
            method: 'PATCH',
            body: JSON.stringify({ quantity }),
          });
          await refresh();
        });
      });

      async function withBusy(work) {
        busy = true;
        setStatus('');
        document.querySelectorAll('button, input').forEach((element) => element.disabled = true);
        try {
          await work();
        } catch (error) {
          setStatus(error.message || 'Something went wrong.');
        } finally {
          busy = false;
          document.querySelectorAll('button, input').forEach((element) => element.disabled = false);
        }
      }

      function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (char) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        }[char]));
      }

      refresh().catch((error) => setStatus(error.message || 'Unable to load cart.'));
    </script>
  </body>
</html>`;
}
