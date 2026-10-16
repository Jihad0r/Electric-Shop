import Hero from "@/models/Hero";
import HeroSlide from "@/models/HeroSlide";
import { toHeroContent } from "@/lib/heroDefaults";

let checked = false; // once it has run, later requests skip the check

// Turns the old single hero into slide 1. Call connectDB() first.
export async function migrateLegacyHero() {
  if (checked) return;

  // findOneAndDelete is atomic, so only one request can convert it
  const legacy = await Hero.findOneAndDelete({ key: "main" }).lean();
  checked = true;
  if (!legacy) return;

  try {
    if ((await HeroSlide.countDocuments()) > 0) return;

    const c = toHeroContent(legacy);
    await HeroSlide.create({
      titleTop: c.titleTop,
      titleAccent: c.titleAccent,
      text: c.text,
      buttonText: c.buttonText,
      buttonHref: c.buttonHref,
      showBadge: c.showBadge,
      badgeTop: c.badgeTop,
      badgeMain: c.badgeMain,
      image: legacy.image?.url ? legacy.image : { url: "", publicId: "" },
      order: 0,
      isActive: true,
    });
  } catch (error) {
    // Put the old hero back so nothing is lost
    console.error("Could not convert the old hero:", error);
    const { _id, ...rest } = legacy;
    await Hero.create(rest).catch(() => {});
    checked = false;
  }
}