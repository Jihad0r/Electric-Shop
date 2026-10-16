export const CATEGORIES = ["phones", "laptops", "tablets", "accessories", "others"] as const;

export type Category = (typeof CATEGORIES)[number];

export type ProductOption = { name: string; values: string[] };

export type VariantSelection = { name: string; value: string };

export type ProductVariant = {
  _id?: string;
  selections: VariantSelection[];
  price: number;
  stock: number;
};

export type Product = {
  _id: string;
  name: string;
  description: string;
  price: number; // lowest variant price when the product has options
  category: Category;
  stock: number; // total of all variants when the product has options
  image?: { url: string; publicId: string };
  isActive: boolean;
  createdAt: string;
  options?: ProductOption[];
  variants?: ProductVariant[];
};
// What the store pages need to show a product card
export type ProductSummary = {
  _id: string;
  name: string;
  price: number; // price after any active offer
  originalPrice?: number; // set only when an offer applies
  discountPercent?: number;
  category: Category;
  stock: number;
  image?: string;
  hasOptions: boolean;
};