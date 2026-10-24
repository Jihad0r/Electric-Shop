import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import { NextResponse } from "next/server";

const PHONE = /^\+?[\d\s\-()]{8,20}$/;

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json().catch(() => ({}));

    const phone = String(body.phone ?? "").trim();
    if (!PHONE.test(phone)) {
      return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
    }

    // Only these fields are accepted, so nobody can set their own role
    const user = await User.create({
      name: body.name,
      email: body.email,
      password: body.password,
      phone,
    });

    return NextResponse.json(
      { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
      { status: 201 }
    );
  } catch (error) {
    if (error.code === 11000) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    const status = error.name === "ValidationError" ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}