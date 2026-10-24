import { useEffect, useSyncExternalStore } from "react";

export const MAX_LINE_QTY = 99;

export type CartProblem = "unavailable" | "soldout" | "over";

export type CartLine = {
  key: string; // productId:variantId
  productId: string;
  variantId?: string;
  name: string;
  image?: string;
  label?: string; // for example "16GB / 512GB"
  unit: number; // price now, after any offer
  original?: number;
  quantity: number;
  stock: number;
  problem?: CartProblem;
};

export type CartData = {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  savings: number;
  shipping: number;
  tax: number;
  total: number;
  hasProblem: boolean;
};

export type AddStatus =
  | "added"
  | "partial" // only part of it fitted in stock
  | "soldout"
  | "max" // everything available is already in the cart
  | "unavailable"
  | "full"
  | "invalid"
  | "error";
export type AddResult = { status: AddStatus; added: number };

type State = { loaded: boolean; failed: boolean; busy: number; cart: CartData };

const EMPTY_CART: CartData = {
  lines: [],
  itemCount: 0,
  subtotal: 0,
  savings: 0,
  shipping: 0,
  tax: 0,
  total: 0,
  hasProblem: false,
};

const SERVER_STATE: State = { loaded: false, failed: false, busy: 0, cart: EMPTY_CART };

let state: State = SERVER_STATE;
const listeners = new Set<() => void>();
let counter = 0; // numbers every request
let applied = 0; // the newest request whose answer has been used
let started = false;
let lastStart = 0;
let lastRefresh: Promise<void> | null = null;

function update(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

// An older answer that arrives late must never overwrite a newer one
function apply(requestNumber: number, cart: CartData) {
  if (requestNumber < applied) return;
  applied = requestNumber;
  update({ loaded: true, failed: false, cart });
}

type Answer = { cart?: CartData; result?: AddResult; error?: string };

async function send(method: string, body?: unknown, query = ""): Promise<{ ok: boolean; json: Answer }> {
  const res = await fetch(`/api/cart${query}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Answer;
  return { ok: res.ok, json };
}

async function change(method: string, body?: unknown, query = ""): Promise<Answer | null> {
  const mine = ++counter;
  update({ busy: state.busy + 1 });
  try {
    const { ok, json } = await send(method, body, query);
    if (!ok) return null;
    if (json.cart) apply(mine, json.cart);
    return json;
  } catch {
    return null;
  } finally {
    update({ busy: state.busy - 1 });
  }
}

/* ---------- Actions ---------- */

// Loads the cart again. Call it after logging in or out, so the right cart shows.
// Two calls within a quarter of a second share one request. Anything later starts a new one.
export function refreshCart(): Promise<void> {
  const now = Date.now();
  if (lastRefresh && now - lastStart < 250) return lastRefresh;

  lastStart = now;
  lastRefresh = (async () => {
    const mine = ++counter;
    try {
      const res = await fetch("/api/cart", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      apply(mine, (await res.json()) as CartData);
    } catch {
      if (mine > applied) update({ loaded: true, failed: true });
    }
  })();

  return lastRefresh;
}

export async function addToCart(item: {
  productId: string;
  variantId?: string;
  quantity: number;
}): Promise<AddResult> {
  const answer = await change("POST", item);
  return answer?.result ?? { status: "error", added: 0 };
}

export async function setCartQuantity(key: string, quantity: number) {
  await change("PATCH", { key, quantity });
}

export async function removeFromCart(key: string) {
  await change("DELETE", undefined, `?key=${encodeURIComponent(key)}`);
}

export async function clearCart() {
  await change("DELETE");
}

/* ---------- Reading the cart in components ---------- */

export function subscribeCart(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

const getState = () => state;
const getServerState = () => SERVER_STATE;

function ensureLoaded() {
  if (started) return;
  started = true;

  refreshCart();

  // Keep the cart fresh: coming back to the tab, restoring a page, reconnecting
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshCart();
  });
  window.addEventListener("focus", () => {
    refreshCart();
  });
  window.addEventListener("online", () => {
    refreshCart();
  });
  window.addEventListener("pageshow", (e) => {
    if ((e as PageTransitionEvent).persisted) refreshCart();
  });
}

export function useCart(): State {
  const current = useSyncExternalStore(subscribeCart, getState, getServerState);
  useEffect(() => {
    ensureLoaded();
  }, []);
  return current;
}