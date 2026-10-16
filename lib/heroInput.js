import { HERO_LIMITS, isSafeHref } from "@/lib/heroDefaults";
import { validateImage } from "@/lib/cloudinary";

// Returns { data, file, removeImage } or { error }
export function readSlideForm(form) {
  const text = (key) => String(form.get(key) ?? "").trim();

  const data = {
    titleTop: text("titleTop"),
    titleAccent: text("titleAccent"),
    text: text("text"),
    buttonText: text("buttonText"),
    buttonHref: text("buttonHref"),
    showBadge: form.get("showBadge") === "true",
    badgeTop: text("badgeTop"),
    badgeMain: text("badgeMain"),
    isActive: form.get("isActive") !== "false",
  };

  if (!data.titleTop && !data.titleAccent) return { error: "Add a heading" };
  if (data.titleTop.length > HERO_LIMITS.title || data.titleAccent.length > HERO_LIMITS.title) {
    return { error: `Heading lines can be up to ${HERO_LIMITS.title} characters` };
  }
  if (data.text.length > HERO_LIMITS.text) {
    return { error: `The paragraph can be up to ${HERO_LIMITS.text} characters` };
  }
  if (data.buttonText.length > HERO_LIMITS.button) {
    return { error: `The button text can be up to ${HERO_LIMITS.button} characters` };
  }
  if (data.buttonText && !isSafeHref(data.buttonHref)) {
    return { error: "The button link must start with / (for example /laptops) or https://" };
  }

  const file = form.get("image");
  const hasFile = file && typeof file !== "string" && file.size > 0;
  if (hasFile) {
    const imageError = validateImage(file);
    if (imageError) return { error: imageError };
  }

  return {
    data,
    file: hasFile ? file : null,
    removeImage: form.get("removeImage") === "true",
  };
}