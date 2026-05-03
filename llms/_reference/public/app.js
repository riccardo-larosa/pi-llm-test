const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok && res.status !== 204) throw new Error(`${url} ${res.status}`);
  return res.status === 204 ? null : res.json();
}

async function loadProducts() {
  const data = await fetchJSON("/api/products");
  const ul = document.getElementById("products");
  ul.innerHTML = "";
  for (const p of data.products) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${p.name} — ${fmt(p.priceCents)}`;
    const btn = document.createElement("button");
    btn.textContent = "Add to cart";
    btn.dataset.testid = "add-to-cart";
    btn.addEventListener("click", async () => {
      await fetchJSON("/api/cart/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: p.id, quantity: 1 }),
      });
      await loadCart();
    });
    li.appendChild(label);
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

async function loadCart() {
  const data = await fetchJSON("/api/cart");
  const ul = document.getElementById("cart");
  const empty = document.getElementById("empty");
  ul.innerHTML = "";
  empty.hidden = data.items.length > 0;
  for (const item of data.items) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${item.name} × ${item.quantity} — ${fmt(item.priceCents * item.quantity)}`;
    const btn = document.createElement("button");
    btn.textContent = "Remove";
    btn.dataset.testid = "remove-item";
    btn.addEventListener("click", async () => {
      await fetchJSON(`/api/cart/items/${item.id}`, { method: "DELETE" });
      await loadCart();
    });
    li.appendChild(label);
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

await loadProducts();
await loadCart();
