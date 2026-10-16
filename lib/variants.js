import mongoose from "mongoose";

function parseList(raw) {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

// Returns { options, variants } or { error }
export function readVariants(formData) {
  const rawOptions = parseList(formData.get("options"));
  const rawVariants = parseList(formData.get("variants"));

  if (rawOptions === null || rawVariants === null) {
    return { error: "Invalid options or variants" };
  }

  const options = rawOptions.map((o) => ({
    name: String(o?.name ?? "").trim(),
    values: [...new Set((Array.isArray(o?.values) ? o.values : []).map((v) => String(v).trim()).filter(Boolean))],
  }));

  const variants = rawVariants.map((v) => ({
    // Keeping the _id of existing variants stops old orders losing their link
    ...(v?._id && mongoose.Types.ObjectId.isValid(v._id) ? { _id: v._id } : {}),
    selections: (Array.isArray(v?.selections) ? v.selections : []).map((s) => ({
      name: String(s?.name ?? "").trim(),
      value: String(s?.value ?? "").trim(),
    })),
    price: Number(v?.price),
    stock: Number(v?.stock ?? 0),
  }));

  return { options, variants };
}