"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/LogoutButton";
import { STORE_NAME } from "@/lib/store";

type IconName = "grid" | "box" | "receipt" | "card" | "tag" | "store";

const NAV: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: "/admin", label: "Dashboard", icon: "grid", exact: true },
  { href: "/admin/products", label: "Products", icon: "box" },
  { href: "/admin/orders", label: "Orders", icon: "receipt" },
  { href: "/admin/payments", label: "Payments", icon: "card" },
  { href: "/admin/content", label: "Content", icon: "tag" },
];

function NavIcon({ name }: { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "grid" && (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      )}
      {name === "box" && (
        <>
          <path d="M21 8l-9-5-9 5 9 5 9-5z" />
          <path d="M3 8v8l9 5 9-5V8" />
          <path d="M12 13v8" />
        </>
      )}
      {name === "receipt" && (
        <>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
          <path d="M9 8h6M9 12h6" />
        </>
      )}
      {name === "card" && (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18M7 15h3" />
        </>
      )}
      {name === "tag" && (
        <>
          <path d="M20 12l-8 8-9-9V3h8l9 9z" />
          <circle cx="7.5" cy="7.5" r="1.3" />
        </>
      )}
      {name === "store" && (
        <>
          <path d="M4 9l1.5-5h13L20 9" />
          <path d="M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
          <path d="M5 12v8h14v-8" />
        </>
      )}
    </svg>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Admin");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const me: { name?: string } = await res.json();
        if (!cancelled && me.name) setName(me.name);
      } catch {
        // keep the default name
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Close the mobile sidebar with the Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
      active
        ? "bg-brand-600/20 text-white ring-1 ring-brand-500/40"
        : "text-slate-300 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <div className="min-h-dvh bg-ink-950 lg:flex">
      {/* Dark backdrop behind the sidebar on phones */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: slides in on phones, fixed on large screens */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 bg-ink-900 transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:translate-x-0 lg:self-start ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
          <Logo className="h-6 w-6 text-brand-400" />
          <span className="font-bold text-white">{STORE_NAME}</span>
          <span className="text-xs text-slate-400">Admin</span>
        </div>

        <nav aria-label="Admin" className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={linkClass(active)}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link href="/" onClick={() => setOpen(false)} className={linkClass(false)}>
            <NavIcon name="store" />
            View store
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-ink-950/90 px-3 backdrop-blur sm:px-5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-slate-200 transition hover:bg-white/10 lg:hidden"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="hidden text-sm text-slate-400 lg:block">Admin panel</span>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                {name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-[10rem] truncate text-sm text-slate-200 sm:block">
                {name}
              </span>
            </div>
            <LogoutButton className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60" />
          </div>
        </header>

        {/* White content panel. Your admin pages sit inside it */}
        <div className="flex-1 p-3 sm:p-5">
          <div className="min-h-[70dvh] rounded-2xl bg-white text-gray-900 shadow-xl shadow-black/30">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}