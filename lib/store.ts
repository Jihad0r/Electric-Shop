import type { Category } from "@/types/product";

export const STORE_NAME = "VoltTech"; // change to your store's name
export const CURRENCY = "EGP"; // must match your prices

export const CATEGORY_META: Record<Category, { label: string; emoji: string; blurb: string }> = {
  phones: { label: "Phones", emoji: "📱", blurb: "Smartphones for every budget" },
  laptops: { label: "Laptops", emoji: "💻", blurb: "For work, study and play" },
  tablets: { label: "Tablets", emoji: "📲", blurb: "Big screens, light to carry" },
  accessories: { label: "Accessories", emoji: "🎧", blurb: "Chargers, cases and more" },
  others: { label: "Others", emoji: "🛍️", blurb: "Everything else we sell" },
};

export const HERO = {
  badgeTop: "Up to",
  badgeMain: "40% OFF",
  titleTop: "Upgrade Your",
  titleAccent: "Tech Experience",
  text: "Top brands, best prices, and the latest technology all in one place.",
};

export const PERKS = [
  { icon: "truck", title: "Free Shipping", text: "On orders over 2500 EGP" },
  { icon: "lock", title: "Secure Payment", text: "100% secure checkout" },
  { icon: "headset", title: "24/7 Support", text: "We're here to help" },
  { icon: "return", title: "Easy Returns", text: "Within 14 days" },
] as const;

export const OFFER = {
  title: "Limited Time Offer",
  text: "Save up to 40% on selected laptops",
  cta: "Shop Laptops",
  href: "/products?category=laptops",
  badge: "-40%",
};