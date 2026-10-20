import { listCities, isBostaConfigured } from "@/lib/bosta";
import { NextResponse } from "next/server";

export async function GET() {
  if (!isBostaConfigured()) return NextResponse.json({ cities: [] });

  try {
    return NextResponse.json({ cities: await listCities() });
  } catch (error) {
    console.error("Could not load Bosta cities:", error.message);
    return NextResponse.json({ cities: [] });
  }
}