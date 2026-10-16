import Link from "next/link";

export default function StoreNotFound() {
  return (
    <main className="mx-auto flex min-h-[50dvh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-brand-400">404</p>
      <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Page not found</h1>
      <p className="mt-2 text-slate-400">
        We couldn&apos;t find what you were looking for. It may have been removed.
      </p>
      <Link
        href="/products"
        className="mt-6 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500"
      >
        Browse products
      </Link>
    </main>
  );
}