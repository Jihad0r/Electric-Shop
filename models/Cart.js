import mongoose from "mongoose";

const CartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId },
    name: { type: String, default: "" }, // so a deleted product can still be named in the cart
    quantity: { type: Number, required: true, min: 1, max: 99 },
  },
  { _id: false }
);

const CartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, sparse: true },
    token: { type: String, unique: true, sparse: true }, // identifies a visitor who isn't logged in
    items: { type: [CartItemSchema], default: [] },
    expiresAt: { type: Date }, // only carts of visitors who aren't logged in expire
  },
  { timestamps: true }
);

CartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.Cart || mongoose.model("Cart", CartSchema);