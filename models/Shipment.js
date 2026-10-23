import mongoose from "mongoose";

const ShipmentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    status: {
      type: String,
      enum: ["pending", "shipped", "delivered", "cancelled", "returned"],
      default: "pending",
      index: true,
    },

    courier: { type: String, trim: true, default: "" },
    trackingNumber: { type: String, trim: true, default: "", index: true },
    labelUrl: { type: String, default: "" }, // printable label from Aramex
    lastError: { type: String, default: "" }, // why creating the Aramex shipment failed

    // Latest tracking news from Aramex
    lastUpdateCode: { type: String, default: "" },
    lastUpdateText: { type: String, default: "" },
    lastUpdateAt: Date,
    lastSyncedAt: { type: Date, default: null },

    shippedAt: Date,
    deliveredAt: Date,

    // Cash the courier must collect (0 when the order was paid online)
    collectOnDelivery: { type: Number, default: 0, min: 0 },
    cashCollectedAt: Date,

    // Copy of the address, so the shipment is complete on its own
    address: {
      fullName: String,
      phone: String,
      street: String,
      city: String,
      cityCode: String,
      postalCode: String,
      country: String,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Shipment || mongoose.model("Shipment", ShipmentSchema);