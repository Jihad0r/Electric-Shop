import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import { uploadImage, deleteImage, validateImage } from "@/lib/cloudinary";
import { readVariants } from "@/lib/variants";
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

    // Check this before uploading, so a bad request doesn't create an orphaned image
    const parsed = readVariants(formData);
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const hasOptions = parsed.options.length > 0;

    uploaded = await uploadImage(file, "products");

    const product = await Product.create({
      name: formData.get("name"),
      description: formData.get("description") || "",
      category: formData.get("category") || undefined,
      isActive: formData.get("isActive") !== "false",
      // With options, price and stock are calculated from the variants
      price: hasOptions ? 0 : Number(formData.get("price")),
      stock: hasOptions ? 0 : Number(formData.get("stock") || 0),
      options: parsed.options,
      variants: parsed.variants,
      image: uploaded,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (uploaded) await deleteImage(uploaded.publicId);

    const status = error.name === "ValidationError" ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}