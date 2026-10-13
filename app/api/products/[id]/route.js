import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import { uploadImage, deleteImage, validateImage } from "@/lib/cloudinary";
import { getAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

// PUT /api/products/:id (image is optional when updating)
export async function PUT(request, { params }) {
  let uploaded = null;

  try {
    const auth = await getAuth();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await connectDB();
    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const formData = await request.formData();

    // Only update fields that were actually sent
    for (const field of ["name", "description", "category"]) {
      if (formData.has(field)) product[field] = formData.get(field);
    }
    for (const field of ["price", "stock"]) {
      if (formData.has(field)) product[field] = Number(formData.get(field));
    }

    const oldPublicId = product.image.publicId;
    const file = formData.get("image");

    if (file && typeof file !== "string" && file.size > 0) {
      const imageError = validateImage(file);
      if (imageError) {
        return NextResponse.json({ error: imageError }, { status: 400 });
      }
      uploaded = await uploadImage(file, "products");
      product.image = uploaded;
    }

    await product.save();

    // Remove the old image only after the save succeeded
    if (uploaded) await deleteImage(oldPublicId);

    return NextResponse.json(product);
  } catch (error) {
    if (uploaded) await deleteImage(uploaded.publicId);
    const status = error.name === "ValidationError" ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

// DELETE /api/products/:id
export async function DELETE(request, { params }) {
  const auth = await getAuth();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  await connectDB();
  const product = await Product.findByIdAndDelete(id);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  await deleteImage(product.image.publicId);
  return NextResponse.json({ message: "Product deleted" });
}