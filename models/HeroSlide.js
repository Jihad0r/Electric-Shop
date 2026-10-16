import mongoose from "mongoose";

const HeroSlideSchema = new mongoose.Schema(
  {
    titleTop: { type: String, trim: true, maxlength: 40, default: "" },
    titleAccent: { type: String, trim: true, maxlength: 40, default: "" },
    text: { type: String, trim: true, maxlength: 200, default: "" },
    buttonText: { type: String, trim: true, maxlength: 24, default: "" },
    buttonHref: { type: String, trim: true, maxlength: 200, default: "" },
    showBadge: { type: Boolean, default: false },
    badgeTop: { type: String, trim: true, maxlength: 16, default: "" },
    badgeMain: { type: String, trim: true, maxlength: 16, default: "" },
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

HeroSlideSchema.index({ order: 1 });

export default mongoose.models.HeroSlide || mongoose.model("HeroSlide", HeroSlideSchema);