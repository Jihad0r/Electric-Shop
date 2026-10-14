import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { CURRENCY } from "@/lib/store";
import type { Category } from "@/types/product";

export type ProductSummary = {
  _id: string;
  name: string;
  price: number;
  category: Category;
  stock: number;
  image?: string;
};

export default function ProductCard({ product }: { product: ProductSummary }) {
  const soldOut = product.stock === 0;

  return (
    <Link
      href={`/products/${product._id}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200 transition hover:shadow-md"
    >
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
        {soldOut && (
          <span className="absolute left-2 top-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
            Sold out
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <p className="text-xs capitalize text-gray-500">{product.category}</p>
        <h3 className="mt-1 line-clamp-2 text-sm font-medium text-gray-900">{product.name}</h3>
        <p className="mt-auto pt-2 font-semibold text-gray-900">
          {formatMoney(product.price, CURRENCY)}
        </p>
      </div>
    </Link>
  );
}