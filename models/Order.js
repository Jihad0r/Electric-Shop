import mongoose from "mongoose";

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const OrderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId }, // set when the product has options
    variantLabel: { type: String, default: "" }, // e.g. "16GB / 512GB"
    quantity: { type: Number, required: true, min: [1, "Quantity must be at least 1"] },
  },
  { _id: false }
);

const ShippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
        cityCode: { type: String, trim: true, default: "" }, // Bosta's code for the city
    postalCode: { type: String, trim: true, default: "" },
    country: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true }, // e.g. ORD-20261012-482193

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    items: {
      type: [OrderItemSchema],
      validate: [(v) => v.length > 0, "Order must have at least one item"],
    },

    shippingAddress: { type: ShippingAddressSchema, required: true },

    // Money
    currency: { type: String, default: "EGP" },
    itemsPrice: { type: Number, default: 0, min: 0 }, // set by the route from real prices
    shippingPrice: { type: Number, default: 0, min: 0 },
    taxPrice: { type: Number, default: 0, min: 0 },
    discountCode: { type: String, trim: true, uppercase: true, default: "" },
    discountAmount: { type: Number, default: 0, min: 0 },
    totalPrice: { type: Number, default: 0, min: 0 },

    // Payment
    paymentMethod: {
      type: String,
      enum: ["cod", "card", "wallet"],
      default: "cod",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paidAt: Date,
        paymob: {
      intentionId: { type: String, default: "" },
      orderId: { type: String, default: "" },
      transactionId: { type: String, default: "" },
    },
        payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    shipment: { type: mongoose.Schema.Types.ObjectId, ref: "Shipment" },
    // Fulfilment
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

OrderSchema.pre("validate", async function () {
  if (!this.orderNumber) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(100000 + Math.random() * 900000);
    this.orderNumber = `ORD-${date}-${rand}`;
  }

  // Discount can never exceed the items total
  this.discountAmount = Math.min(this.discountAmount || 0, this.itemsPrice);

  this.totalPrice = round2(
    this.itemsPrice + this.shippingPrice + this.taxPrice - this.discountAmount
  );
});

OrderSchema.index({ createdAt: -1 });

export default mongoose.models.Order || mongoose.model("Order", OrderSchema);