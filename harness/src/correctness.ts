import { execa } from "execa";
import getPort from "get-port";
import { fetch } from "undici";
import type { CorrectnessResult } from "./types.ts";
import type { SubmissionHandle } from "./lifecycle.ts";

type Product = { id: string; name: string; priceCents: number };
type CartItem = { id: string; productId: string; name: string; quantity: number; priceCents: number };

async function safeJson<T>(res: { json: () => Promise<unknown> }): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function isProduct(p: unknown): p is Product {
  return !!p && typeof (p as Product).id === "string"
    && typeof (p as Product).name === "string"
    && Number.isFinite((p as Product).priceCents);
}

function isCartItem(c: unknown): c is CartItem {
  if (!c || typeof c !== "object") return false;
  const i = c as CartItem;
  return typeof i.id === "string"
    && typeof i.productId === "string"
    && typeof i.name === "string"
    && Number.isFinite(i.quantity)
    && Number.isFinite(i.priceCents);
}

async function waitForReady(baseUrl: string, deadlineMs: number): Promise<boolean> {
  while (performance.now() < deadlineMs) {
    try {
      const res = await fetch(`${baseUrl}/api/products`, { signal: AbortSignal.timeout(1000) });
      if (res.status === 200) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function killProcessGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (!pid) return;
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // already gone
    }
  }
}

async function waitForExit(proc: ReturnType<typeof execa>, ms: number): Promise<void> {
  await Promise.race([
    proc.catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

export async function runCorrectness(handle: SubmissionHandle): Promise<CorrectnessResult> {
  const tests = {
    products_listed: false,
    cart_initially_empty: false,
    post_creates_item: false,
    duplicate_post_handled: false,
    patch_updates_quantity: false,
    delete_removes_item: false,
    restart_persistence: false,
  };
  let primedItemId: string | null = null;

  let firstProductId: string | null = null;
  {
    const res = await fetch(`${handle.baseUrl}/api/products`);
    const body = await safeJson<{ products: unknown }>(res);
    if (res.status === 200 && body && Array.isArray(body.products) && body.products.length > 0 && body.products.every(isProduct)) {
      tests.products_listed = true;
      firstProductId = (body.products[0] as Product).id;
    }
  }

  {
    const res = await fetch(`${handle.baseUrl}/api/cart`);
    const body = await safeJson<{ items: unknown }>(res);
    if (res.status === 200 && body && Array.isArray(body.items) && body.items.length === 0) {
      tests.cart_initially_empty = true;
    }
  }

  let createdItemId: string | null = null;
  if (firstProductId) {
    const res = await fetch(`${handle.baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId: firstProductId, quantity: 2 }),
    });
    const body = await safeJson<{ item: unknown }>(res);
    if (res.status === 201 && body && isCartItem(body.item) && body.item.productId === firstProductId && body.item.quantity === 2) {
      tests.post_creates_item = true;
      createdItemId = body.item.id;
      primedItemId = body.item.id;
    }
  }

  if (firstProductId) {
    const before = await fetch(`${handle.baseUrl}/api/cart`).then((r) => r.json()) as { items: CartItem[] };
    const res = await fetch(`${handle.baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId: firstProductId, quantity: 1 }),
    });
    if (res.status === 201) {
      const after = await fetch(`${handle.baseUrl}/api/cart`).then((r) => r.json()) as { items: CartItem[] };
      const totalQtyBefore = before.items.filter((i) => i.productId === firstProductId).reduce((s, i) => s + i.quantity, 0);
      const totalQtyAfter = after.items.filter((i) => i.productId === firstProductId).reduce((s, i) => s + i.quantity, 0);
      if (totalQtyAfter === totalQtyBefore + 1) tests.duplicate_post_handled = true;
    }
  }

  if (createdItemId) {
    const res = await fetch(`${handle.baseUrl}/api/cart/items/${createdItemId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quantity: 5 }),
    });
    const body = await safeJson<{ item: unknown }>(res);
    if (res.status === 200 && body && isCartItem(body.item) && body.item.quantity === 5) {
      const cart = await fetch(`${handle.baseUrl}/api/cart`).then((r) => r.json()) as { items: CartItem[] };
      const found = cart.items.find((i) => i.id === createdItemId);
      if (found && found.quantity === 5) tests.patch_updates_quantity = true;
    }
  }

  if (createdItemId) {
    const res = await fetch(`${handle.baseUrl}/api/cart/items/${createdItemId}`, { method: "DELETE" });
    if (res.status === 204) {
      const cart = await fetch(`${handle.baseUrl}/api/cart`).then((r) => r.json()) as { items: CartItem[] };
      if (!cart.items.some((i) => i.id === createdItemId)) tests.delete_removes_item = true;
    }
  }

  if (firstProductId) {
    const addRes = await fetch(`${handle.baseUrl}/api/cart/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId: firstProductId, quantity: 3 }),
    });
    const added = await safeJson<{ item: CartItem }>(addRes);
    if (addRes.status === 201 && added && isCartItem(added.item)) {
      killProcessGroup(handle.proc.pid, "SIGTERM");
      await waitForExit(handle.proc, 2000);
      killProcessGroup(handle.proc.pid, "SIGKILL");
      await waitForExit(handle.proc, 500);

      const newPort = await getPort();
      const newBaseUrl = `http://127.0.0.1:${newPort}`;
      const restarted = execa("npm", ["start"], {
        cwd: handle.dir,
        env: { ...process.env, PORT: String(newPort), DB_PATH: handle.dbPath },
        reject: false,
        all: true,
        detached: true,
      });
      try {
        const ready = await waitForReady(newBaseUrl, performance.now() + 30_000);
        if (ready) {
          const cart = await fetch(`${newBaseUrl}/api/cart`).then((r) => r.json()) as { items: CartItem[] };
          if (cart.items.some((i) => i.productId === firstProductId && i.quantity >= 3)) {
            tests.restart_persistence = true;
          }
        }
      } finally {
        killProcessGroup(restarted.pid, "SIGTERM");
        await waitForExit(restarted, 2000);
        killProcessGroup(restarted.pid, "SIGKILL");
        await waitForExit(restarted, 500);
      }

      handle.startup.startup_ok = false;
    }
  }

  return {
    correctness_total: 7,
    correctness_passed: Object.values(tests).filter(Boolean).length,
    tests,
    primed_item_id: primedItemId,
  };
}
