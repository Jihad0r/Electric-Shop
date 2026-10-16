import mongoose from "mongoose";

const OfferSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Title is required"], trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 160, default: "" },
    discountType: { type: String, enum: ["percent", "fixed"], default: "percent" },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0.01, "Discount must be more than 0"],
    },
    applyToAll: { type: Boolean, default: false },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    showOnHome: { type: Boolean, default: true },
  },
  { timestamps: true }
);

OfferSchema.pre("validate", async function () {
  if (this.applyToAll) this.products = [];

  if (this.discountType === "percent" && this.discountValue > 90) {
    this.invalidate("discountValue", "A percent discount can't be more than 90");
  }
  if (!this.applyToAll && this.products.length === 0) {
    this.invalidate("products", "Choose at least one product, or apply the offer to all products");
  }
  if (this.startsAt && this.endsAt && this.endsAt <= this.startsAt) {
    this.invalidate("endsAt", "The end date must be after the start date");
  }
});

export default mongoose.models.Offer || mongoose.model("Offer", OfferSchema);