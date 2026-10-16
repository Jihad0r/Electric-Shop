import { connectDB } from "@/lib/mongoose";
import Offer from "@/models/Offer";
import { getAuth } from "@/lib/auth";
import { readOffer } from "@/lib/offerInput";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await getAuth();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const offers = await Offer.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json(offers);
}

export async function POST(request) {
  try {
    const auth = await getAuth();
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = readOffer(await request.json().catch(() => null));
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

    await connectDB();
    const offer = await Offer.create(parsed.data);
    return NextResponse.json(offer, { status: 201 });
  } catch (error) {
    const status = error.name === "ValidationError" ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}