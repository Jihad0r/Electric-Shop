import mongoose from "mongoose";

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
  },
  { timestamps: true } // adds createdAt and updatedAt
);

export default mongoose.models.Product || mongoose.model("Product", ProductSchema);