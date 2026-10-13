import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import { uploadImage, deleteImage, validateImage } from "@/lib/cloudinary";
import { getAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await connectDB();
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  let uploaded = null;

  try {
    const auth = await getAuth();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();
    const formData = await request.formData();

    const file = formData.get("image");
    const imageError = validateImage(file);
    if (imageError) {
      return NextResponse.json({ error: imageError }, { status: 400 });
    }

    uploaded = await uploadImage(file, "products");

    const product = await Product.create({
      name: formData.get("name"),
      description: formData.get("description") || "",
      price: Number(formData.get("price")),
      category: formData.get("category") || undefined,
      stock: Number(formData.get("stock") || 0),
      image: uploaded,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    // If saving to the DB failed, don't leave an orphaned image in Cloudinary
    if (uploaded) await deleteImage(uploaded.publicId);

    const status = error.name === "ValidationError" ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}