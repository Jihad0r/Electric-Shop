import { loadShopProducts } from "@/lib/catalog";
import { isCategory } from "@/types/product";
import { NextResponse } from "next/server";

const SORTS = ["newest", "price-asc", "price-desc"];

const toNumber = (v) => {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

// GET /api/shop?category=laptops&sort=price-asc&page=2
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const category = searchParams.get("category") ?? "";
  const sort = searchParams.get("sort") ?? "";
  const search = (searchParams.get("search") ?? "").trim().slice(0, 60);

  const result = await loadShopProducts({
    category: isCategory(category) ? category : undefined,
    search: search || undefined,
    min: toNumber(searchParams.get("min")),
    max: toNumber(searchParams.get("max")),
    sort: SORTS.includes(sort) ? sort : "newest",
    page: Math.max(1, Math.floor(Number(searchParams.get("page"))) || 1),
  });

  return NextResponse.json(result);
}