import { useCart, type CartProblem } from "@/lib/cart";

export type PricedRow = {
  item: { key: string; productId: string; variantId?: string; quantity: number };
  name: string;
  image?: string;
  label?: string;
  unit: number;
  original?: number;
  problem?: string;
};

const PROBLEM_TEXT: Record<CartProblem, (stock: number) => string> = {
  unavailable: () => "No longer available",
  soldout: () => "Out of stock",
  over: (stock) => `Only ${stock} left`,
};

export function useCartPricing() {
  const { loaded, failed, cart } = useCart();

  const rows: PricedRow[] = cart.lines.map((l) => ({
    item: { key: l.key, productId: l.productId, variantId: l.variantId, quantity: l.quantity },
    name: l.name,
    image: l.image,
    label: l.label,
    unit: l.unit,
    original: l.original,
    problem: l.problem ? PROBLEM_TEXT[l.problem](l.stock) : undefined,
  }));

  return {
    hydrated: loaded,
    items: rows.map((r) => r.item),
    rows,
    checking: !loaded,
    failed,
    hasProblem: cart.hasProblem,
    subtotal: cart.subtotal,
    savings: cart.savings,
    shipping: cart.shipping,
    tax: cart.tax,
    total: cart.total,
  };
}