import { listCities, isAramexConfigured } from "@/lib/aramex";
import { NextResponse } from "next/server";

export async function GET() {
  if (!isAramexConfigured()) return NextResponse.json({ cities: [] });

  try {
    return NextResponse.json({ cities: await listCities() });
  } catch (error) {
    // The checkout falls back to a plain text box
    console.error("Could not load Aramex cities:", error.message);
    return NextResponse.json({ cities: [] });
  }
}