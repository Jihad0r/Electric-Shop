"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { refreshCart } from "@/lib/cart";

export default function CartSync() {
  const pathname = usePathname();

  useEffect(() => {
    refreshCart();
  }, [pathname]);

  return null;
}