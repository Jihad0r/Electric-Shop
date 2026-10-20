import type { Metadata } from "next";
import CartView from "@/components/CartView";

export const metadata: Metadata = { title: "Your cart" };

export default function CartPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <CartView />
    </main>
  );
}