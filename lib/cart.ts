export type CartItem = {
  key: string; // productId:variantId
  productId: string;
  variantId?: string;
  name: string;
  image?: string;
  label?: string; // e.g. "16GB / 512GB"
  price: number; // for display only, the server re-checks prices at checkout
  quantity: number;
  stock?: number; // stock known when the item was added
};

const STORAGE_KEY = "cart";
export const MAX_LINE_QTY = 99;
export const CART_EVENT = "cart:changed";

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.key === "string" &&
    typeof v.productId === "string" &&
    typeof v.name === "string" &&
    typeof v.price === "number" &&
    typeof v.quantity === "number" &&
    v.quantity >= 1
  );
}

// Turns the saved text into cart items, dropping anything that looks broken
export function parseCart(raw: string): CartItem[] {
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

export function readCart(): CartItem[] {
  try {
    return parseCart(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage full or blocked: the cart just won't persist
  }
  window.dispatchEvent(new Event(CART_EVENT));
}

export type AddResult =
  | { status: "added"; added: number; inCart: number }
  | { status: "partial"; added: number; inCart: number } // only part of it fit
  | { status: "soldout"; added: 0; inCart: number }
  | { status: "max"; added: 0; inCart: number }; // all available stock is already in the cart

// `stock` is how many are available. The cart can never hold more than that.
export function addToCart(item: Omit<CartItem, "key" | "stock">, stock: number): AddResult {
  const key = `${item.productId}:${item.variantId ?? ""}`;
  const items = readCart();
  const existing = items.find((i) => i.key === key);
  const inCart = existing?.quantity ?? 0;

  const limit = Math.min(Math.floor(stock) || 0, MAX_LINE_QTY);
  if (limit <= 0) return { status: "soldout", added: 0, inCart };

  const room = limit - inCart;
  if (room <= 0) return { status: "max", added: 0, inCart };

  const added = Math.min(item.quantity, room);

  if (existing) {
    existing.quantity += added;
    existing.price = item.price; // keep the latest price
    existing.stock = limit;
  } else {
    items.push({ ...item, quantity: added, key, stock: limit });
  }

  writeCart(items);
  return {
    status: added < item.quantity ? "partial" : "added",
    added,
    inCart: inCart + added,
  };
}

export function setQuantity(key: string, quantity: number) {
  const q = Math.max(1, Math.min(Math.floor(quantity) || 1, MAX_LINE_QTY));
  writeCart(readCart().map((i) => (i.key === key ? { ...i, quantity: q } : i)));
}

export function removeFromCart(key: string) {
  writeCart(readCart().filter((i) => i.key !== key));
}

export function clearCart() {
  writeCart([]);
}

/* Helpers for reading the cart in components (used with useSyncExternalStore) */

export function subscribeCart(callback: () => void) {
  window.addEventListener(CART_EVENT, callback);
  window.addEventListener("storage", callback); // changes made in another tab
  return () => {
    window.removeEventListener(CART_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function cartSnapshot(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function countCart(raw: string): number {
  return parseCart(raw).reduce((sum, i) => sum + i.quantity, 0);
}