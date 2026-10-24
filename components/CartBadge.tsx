"use client";
import { useCart } from "@/lib/cart";

export default function CartBadge() {
  const { cart } = useCart();
  const count = cart.itemCount;

  if (count === 0) return null;

  return (
    <span
      key={count} // a new key restarts the pop animation
      aria-label={`${count} ${count === 1 ? "item" : "items"} in your cart`}
      className="pop absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-black ring-2 ring-ink-950"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}