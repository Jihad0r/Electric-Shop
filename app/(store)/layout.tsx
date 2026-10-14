import StoreNav from "@/components/StoreNav";
import StoreFooter from "@/components/StoreFooter";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <StoreNav />
      <div className="flex-1">{children}</div>
      <StoreFooter />
    </div>
  );
}