import type {
  Product,
  ProductOption,
  ProductVariant,
  VariantSelection,
} from "@/types/product";

export const MAX_OPTIONS = 3;
export const MAX_VALUES = 10;
export const MAX_COMBINATIONS = 50;

export type OptionDraft = { name: string; valuesText: string };
export type RowDraft = { price: string; stock: string; offered: boolean; _id?: string };
export type VariantsDraft = { options: OptionDraft[]; rows: Record<string, RowDraft> };
export type Combo = { key: string; label: string; selections: VariantSelection[] };

export type PayloadResult =
  | { options: ProductOption[]; variants: ProductVariant[] }
  | { error: string };

export const DEFAULT_ROW: RowDraft = { price: "", stock: "0", offered: true };

// "8GB, 16GB, 8gb" -> ["8GB", "16GB"]
export function parseValues(text: string): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const raw of text.split(",")) {
    const value = raw.trim();
    if (value && !seen.has(value.toLowerCase())) {
      seen.add(value.toLowerCase());
      values.push(value);
    }
  }
  return values;
}

// Every combination of the option values, e.g. 3 RAM x 2 Storage = 6
export function buildCombos(options: OptionDraft[]): Combo[] {
  const active = options
    .map((o) => ({ name: o.name.trim(), values: parseValues(o.valuesText).slice(0, MAX_VALUES) }))
    .filter((o) => o.name && o.values.length > 0);

  if (active.length === 0) return [];

  let combos: VariantSelection[][] = [[]];
  for (const option of active) {
    combos = combos.flatMap((combo) =>
      option.values.map((value) => [...combo, { name: option.name, value }])
    );
  }

  return combos.map((selections) => ({
    key: JSON.stringify(selections.map((s) => s.value)),
    label: selections.map((s) => s.value).join(" / "),
    selections,
  }));
}

// Fills the form from an existing product
export function draftFromProduct(product?: Product): VariantsDraft {
  if (!product?.options || product.options.length === 0) {
    return { options: [], rows: {} };
  }

  const options: OptionDraft[] = product.options.map((o) => ({
    name: o.name,
    valuesText: o.values.join(", "),
  }));

  const rows: Record<string, RowDraft> = {};

  // Combinations that exist as options but were never offered start switched off
  for (const combo of buildCombos(options)) {
    rows[combo.key] = { price: "", stock: "0", offered: false };
  }

  for (const variant of product.variants ?? []) {
    const values = product.options.map(
      (o) => variant.selections.find((s) => s.name === o.name)?.value ?? ""
    );
    rows[JSON.stringify(values)] = {
      price: String(variant.price),
      stock: String(variant.stock),
      offered: true,
      _id: variant._id,
    };
  }

  return { options, rows };
}

// Checks the form and builds what the API expects
export function buildPayload(draft: VariantsDraft): PayloadResult {
  const filled = draft.options.filter((o) => o.name.trim() || o.valuesText.trim());
  if (filled.length === 0) return { options: [], variants: [] };

  for (const option of filled) {
    const name = option.name.trim();
    const values = parseValues(option.valuesText);
    if (!name) return { error: "Give every option a name, for example RAM" };
    if (values.length === 0) return { error: `Add at least one value for "${name}"` };
    if (values.length > MAX_VALUES) {
      return { error: `"${name}" can have at most ${MAX_VALUES} values` };
    }
  }

  const names = filled.map((o) => o.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) {
    return { error: "Each option needs a different name" };
  }

  const options: ProductOption[] = filled.map((o) => ({
    name: o.name.trim(),
    values: parseValues(o.valuesText),
  }));

  const combos = buildCombos(filled);
  if (combos.length > MAX_COMBINATIONS) {
    return { error: `Too many combinations (${combos.length}). The limit is ${MAX_COMBINATIONS}.` };
  }

  const variants: ProductVariant[] = [];
  for (const combo of combos) {
    const row = draft.rows[combo.key] ?? DEFAULT_ROW;
    if (!row.offered) continue;

    const price = Number(row.price);
    const stock = Number(row.stock);

    if (row.price.trim() === "" || !Number.isFinite(price) || price < 0) {
      return { error: `Enter a valid price for ${combo.label}` };
    }
    if (!Number.isInteger(stock) || stock < 0) {
      return { error: `Stock for ${combo.label} must be a whole number, 0 or more` };
    }

    variants.push({
      ...(row._id ? { _id: row._id } : {}),
      selections: combo.selections,
      price,
      stock,
    });
  }

  if (variants.length === 0) return { error: "Offer at least one combination" };

  return { options, variants };
}