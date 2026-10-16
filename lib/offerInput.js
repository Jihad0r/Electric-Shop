import mongoose from "mongoose";

function toDate(value) {
  if (value === null || value === undefined || value === "") return { value: null };
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? { error: true } : { value: date };
}

// Keeps only the allowed fields. Returns { data } or { error }.
export function readOffer(body) {
  if (!body || typeof body !== "object") return { error: "Invalid request" };

  const starts = toDate(body.startsAt);
  const ends = toDate(body.endsAt);
  if (starts.error || ends.error) return { error: "Invalid date" };

  const products = Array.isArray(body.products)
    ? body.products.filter((id) => mongoose.Types.ObjectId.isValid(id))
    : [];

  return {
    data: {
      title: body.title,
      description: body.description ?? "",
      discountType: body.discountType === "fixed" ? "fixed" : "percent",
      discountValue: Number(body.discountValue),
      applyToAll: Boolean(body.applyToAll),
      products,
      startsAt: starts.value,
      endsAt: ends.value,
      isActive: body.isActive !== false,
      showOnHome: body.showOnHome !== false,
    },
  };
}