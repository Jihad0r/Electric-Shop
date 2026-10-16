"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OfferModal from "@/components/OfferModal";
import { formatDate, formatMoney } from "@/lib/format";
import { CURRENCY } from "@/lib/store";
import { offerState, type Offer, type OfferState } from "@/types/offer";
import type { Product } from "@/types/product";
import HeroSlidesManager from "@/components/HeroSlidesManager";

type Status = "loading" | "ready" | "denied" | "error";
type ModalState = { offer?: Offer } | null; // {} = new offer

const STATE_STYLES: Record<OfferState, string> = {
  active: "bg-green-50 text-green-700",
  scheduled: "bg-blue-50 text-blue-700",
  expired: "bg-gray-100 text-gray-600",
  paused: "bg-amber-50 text-amber-700",
};

function discountText(o: Offer): string {
  return o.discountType === "percent"
    ? `${o.discountValue}% off`
    : `${formatMoney(o.discountValue, CURRENCY)} off`;
}

export default function AdminContentPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [offersRes, productsRes] = await Promise.all([
          fetch("/api/offers"),
          fetch("/api/products"),
        ]);

        if (offersRes.status === 401) {
          router.replace("/login");
          return;
        }
        if (offersRes.status === 403) {
          if (!cancelled) setStatus("denied");
          return;
        }
        if (!offersRes.ok || !productsRes.ok) throw new Error("Failed to load");

        const offersData: Offer[] = await offersRes.json();
        const productsData: Product[] = await productsRes.json();

        if (!cancelled) {
          setOffers(offersData);
          setProducts(productsData);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSaved = (saved: Offer) =>
    setOffers((prev) =>
      prev.some((o) => o._id === saved._id)
        ? prev.map((o) => (o._id === saved._id ? saved : o))
        : [saved, ...prev]
    );

  const toggleActive = async (offer: Offer) => {
    setActionError("");
    setBusyId(offer._id);
    try {
      const res = await fetch(`/api/offers/${offer._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !offer.isActive }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error || "Could not update the offer");
        return;
      }
      handleSaved(json as Offer);
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (offer: Offer) => {
    if (!window.confirm(`Delete the offer "${offer.title}"? This cannot be undone.`)) return;

    setActionError("");
    setBusyId(offer._id);
    try {
      const res = await fetch(`/api/offers/${offer._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error || "Could not delete the offer");
        return;
      }
      setOffers((prev) => prev.filter((o) => o._id !== offer._id));
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  if (status === "loading") return <p className="p-6 text-gray-500 sm:p-8">Loading...</p>;

  if (status === "denied") {
    return (
      <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Access denied</h1>
        <p className="text-gray-500">You need an admin account to view this page.</p>
        <Link href="/" className="font-medium text-blue-600 hover:underline">
          Back to home
        </Link>
      </main>
    );
  }

  if (status === "error") {
    return <p className="p-6 text-red-600 sm:p-8">Something went wrong. Please refresh the page.</p>;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Content</h1>
          <p className="text-sm text-gray-500">
            Offers appear on your home page as a row of products, and the discount is applied at
            checkout.
          </p>
        </div>
        <button
          onClick={() => setModal({})}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
        >
          + New offer
        </button>
      </div>
      <HeroSlidesManager />

      <h2 className="mt-10 text-lg font-bold text-gray-900">Offers</h2>
      {actionError && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {actionError}
        </p>
      )}

      {offers.length === 0 ? (
        <div className="mt-6 rounded-xl bg-gray-50 px-4 py-12 text-center">
          <p className="font-medium text-gray-900">No offers yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Create your first offer to show discounted products on the home page.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {offers.map((o) => {
            const state = offerState(o);
            const busy = busyId === o._id;
            return (
              <li key={o._id} className="flex flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-gray-900">{o.title}</h2>
                    {o.description && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{o.description}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATE_STYLES[state]}`}
                  >
                    {state}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-gray-500">Discount</dt>
                    <dd className="font-medium text-gray-900">{discountText(o)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Applies to</dt>
                    <dd className="text-gray-900">
                      {o.applyToAll
                        ? "All products"
                        : `${o.products.length} ${o.products.length === 1 ? "product" : "products"}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Starts</dt>
                    <dd className="text-gray-900">{o.startsAt ? formatDate(o.startsAt) : "Right away"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Ends</dt>
                    <dd className="text-gray-900">{o.endsAt ? formatDate(o.endsAt) : "No end date"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-gray-500">Home page</dt>
                    <dd className="text-gray-900">{o.showOnHome ? "Shown as a row" : "Not shown"}</dd>
                  </div>
                </dl>

                <div className="mt-4 grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => setModal({ offer: o })}
                    disabled={busy}
                    className="rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleActive(o)}
                    disabled={busy}
                    className="rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    {o.isActive ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => handleDelete(o)}
                    disabled={busy}
                    className="rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modal && (
        <OfferModal
          key={modal.offer?._id ?? "new"}
          offer={modal.offer}
          products={products}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </main>
  );
}