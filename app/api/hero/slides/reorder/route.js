import { connectDB } from "@/lib/mongoose";
import HeroSlide from "@/models/HeroSlide";
import { getAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

// POST { ids: [...] }: the new order of the slides
export async function POST(request) {
  try {
    const auth = await getAuth();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { ids } = await request.json().catch(() => ({}));
    if (!Array.isArray(ids) || ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return NextResponse.json({ error: "Invalid order" }, { status: 400 });
    }

    await connectDB();
    const existing = (await HeroSlide.find().select("_id").lean()).map((d) => String(d._id));
    const known = new Set(existing);

    // Listed slides first, in the new order; any not listed keep going after them
    const listed = [...new Set(ids.map(String))].filter((id) => known.has(id));
    const rest = existing.filter((id) => !listed.includes(id));
    const finalOrder = [...listed, ...rest];

    await HeroSlide.bulkWrite(
      finalOrder.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
      }))
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}