import Product from "@/models/Product";

export async function restoreStock({ product, variantId, quantity }) {
  if (variantId) {
    // Variant stock and the product total move together
    await Product.updateOne(
      { _id: product, "variants._id": variantId },
      { $inc: { "variants.$.stock": quantity, stock: quantity } }
    );
  } else {
    await Product.updateOne({ _id: product }, { $inc: { stock: quantity } });
  }
}