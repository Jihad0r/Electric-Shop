import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET); // { id, role }
  } catch {
    return null;
  }
}