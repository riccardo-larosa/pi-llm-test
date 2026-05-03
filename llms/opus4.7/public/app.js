const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

async function loadProducts() {
  const { products } = await api("/api/products");
  const ul = document.getElementById("products");
  ul.innerHTML = "";
  for (const p of products) {
    const li = document.createElement("li");
    li.className = "product";
    li.innerHTML = `
      <div class="name"></div>
      <div class="price"></div>
      <button data-testid="add-to-cart">Add to cart</button>
    `;
    li.querySelector(".name").textContent = p.name;
    li.querySelector(".price").textContent = fmt(p.priceCents);
    li.querySelector("button").addEventListener("click", () => addToCart(p.id));
    ul.appendChild(li);
  }
}

async function loadCart() {
  const { items } = await api("/api/cart");
  const ul = document.getElementById("cart");
  const empty = document.getElementById("cart-empty");
  const totalEl = document.getElementById("cart-total");
  ul.innerHTML = "";

  if (items.length === 0) {
    empty.hidden = false;
    totalEl.textContent = "";
    return;
  }
  empty.hidden = true;

  let total = 0;
  for (const it of items) {
    total += it.priceCents * it.quantity;
    const li = document.createElement("li");
    li.className = "cart-item";
    li.innerHTML = `
      <div>
        <div class="name"></div>
        <div class="line"></div>
      </div>
      <div class="qty">
        <input type="number" min="1" step="1" />
        <button class="secondary update">Update</button>
        <button data-testid="remove-item">Remove</button>
      </div>
    `;
    li.querySelector(".name").textContent = it.name;
    li.querySelector(".line").textContent = `${fmt(it.priceCents)} × ${it.quantity} = ${fmt(it.priceCents * it.quantity)}`;
    const input = li.querySelector("input");
    input.value = String(it.quantity);
    li.querySelector(".update").addEventListener("click", () => {
      const q = parseInt(input.value, 10);
      if (Number.isInteger(q) && q > 0) updateQty(it.id, q);
    });
    li.querySelector('[data-testid="remove-item"]').addEventListener("click", () => removeItem(it.id));
    ul.appendChild(li);
  }
  totalEl.textContent = `Total: ${fmt(total)}`;
}

async function addToCart(productId) {
  await api("/api/cart/items", {
    method: "POST",
    body: JSON.stringify({ productId, quantity: 1 }),
  });
  await loadCart();
}

async function updateQty(id, quantity) {
  await api(`/api/cart/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
  await loadCart();
}

async function removeItem(id) {
  await api(`/api/cart/items/${id}`, { method: "DELETE" });
  await loadCart();
}

(async function init() {
  try {
    await loadProducts();
    await loadCart();
  } catch (e) {
    console.error(e);
  }
})();
