import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    method: { type: String, enum: ["cod", "card", "wallet"], required: true },
    provider: { type: String, enum: ["cash", "paymob"], required: true },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "EGP" },

    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    paidAt: Date,
    refundedAt: Date,

    // Paymob references (empty for cash)
    providerIntentionId: { type: String, default: "" },
    providerOrderId: { type: String, default: "" },
    transactionId: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);