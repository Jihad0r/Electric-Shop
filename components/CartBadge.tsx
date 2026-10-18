"use client";
import { useSyncExternalStore } from "react";
import { cartSnapshot, countCart, subscribeCart } from "@/lib/cart";

export default function CartBadge() {
  const raw = useSyncExternalStore(subscribeCart, cartSnapshot, () => "[]");
  const count = countCart(raw);

  if (count === 0) return null;

  return (
    <span
      aria-label={`${count} ${count === 1 ? "item" : "items"} in your cart`}
      className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-bold text-white ring-2 ring-ink-950"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}