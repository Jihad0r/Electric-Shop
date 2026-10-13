export const CATEGORIES = ["phones", "laptops", "tablets", "accessories", "others"] as const;

export type Category = (typeof CATEGORIES)[number];

export type Product = {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: Category;
  stock: number;
  image?: { url: string; publicId: string };
  isActive: boolean;
  createdAt: string;
};