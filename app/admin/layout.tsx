import type { Metadata } from "next";
import { Suspense } from "react";
import AdminShell from "@/components/AdminShell";

export const metadata: Metadata = {
  title: "Admin",
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink-950" aria-hidden="true" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}