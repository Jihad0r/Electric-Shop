import { connectDB } from "@/lib/mongoose";
import Offer from "@/models/Offer";
import { getAuth } from "@/lib/auth";
import { readOffer } from "@/lib/offerInput";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

async function load(params) {
  const auth = await getAuth();
  if (!auth || auth.role !== "admin") {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { response: NextResponse.json({ error: "Invalid ID" }, { status: 400 }) };
  }

  await connectDB();
  const offer = await Offer.findById(id);
  if (!offer) {
    return { response: NextResponse.json({ error: "Offer not found" }, { status: 404 }) };
  }
  return { offer };
}

// PUT: replace the offer's details
export async function PUT(request, { params }) {
  try {
    const { offer, response } = await load(params);
    if (response) return response;

    const parsed = readOffer(await request.json().catch(() => null));
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

    Object.assign(offer, parsed.data);
    await offer.save();
    return NextResponse.json(offer);
  } catch (error) {
    const status = error.name === "ValidationError" ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

// PATCH: quick switches ({ isActive }, { showOnHome })
export async function PATCH(request, { params }) {
  try {
    const { offer, response } = await load(params);
    if (response) return response;

    const body = await request.json().catch(() => ({}));
    if (typeof body.isActive === "boolean") offer.isActive = body.isActive;
    if (typeof body.showOnHome === "boolean") offer.showOnHome = body.showOnHome;

    await offer.save();
    return NextResponse.json(offer);
  } catch (error) {
    const status = error.name === "ValidationError" ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function DELETE(request, { params }) {
  const { offer, response } = await load(params);
  if (response) return response;

  await offer.deleteOne();
  return NextResponse.json({ message: "Offer deleted" });
}