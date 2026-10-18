import Link from "next/link";
import Logo from "@/components/Logo";
import { CATEGORY_META, STORE_NAME } from "@/lib/store";
import { CATEGORIES } from "@/types/product";

export default function StoreFooter() {
  return (
    <footer className="mt-12 border-t border-white/10 bg-black">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <Logo className="h-6 w-6 text-brand-400" />
            <span className="text-lg font-bold text-white">{STORE_NAME}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-slate-400">
            Phones, laptops, tablets and accessories, all in one place.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Shop</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li>
              <Link href="/products" className="transition hover:text-white">
                All products
              </Link>
            </li>
            {CATEGORIES.map((c) => (
              <li key={c}>
                <Link href={`/${c}`} className="transition hover:text-white">
                  {CATEGORY_META[c].label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Account</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li>
              <Link href="/login" className="transition hover:text-white">
                Log in
              </Link>
            </li>
            <li>
              <Link href="/signup" className="transition hover:text-white">
                Create an account
              </Link>
            </li>
            <li>
              <Link href="/account/orders" className="transition hover:text-white">
                My orders
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-slate-500">
        &copy; Jihad Orabi. All rights reserved.
      </div>
    </footer>
  );
}