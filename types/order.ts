export const ORDER_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentMethod = "cod" | "card" | "wallet";

export type OrderItem = {
  // null if the product was deleted after the order was placed
  product: {
    _id: string;
    name: string;
    price: number;
    image?: { url: string };
  } | null;
  quantity: number;
};

export type Order = {
  _id: string;
  orderNumber: string;
  user: { _id: string; name: string; email: string } | null;
  items: OrderItem[];
  shippingAddress: {
    fullName: string;
    phone: string;
    street: string;
    city: string;
    postalCode?: string;
    country: string;
  };
  currency: string;
  itemsPrice: number;
  shippingPrice: number;
  taxPrice: number;
  discountCode?: string;
  discountAmount: number;
  totalPrice: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAt?: string;
  status: OrderStatus;
  createdAt: string;
};

export type OrdersResponse = {
  orders: Order[];
  total: number;
  page: number;
  pages: number;
};