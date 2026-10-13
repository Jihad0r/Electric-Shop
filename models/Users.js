import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // never returned in queries unless explicitly requested
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^(?:01[0125]\d{8}|\+201[0125]\d{8})$/, "Please enter a valid Egyptian phone number"]
    },
    address: {
      street: String,
      city: String,
      country: String,
    },
    avatar: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Hash the password before saving (only if it was changed)
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare a plain password with the hashed one
UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.models.User || mongoose.model("User", UserSchema);