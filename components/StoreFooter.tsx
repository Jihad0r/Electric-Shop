import Link from "next/link";
import { CATEGORY_META, STORE_NAME } from "@/lib/store";
import { CATEGORIES } from "@/types/product";

export default function StoreFooter() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:px-8">
        <div>
          <p className="text-lg font-bold text-gray-900">{STORE_NAME}</p>
          <p className="mt-2 max-w-xs text-sm text-gray-500">
            Phones, laptops, tablets and accessories, all in one place.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-900">Shop</p>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>
              <Link href="/products" className="hover:text-blue-600">
                All products
              </Link>
            </li>
            {CATEGORIES.map((c) => (
              <li key={c}>
                <Link href={`/products?category=${c}`} className="hover:text-blue-600">
                  {CATEGORY_META[c].label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-900">Account</p>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>
              <Link href="/login" className="hover:text-blue-600">
                Log in
              </Link>
            </li>
            <li>
              <Link href="/signup" className="hover:text-blue-600">
                Create an account
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-200 px-4 py-4 text-center text-xs text-gray-500">
        &copy; {STORE_NAME}. All rights reserved.
      </div>
    </footer>
  );
}