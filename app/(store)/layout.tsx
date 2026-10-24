import { Suspense } from "react";
import CartSync from "@/components/CartSync";
import StoreNav from "@/components/StoreNav";
import StoreFooter from "@/components/StoreFooter";

// Same height as the real bar (h-16), so nothing jumps when the nav streams in
function NavFallback() {
  return (
    <header
      className="sticky top-0 z-40 h-16 border-b border-white/10 bg-ink-950"
      aria-hidden="true"
    />
  );
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      {/* Reloads the cart on every page change, so it is always up to date */}
      <Suspense fallback={null}>
        <CartSync />
      </Suspense>

      <Suspense fallback={<NavFallback />}>
        <StoreNav />
      </Suspense>

      {/* theme-paper = the white page (see globals.css). Remove it to get a black page */}
      <div className="theme-paper min-w-0 flex-1">{children}</div>

      <StoreFooter />
    </div>
  );
}