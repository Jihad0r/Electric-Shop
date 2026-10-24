"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { refreshCart } from "@/lib/cart";

type Props = {
  className?: string;
  redirectTo?: string;
  onLoggedOut?: () => void;
};

const defaultClass =
  "rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";

export default function LogoutButton({
  className = defaultClass,
  redirectTo = "/login",
  onLoggedOut,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      // The server clears the httpOnly cookie; JavaScript can't do it
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Redirect even if the request failed, so the user isn't stuck on a protected page
      await refreshCart(); // the cart is now the visitor's, not the account's
      onLoggedOut?.();
      router.replace(redirectTo);
      router.refresh();
      setLoading(false);
    }
  };

  return (
    <button type="button" onClick={handleLogout} disabled={loading} className={className}>
      {loading ? "Logging out..." : "Log out"}
    </button>
  );
}