import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { cartSnapshot, parseCart, subscribeCart, type CartItem } from "@/lib/cart";
import { TAX_RATE, shippingFor } from "@/lib/shipping";

type LineInfo = {
  available: boolean;
  name?: string;
  image?: string;
  label?: string;
  price?: number;
  originalPrice?: number;
  stock?: number;
};

export type PricedRow = {
  item: CartItem;
  name: string;
  image?: string;
  label?: string;
  unit: number;
  original?: number;
  problem?: string;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const noopSubscribe = () => () => {};

export function useCartPricing() {
  // false on the server, true once the browser has loaded the saved cart
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const raw = useSyncExternalStore(subscribeCart, cartSnapshot, () => "[]");
  const items = useMemo(() => parseCart(raw), [raw]);

  const [info, setInfo] = useState<Record<string, LineInfo>>({});
  const [failed, setFailed] = useState(false);

  // Lines not checked against the database yet
  const missingSig = items
    .filter((i) => !info[i.key])
    .map((i) => i.key)
    .join("|");
  const checking = missingSig !== "" && !failed;

  useEffect(() => {
    if (!missingSig || failed) return;

    const controller = new AbortController();
    const keys = missingSig.split("|");
    const lines = keys.map((key) => {
      const [productId, variantId] = key.split(":");
      return { productId, variantId: variantId || undefined };
    });

    (async () => {
      try {
        const res = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: lines }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed");

        const data: { items: Record<string, LineInfo> } = await res.json();
        const next: Record<string, LineInfo> = {};
        for (const key of keys) next[key] = data.items[key] ?? { available: false };
        setInfo((prev) => ({ ...prev, ...next }));
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    })();

    return () => controller.abort();
  }, [missingSig, failed]);

  const rows: PricedRow[] = useMemo(
    () =>
      items.map((item) => {
        const live = info[item.key];

        if (live && !live.available) {
          return {
            item,
            name: item.name,
            image: item.image,
            label: item.label,
            unit: item.price,
            problem: "No longer available",
          };
        }

        const stock = live?.stock;
        let problem: string | undefined;
        if (stock !== undefined) {
          if (stock <= 0) problem = "Out of stock";
          else if (item.quantity > stock) problem = `Only ${stock} left`;
        }

        return {
          item,
          name: live?.name ?? item.name,
          image: live?.image || item.image,
          label: live?.label ?? item.label,
          unit: live?.price ?? item.price,
          original: live?.originalPrice,
          problem,
        };
      }),
    [items, info]
  );

  const good = rows.filter((r) => !r.problem);
  const subtotal = round2(good.reduce((sum, r) => sum + r.unit * r.item.quantity, 0));
  const savings = round2(
    good.reduce((sum, r) => sum + (r.original ? (r.original - r.unit) * r.item.quantity : 0), 0)
  );
  const shipping = good.length > 0 ? shippingFor(subtotal) : 0;
  const tax = round2(subtotal * TAX_RATE);
  const total = round2(subtotal + shipping + tax);

  return {
    hydrated,
    items,
    rows,
    checking,
    failed,
    hasProblem: rows.some((r) => r.problem),
    subtotal,
    savings,
    shipping,
    tax,
    total,
  };
}