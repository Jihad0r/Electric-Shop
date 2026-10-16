import mongoose from "mongoose";

// One document (key "main") holds the home page hero.
// Fields left unset fall back to the defaults in lib/heroDefaults.ts.
const HeroSchema = new mongoose.Schema(
  {
    key: { type: String, default: "main", unique: true },
    titleTop: { type: String, trim: true, maxlength: 40 },
    titleAccent: { type: String, trim: true, maxlength: 40 },
    text: { type: String, trim: true, maxlength: 200 },
    buttonText: { type: String, trim: true, maxlength: 24 },
    buttonHref: { type: String, trim: true, maxlength: 200 },
    showBadge: { type: Boolean },
    badgeTop: { type: String, trim: true, maxlength: 16 },
    badgeMain: { type: String, trim: true, maxlength: 16 },
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

export default mongoose.models.Hero || mongoose.model("Hero", HeroSchema);