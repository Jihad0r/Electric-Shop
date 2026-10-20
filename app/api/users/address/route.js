import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import { getAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

const clean = (v) => String(v ?? "").trim().slice(0, 120);

export async function PUT(request) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Please log in" }, { status: 401 });

    const body = await request.json().catch(() => ({}));

    await connectDB();
    await User.updateOne(
      { _id: auth.id },
      {
        $set: {
          phone: clean(body.phone),
          "address.street": clean(body.street),
          "address.city": clean(body.city),
          "address.country": clean(body.country),
        },
      }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}