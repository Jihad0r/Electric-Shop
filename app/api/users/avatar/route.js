import { connectDB } from "@/lib/mongoose";
import User from "@/models/Users";
import { uploadImage, deleteImage, validateImage } from "@/lib/cloudinary";
import { getAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

// POST /api/users/avatar: add or replace the avatar
export async function POST(request) {
  let uploaded = null;

  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("avatar");
    const imageError = validateImage(file);
    if (imageError) {
      return NextResponse.json({ error: imageError }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(auth.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const oldPublicId = user.avatar?.publicId;

    uploaded = await uploadImage(file, "avatars");
    user.avatar = uploaded;
    await user.save();

    await deleteImage(oldPublicId);

    return NextResponse.json({ avatar: user.avatar });
  } catch (error) {
    if (uploaded) await deleteImage(uploaded.publicId);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/users/avatar: remove the avatar
export async function DELETE() {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await connectDB();
  const user = await User.findById(auth.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await deleteImage(user.avatar?.publicId);
  user.avatar = { url: "", publicId: "" };
  await user.save();

  return NextResponse.json({ message: "Avatar removed" });
}