import type { Metadata } from "next";
import { Suspense } from "react";
import OrderConfirmation from "@/components/OrderConfirmation";

export const metadata: Metadata = { title: "Your order" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderConfirmation orderId={id} />;
}

export default function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Suspense fallback={<p className="text-slate-400">Loading your order...</p>}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}