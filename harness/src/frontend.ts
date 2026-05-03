import { chromium } from "playwright";
import { fetch } from "undici";
import type { FrontendResult } from "./types.ts";
import type { SubmissionHandle } from "./lifecycle.ts";

type CartItem = { id: string; productId: string; name: string; quantity: number; priceCents: number };

async function cartTotalQuantity(baseUrl: string): Promise<number> {
  const data = (await (await fetch(`${baseUrl}/api/cart`)).json()) as { items: CartItem[] };
  return data.items.reduce((s, i) => s + i.quantity, 0);
}

export async function runFrontend(handle: SubmissionHandle): Promise<FrontendResult> {
  const result: FrontendResult = {
    frontend_ok: false,
    page_rendered: false,
    add_works: false,
    remove_works: false,
    bundle_bytes: 0,
    dom_loaded_ms: Number.NaN,
  };

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  let bundleBytes = 0;
  page.on("response", async (res) => {
    try {
      const buf = await res.body();
      bundleBytes += buf.length;
    } catch {
      // some responses (redirects, etc) have no body
    }
  });

  try {
    const t0 = performance.now();
    await page.goto(handle.baseUrl, { waitUntil: "networkidle", timeout: 15_000 });
    result.dom_loaded_ms = Math.round(performance.now() - t0);

    // page_rendered: at least one product name from the API appears in the DOM.
    const products = (await (await fetch(`${handle.baseUrl}/api/products`)).json()) as { products: { name: string }[] };
    const sampleName = products.products[0]?.name ?? "";
    if (sampleName) {
      const visible = await page.locator("body").innerText();
      result.page_rendered = visible.includes(sampleName);
    }

    // add_works
    const qtyBefore = await cartTotalQuantity(handle.baseUrl);
    const addBtn = page.locator('[data-testid="add-to-cart"]').first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      // wait up to 3s for cart to grow
      const deadline = performance.now() + 3000;
      while (performance.now() < deadline) {
        if ((await cartTotalQuantity(handle.baseUrl)) > qtyBefore) {
          result.add_works = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    // remove_works
    const qtyBeforeRemove = await cartTotalQuantity(handle.baseUrl);
    if (qtyBeforeRemove > 0) {
      // wait for the remove button to render after the add (the page may need to re-render)
      const removeBtn = page.locator('[data-testid="remove-item"]').first();
      await removeBtn.waitFor({ state: "visible", timeout: 3000 }).catch(() => undefined);
      if (await removeBtn.count() > 0) {
        await removeBtn.click();
        const deadline = performance.now() + 3000;
        while (performance.now() < deadline) {
          if ((await cartTotalQuantity(handle.baseUrl)) < qtyBeforeRemove) {
            result.remove_works = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    }

    result.bundle_bytes = bundleBytes;
    result.frontend_ok = result.page_rendered && result.add_works && result.remove_works;
  } catch {
    // leave defaults — frontend_ok = false
  } finally {
    await browser.close();
  }

  return result;
}
