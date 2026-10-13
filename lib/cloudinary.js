import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 4 * 1024 * 1024; // 4MB (Vercel limits request bodies to ~4.5MB)

// Returns an error message, or null if the file is fine
export function validateImage(file) {
  if (!file || typeof file === "string" || file.size === 0) return "Image is required";
  if (!ALLOWED_TYPES.includes(file.type)) return "Only JPG, PNG or WEBP images are allowed";
  if (file.size > MAX_SIZE) return "Image must be under 4MB";
  return null;
}

// Uploads a File to Cloudinary, returns { url, publicId }
export async function uploadImage(file, folder) {
  const buffer = Buffer.from(await file.arrayBuffer());

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: "image" }, (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      })
      .end(buffer);
  });
}

export async function deleteImage(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete failed:", error);
  }
}