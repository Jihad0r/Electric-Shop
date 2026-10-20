import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import CheckoutForm from "@/components/CheckoutForm";
import { availableMethods } from "@/lib/paymob";
import type { PaymentMethod } from "@/types/order";

export const metadata: Metadata = { title: "Checkout" };

async function Checkout() {
  await connection(); // read the payment settings on every visit
  return <CheckoutForm methods={availableMethods() as PaymentMethod[]} />;
}

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Suspense fallback={<p className="text-slate-400">Loading checkout...</p>}>
        <Checkout />
      </Suspense>
    </main>
  );
}