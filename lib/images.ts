const MARK = "/image/upload/";

// Asks Cloudinary to trim empty or transparent borders, so a picture is only as big as the product.
// Set IMAGE_TRIM=off in .env.local to turn this off.
export function tightImage(
  url?: string | null,
  options: { removeWhite?: boolean } = {}
): string | undefined {
  if (!url) return undefined;
  if (process.env.IMAGE_TRIM === "off") return url;
  if (!url.includes("res.cloudinary.com") || !url.includes(MARK) || url.includes("e_trim")) return url;

  const steps: string[] = [];
  if (options.removeWhite) steps.push("co_white,e_make_transparent:12"); // experimental, see the notes
  steps.push("e_trim:10");
  steps.push("f_auto,q_auto");

  return url.replace(MARK, `${MARK}${steps.join("/")}/`);
}