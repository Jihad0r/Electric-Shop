import { connection } from "next/server";
import { connectDB } from "@/lib/mongoose";
import HeroSlide from "@/models/HeroSlide";
import { migrateLegacyHero } from "@/lib/heroMigrate";
import { DEFAULT_SLIDE, toSlide, type HeroSlideData } from "@/lib/heroDefaults";

// Active slides in order. With no active slides, the default hero is shown.
export async function getHeroSlides(): Promise<HeroSlideData[]> {
  await connection(); // read the latest saved version on every visit
  try {
    await connectDB();
    await migrateLegacyHero();

    const docs = await HeroSlide.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean();
    if (docs.length === 0) return [DEFAULT_SLIDE];

    return docs.map((d) => toSlide(d as Parameters<typeof toSlide>[0]));
  } catch (error) {
    console.error("Could not load the hero slides:", error);
    return [DEFAULT_SLIDE];
  }
}