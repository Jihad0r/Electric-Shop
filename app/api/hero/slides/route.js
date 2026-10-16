import { connectDB } from "@/lib/mongoose";
import HeroSlide from "@/models/HeroSlide";
import { uploadImage, deleteImage } from "@/lib/cloudinary";
import { getAuth } from "@/lib/auth";
import { readSlideForm } from "@/lib/heroInput";
import { migrateLegacyHero } from "@/lib/heroMigrate";
import { MAX_SLIDES, toSlide } from "@/lib/heroDefaults";
import { NextResponse } from "next/server";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function isAdmin() {
  const auth = await getAuth();
  return Boolean(auth && auth.role === "admin");
}

// GET /api/hero/slides: all slides, including paused ones
export async function GET() {
  try {
    if (!(await isAdmin())) return bad("Forbidden", 403);

    await connectDB();
    await migrateLegacyHero();
    const docs = await HeroSlide.find().sort({ order: 1, createdAt: 1 }).lean();
    return NextResponse.json(docs.map(toSlide));
  } catch (error) {
    return bad(error.message, 500);
  }
}

// POST /api/hero/slides: add a slide (multipart form)
export async function POST(request) {
  let uploaded = null;

  try {
    if (!(await isAdmin())) return bad("Forbidden", 403);

    const parsed = readSlideForm(await request.formData());
    if (parsed.error) return bad(parsed.error);

    await connectDB();
    await migrateLegacyHero();

    if ((await HeroSlide.countDocuments()) >= MAX_SLIDES) {
      return bad(`You can have up to ${MAX_SLIDES} slides`);
    }

    const last = await HeroSlide.findOne().sort({ order: -1 }).select("order").lean();

    if (parsed.file) uploaded = await uploadImage(parsed.file, "hero");

    const slide = await HeroSlide.create({
      ...parsed.data,
      image: uploaded ?? { url: "", publicId: "" },
      order: (last?.order ?? -1) + 1,
    });

    return NextResponse.json(toSlide(slide.toObject()), { status: 201 });
  } catch (error) {
    if (uploaded) await deleteImage(uploaded.publicId);
    const status = error.name === "ValidationError" ? 400 : 500;
    return bad(error.message, status);
  }
}