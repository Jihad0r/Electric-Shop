import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import { getAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    await connectDB();
    const user = await User.findById(auth.id).lean();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar?.url ?? "",
      phone: user.phone ?? "",
      address: {
        street: user.address?.street ?? "",
        city: user.address?.city ?? "",
        country: user.address?.country ?? "",
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }
}