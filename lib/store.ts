import type { Category } from "@/types/product";

export const STORE_NAME = "TechStore"; // change to your store's name
export const CURRENCY = "EGP"; // must match your prices

export const CATEGORY_META: Record<Category, { label: string; emoji: string; blurb: string }> = {
  phones: { label: "Phones", emoji: "📱", blurb: "Smartphones for every budget" },
  laptops: { label: "Laptops", emoji: "💻", blurb: "For work, study and play" },
  tablets: { label: "Tablets", emoji: "📲", blurb: "Big screens, light to carry" },
  accessories: { label: "Accessories", emoji: "🎧", blurb: "Chargers, cases and more" },
  others: { label: "Others", emoji: "🛍️", blurb: "Everything else we sell" },
};