import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Order";
import { syncRecords } from "@/lib/fulfillment";
import { getAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST() {
  const auth = await getAuth();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();

  let synced = 0;
  let failed = 0;
  for await (const order of Order.find().cursor()) {
    if (await syncRecords(order)) synced++;
    else failed++;
  }

  return NextResponse.json({ synced, failed });
}


// Log in as an admin, open your site, press F12, and in the Console run:

// js
// fetch("/api/admin/backfill", { method: "POST" }).then(r => r.json()).then(console.log)

// You should see { synced: N, failed: 0 }. You can run it again any time, and you can delete the route when you no longer need it