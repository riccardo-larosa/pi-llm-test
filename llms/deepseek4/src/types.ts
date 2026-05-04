export interface Product {
  id: string;
  name: string;
  priceCents: number;
  /** Internal DB column name */
  price_cents: number;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  priceCents: number;
  /** Internal DB column name */
  product_id: string;
  price_cents: number;
}
