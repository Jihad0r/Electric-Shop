import { connectDB } from "@/lib/mongoose";
import { getAuth } from "@/lib/auth";
import { syncShipments } from "@/lib/syncTracking";
import { NextResponse } from "next/server";

async function allowed(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") === `Bearer ${secret}`) return true;
  const auth = await getAuth();
  return Boolean(auth && auth.role === "admin");
}

async function run(request) {
  if (!(await allowed(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await connectDB();
  return NextResponse.json(await syncShipments({ force: true }));
}

export const GET = run; // scheduled services such as Vercel Cron use GET
export const POST = run;