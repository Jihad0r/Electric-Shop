export type HeroContent = {
  titleTop: string;
  titleAccent: string;
  text: string;
  buttonText: string;
  buttonHref: string;
  showBadge: boolean;
  badgeTop: string;
  badgeMain: string;
  imageUrl: string;
};
export const DEFAULT_HERO_IMAGE = "/hero-default.png";
export type HeroSlideData = HeroContent & {
  id: string;
  isActive: boolean;
  order: number;
};

export const DEFAULT_HERO: HeroContent = {
  titleTop: "Upgrade Your",
  titleAccent: "Tech Experience",
  text: "Top brands, best prices, and the latest technology all in one place.",
  buttonText: "Shop Now",
  buttonHref: "/products",
  showBadge: true,
  badgeTop: "Up to",
  badgeMain: "40% OFF",
  imageUrl: "",
};

// Shown when there are no active slides
export const DEFAULT_SLIDE: HeroSlideData = {
  ...DEFAULT_HERO,
  id: "default",
  isActive: true,
  order: 0,
};

export const MAX_SLIDES = 8;
export const HERO_LIMITS = { title: 40, text: 200, button: 24, href: 200, badge: 16 };

// Only allow site paths ("/laptops") or full web links ("https://...").
// This blocks things like "javascript:..." from being used as a button link.
export function isSafeHref(value: string): boolean {
  return /^\/(?!\/)\S*$/.test(value) || /^https?:\/\/\S+$/i.test(value);
}

type HeroDoc =
  | (Partial<Omit<HeroContent, "imageUrl">> & { image?: { url?: string } })
  | null
  | undefined;

// A saved value (even an empty one) wins; anything never saved falls back to the default
export function toHeroContent(doc: HeroDoc): HeroContent {
  const d = doc ?? {};
  return {
    titleTop: d.titleTop ?? DEFAULT_HERO.titleTop,
    titleAccent: d.titleAccent ?? DEFAULT_HERO.titleAccent,
    text: d.text ?? DEFAULT_HERO.text,
    buttonText: d.buttonText ?? DEFAULT_HERO.buttonText,
    buttonHref: d.buttonHref ?? DEFAULT_HERO.buttonHref,
    showBadge: d.showBadge ?? DEFAULT_HERO.showBadge,
    badgeTop: d.badgeTop ?? DEFAULT_HERO.badgeTop,
    badgeMain: d.badgeMain ?? DEFAULT_HERO.badgeMain,
    imageUrl: d.image?.url || "",
  };
}

type SlideDoc = NonNullable<HeroDoc> & { _id: unknown; isActive?: boolean; order?: number };

export function toSlide(doc: SlideDoc): HeroSlideData {
  return {
    ...toHeroContent(doc),
    id: String(doc._id),
    isActive: doc.isActive ?? true,
    order: doc.order ?? 0,
  };
}