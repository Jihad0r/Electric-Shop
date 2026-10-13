import type { Metadata } from "next";


export const metadata: Metadata = {
  title: "Admin",
};

export default function RootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html
      lang="en"
    >
        
      <body className="min-h-full flex flex-col"><h1>Admin Dashboard</h1>
        <ul>
          <li>Overview</li>
          <li>Products</li>
          <li>Orders</li>
          <li>Content</li>
        </ul>{children}</body>
    </html>
  );
}
