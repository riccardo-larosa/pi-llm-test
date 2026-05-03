import { serve } from '@hono/node-server';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CartStore } from './cart-store.js';
import { createApp } from './app.js';

export function getPort(env: NodeJS.ProcessEnv): number {
  const rawPort = env.PORT;
  if (!rawPort) {
    return 3000;
  }

  const port = Number(rawPort);
  return Number.isInteger(port) && port > 0 ? port : 3000;
}

export function getDefaultDatabasePath(): string {
  return join(process.cwd(), 'data', 'shopping-cart.sqlite');
}

export function startServer(): void {
  const dbPath = process.env.DATABASE_PATH || getDefaultDatabasePath();
  mkdirSync(dirname(dbPath), { recursive: true });
  const store = new CartStore(dbPath);
  const app = createApp(store);
  const port = getPort(process.env);

  serve({ fetch: app.fetch, port }, () => {
    console.log(`Shopping cart server listening on http://localhost:${port}`);
  });

  const shutdown = () => {
    store.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  startServer();
}
