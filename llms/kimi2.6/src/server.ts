import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { seedProducts, getProducts, getCartItems, addCartItem, updateCartItem, deleteCartItem } from './db.js';

seedProducts();

const app = new Hono();

app.use('/api/*', async (c, next) => {
  c.header('Content-Type', 'application/json');
  await next();
});

app.get('/api/products', (c) => {
  const products = getProducts();
  return c.json({ products });
});

app.get('/api/cart', (c) => {
  const items = getCartItems();
  return c.json({ items });
});

app.post('/api/cart/items', async (c) => {
  const body = await c.req.json();
  const { productId, quantity } = body;
  if (!productId || typeof quantity !== 'number' || quantity < 1) {
    return c.json({ error: 'Invalid input' }, 400);
  }
  const item = addCartItem(productId, quantity);
  c.status(201);
  return c.json({ item });
});

app.patch('/api/cart/items/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { quantity } = body;
  if (typeof quantity !== 'number' || quantity < 1) {
    return c.json({ error: 'Invalid input' }, 400);
  }
  const item = updateCartItem(id, quantity);
  return c.json({ item });
});

app.delete('/api/cart/items/:id', (c) => {
  const id = c.req.param('id');
  deleteCartItem(id);
  c.status(204);
  return c.body(null);
});

app.use('*', serveStatic({ root: './public' }));

const port = parseInt(process.env.PORT || '3000', 10);

serve({
  fetch: app.fetch,
  port,
});

console.log(`Server running on http://localhost:${port}`);
