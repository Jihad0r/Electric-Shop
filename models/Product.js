import mongoose from "mongoose";

const MAX_OPTIONS = 3;
const MAX_VALUES = 10;
const MAX_VARIANTS = 50;

const OptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Option name is required"], trim: true, maxlength: 30 },
    values: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      validate: [
        (v) => v.length >= 1 && v.length <= MAX_VALUES,
        `Each option needs 1 to ${MAX_VALUES} values`,
      ],
    },
  },
  { _id: false }
);

const SelectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
);

// One purchasable combination, e.g. RAM 16GB + Storage 512GB
const VariantSchema = new mongoose.Schema({
  selections: { type: [SelectionSchema], required: true },
  price: {
    type: Number,
    required: [true, "Variant price is required"],
    min: [0, "Price cannot be negative"],
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, "Stock cannot be negative"],
    validate: { validator: Number.isInteger, message: "Stock must be a whole number" },
  },
});

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    category: {
      type: String,
      trim: true,
      enum: ["phones", "laptops", "tablets", "accessories", "others"],
      default: "laptops",
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    image: {
      url: { type: String, required: [true, "Product image is required"] },
      publicId: { type: String, required: true },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    options: {
      type: [OptionSchema],
      default: [],
      validate: [(v) => v.length <= MAX_OPTIONS, `A product can have at most ${MAX_OPTIONS} options`],
    },
    variants: {
      type: [VariantSchema],
      default: [],
      validate: [(v) => v.length <= MAX_VARIANTS, `A product can have at most ${MAX_VARIANTS} combinations`],
    },
  },
  { timestamps: true }
);

// Keeps options and variants consistent, and calculates price and stock from them
ProductSchema.pre("validate", async function () {
  // No options: a simple product. Variants make no sense, so clear them.
  if (this.options.length === 0) {
    this.variants = [];
    return;
  }

  const names = this.options.map((o) => o.name.toLowerCase());
  if (new Set(names).size !== names.length) {
    this.invalidate("options", "Option names must be different");
    return;
  }

  if (this.variants.length === 0) {
    this.invalidate("variants", "Add at least one combination when a product has options");
    return;
  }

  const seen = new Set();
  for (const variant of this.variants) {
    if (variant.selections.length !== this.options.length) {
      this.invalidate("variants", "Every combination must pick a value for each option");
      return;
    }

    const parts = [];
    for (const option of this.options) {
      const chosen = variant.selections.find((s) => s.name === option.name);
      if (!chosen || !option.values.includes(chosen.value)) {
        this.invalidate("variants", `A combination has an invalid value for "${option.name}"`);
        return;
      }
      parts.push(chosen.value);
    }

    const key = parts.join("|");
    if (seen.has(key)) {
      this.invalidate("variants", "Two combinations are identical");
      return;
    }
    seen.add(key);
  }

  const prices = this.variants.map((v) => v.price).filter(Number.isFinite);
  if (prices.length === this.variants.length) {
    this.price = Math.min(...prices);
    this.stock = this.variants.reduce((sum, v) => sum + v.stock, 0);
  }
});

export default mongoose.models.Product || mongoose.model("Product", ProductSchema);