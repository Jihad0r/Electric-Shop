import { connectDB } from "@/lib/mongoose";
import User from "@/models/Users";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    await connectDB();
    const { name, email, password ,phone} = await request.json();

    // Only accept these fields, so users can't set their own role
    const user = await User.create({ name, email, password , phone });

    return NextResponse.json(
      { id: user._id, name: user.name, email: user.email, role: user.role },
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