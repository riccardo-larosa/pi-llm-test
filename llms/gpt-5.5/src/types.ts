export type Product = {
  id: string;
  name: string;
  priceCents: number;
};

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  priceCents: number;
};
