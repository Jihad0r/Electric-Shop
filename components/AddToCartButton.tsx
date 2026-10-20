"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ProductSummary } from "@/types/product";
import { addToCart } from "@/lib/cart";
type Status = "idle" | "added" | "max";

const buttonClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

function CartIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M3 4h2.5l2.2 11h10.6L21 8H6.2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export default function AddToCartButton({ product }: { product: ProductSummary }) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Products with options (RAM, storage...) need a choice first, so the icon opens the product page
  if (product.hasOptions) {
    return (
      <Link
        href={`/products/${product._id}`}
        aria-label={`Choose options for ${product.name}`}
        title="Choose options"
        className={`${buttonClass} border-gray-300 text-gray-700 hover:border-brand-500 hover:bg-blue-50 hover:text-brand-600`}
      >
        <CartIcon />
      </Link>
    );
  }

  const soldOut = product.stock === 0;

  const flash = (next: Status) => {
    setStatus(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 2000);
  };

 
  const handleClick = () => {
    if (soldOut) return;

    const result = addToCart(
      {
        productId: product._id,
        name: product.name,
        image: product.image,
        price: product.price,
        quantity: 1,
      },
      product.stock
    );

    flash(result.status === "added" || result.status === "partial" ? "added" : "max");
  };
  const stateClass = soldOut
    ? "cursor-not-allowed border-gray-200 text-gray-300"
    : status === "added"
      ? "border-green-600 bg-green-600 text-white"
      : status === "max"
        ? "border-amber-400 text-amber-600"
        : "border-gray-300 text-gray-700 hover:border-brand-500 hover:bg-blue-50 hover:text-brand-600";

  const label = soldOut
    ? "Sold out"
    : status === "added"
      ? `${product.name} added to cart`
      : status === "max"
        ? "All available stock is already in your cart"
        : `Add ${product.name} to cart`;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={soldOut}
        aria-label={label}
        title={soldOut ? "Sold out" : status === "max" ? "Maximum in cart" : "Add to cart"}
        className={`${buttonClass} ${stateClass}`}
      >
        {status === "added" ? <CheckIcon /> : <CartIcon />}
      </button>
      <span role="status" className="sr-only">
        {status === "added" ? "Added to cart" : status === "max" ? "Maximum already in cart" : ""}
      </span>
    </>
  );
}