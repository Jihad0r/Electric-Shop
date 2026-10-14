import type { Metadata } from "next";
import AdminNav from "@/components/AdminNav";

export const metadata: Metadata = {
  title: "Admin",
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-dvh bg-gray-50">
      <AdminNav />
      {children}
    </div>
  );
}