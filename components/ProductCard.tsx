import Image from "next/image";
import Link from "next/link";
import AddToCartButton from "@/components/AddToCartButton";
import { formatMoney } from "@/lib/format";
import { CURRENCY } from "@/lib/store";
import type { ProductSummary } from "@/types/product";

export default function ProductCard({ product }: { product: ProductSummary }) {
  const soldOut = product.stock === 0;
  const href = `/products/${product._id}`;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl bg-white text-gray-900 shadow-lg shadow-black/20 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:shadow-xl">
      {/* Image, name and price all open the product page */}
      <Link href={href} className="flex flex-1 flex-col">
        <div className="relative aspect-square bg-gray-50">
          {product.image && (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 25vw, 50vw"
              className="object-contain p-4 transition duration-300 group-hover:scale-105"
            />
          )}
          {product.discountPercent !== undefined && (
            <span className="absolute left-2 top-2 rounded-md bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">
              -{product.discountPercent}%
            </span>
          )}
          {soldOut && (
            <span className="absolute right-2 top-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
              Sold out
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3 pb-2">
          <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">{product.name}</h3>
          <p className="mt-0.5 text-xs capitalize text-gray-500">{product.category}</p>

          <div className="mt-auto pt-3">
            <p className="text-base font-bold text-gray-900">
              {product.hasOptions && (
                <span className="mr-1 text-xs font-normal text-gray-500">From</span>
              )}
              {formatMoney(product.price, CURRENCY)}
            </p>
            {product.originalPrice !== undefined && (
              <p className="text-xs text-gray-400 line-through">
                {formatMoney(product.originalPrice, CURRENCY)}
              </p>
            )}
          </div>
        </div>
      </Link>

      {/* View more + cart icon */}
      <div className="flex gap-2 px-3 pb-3">
        <Link
          href={href}
          className="flex-1 rounded-md bg-brand-600 py-2 text-center text-xs font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          View more
        </Link>
        <AddToCartButton product={product} />
      </div>
    </article>
  );
}