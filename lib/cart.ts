export type CartItem = {
  key: string; // productId:variantId
  productId: string;
  variantId?: string;
  name: string;
  image?: string;
  label?: string; // e.g. "16GB / 512GB"
  price: number; // for display only, the server re-checks prices at checkout
  quantity: number;
};

const STORAGE_KEY = "cart";
const MAX_LINE_QTY = 99;
export const CART_EVENT = "cart:changed";

export function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? (data as CartItem[]) : [];
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

export function addToCart(item: Omit<CartItem, "key">): CartItem[] {
  const key = `${item.productId}:${item.variantId ?? ""}`;
  const items = readCart();
  const existing = items.find((i) => i.key === key);

  if (existing) {
    existing.quantity = Math.min(existing.quantity + item.quantity, MAX_LINE_QTY);
    existing.price = item.price; // keep the latest price
  } else {
    items.push({ ...item, key });
  }

  writeCart(items);
  return items;
}

/* Helpers for showing the cart count (used with useSyncExternalStore) */

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
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return 0;
    return (data as CartItem[]).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  } catch {
    return 0;
  }
}