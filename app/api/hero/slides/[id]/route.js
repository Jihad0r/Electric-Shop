import { connectDB } from "@/lib/mongoose";
import HeroSlide from "@/models/HeroSlide";
import { uploadImage, deleteImage } from "@/lib/cloudinary";
import { getAuth } from "@/lib/auth";
import { readSlideForm } from "@/lib/heroInput";
import { toSlide } from "@/lib/heroDefaults";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function load(params) {
  const auth = await getAuth();
  if (!auth || auth.role !== "admin") return { response: bad("Forbidden", 403) };

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) return { response: bad("Invalid ID") };

  await connectDB();
  const slide = await HeroSlide.findById(id);
  if (!slide) return { response: bad("Slide not found", 404) };
  return { slide };
}

// PUT: edit a slide (multipart form)
export async function PUT(request, { params }) {
  let uploaded = null;

  try {
    const { slide, response } = await load(params);
    if (response) return response;

    const parsed = readSlideForm(await request.formData());
    if (parsed.error) return bad(parsed.error);

    Object.assign(slide, parsed.data);

    let oldPublicId = "";
    if (parsed.file) {
      oldPublicId = slide.image?.publicId || "";
      uploaded = await uploadImage(parsed.file, "hero");
      slide.image = uploaded;
    } else if (parsed.removeImage) {
      oldPublicId = slide.image?.publicId || "";
      slide.image = { url: "", publicId: "" };
    }

    await slide.save();

    // Remove the old image only after the save succeeded
    if (oldPublicId) await deleteImage(oldPublicId);

    return NextResponse.json(toSlide(slide.toObject()));
  } catch (error) {
    if (uploaded) await deleteImage(uploaded.publicId);
    const status = error.name === "ValidationError" ? 400 : 500;
    return bad(error.message, status);
  }
}

// PATCH: pause or resume ({ isActive })
export async function PATCH(request, { params }) {
  try {
    const { slide, response } = await load(params);
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    if (typeof body.isActive === "boolean") slide.isActive = body.isActive;

    await slide.save();
    return NextResponse.json(toSlide(slide.toObject()));
  } catch (error) {
    return bad(error.message, 500);
  }
}

// DELETE: remove the slide and its image
export async function DELETE(request, { params }) {
  try {
    const { slide, response } = await load(params);
    if (response) return response;

    const publicId = slide.image?.publicId || "";
    await slide.deleteOne();
    if (publicId) await deleteImage(publicId);

    return NextResponse.json({ message: "Slide deleted" });
  } catch (error) {
    return bad(error.message, 500);
  }
}