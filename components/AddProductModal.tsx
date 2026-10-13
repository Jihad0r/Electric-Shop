"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { CATEGORIES, type Category, type Product } from "@/types/product";

type Props = {
  onClose: () => void;
  onCreated: (product: Product) => void;
};

type FormState = {
  name: string;
  description: string;
  price: string;
  category: Category;
  stock: string;
  isActive: boolean;
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 4 * 1024 * 1024; // 4MB, same limit as the API

// text-base on phones stops iPhones from zooming in when a field is tapped
const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm";
const labelClass = "mb-1 block text-sm font-medium text-gray-700";

export default function AddProductModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    price: "",
    category: "phones",
    stock: "0",
    isActive: true,
  });
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Preview URL for the chosen image, released when it changes or the popup closes
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : ""), [image]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Focus the first field when the popup opens
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Stop the page behind from scrolling while the popup is open
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Close with the Escape key (not while saving)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, submitting]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setError("");

    if (!file) {
      setImage(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only JPG, PNG or WEBP images are allowed");
      e.target.value = "";
      setImage(null);
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Image must be under 4MB");
      e.target.value = "";
      setImage(null);
      return;
    }
    setImage(file);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const price = Number(form.price);
    const stock = Number(form.stock);

    if (!form.name.trim()) return setError("Name is required");
    if (form.price === "" || !Number.isFinite(price) || price < 0) {
      return setError("Enter a valid price");
    }
    if (!Number.isInteger(stock) || stock < 0) {
      return setError("Stock must be a whole number, 0 or more");
    }
    if (!image) return setError("Please choose a product image");

    const data = new FormData();
    data.append("name", form.name.trim());
    data.append("description", form.description.trim());
    data.append("price", String(price));
    data.append("category", form.category);
    data.append("stock", String(stock));
    data.append("isActive", String(form.isActive));
    data.append("image", image);

    setSubmitting(true);
    try {
      // Don't set Content-Type yourself; the browser adds the multipart boundary
      const res = await fetch("/api/products", { method: "POST", body: data });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Could not add the product");
        return;
      }

      onCreated(json as Product);
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // Bottom sheet on phones, centred popup from 640px up
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        // Close when clicking the dark area, not the panel itself
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-product-title"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-h-[90dvh] sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="add-product-title" className="text-xl font-bold text-gray-900">
              Add product
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">Fields marked * are required</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="rounded-md p-1 text-2xl leading-none text-gray-400 transition hover:text-gray-700 disabled:opacity-50"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="name" className={labelClass}>
              Name *
            </label>
            <input
              ref={nameRef}
              id="name"
              name="name"
              type="text"
              maxLength={100}
              required
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Samsung Galaxy S24"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              value={form.description}
              onChange={handleChange}
              placeholder="Short description of the product"
              className={inputClass}
            />
          </div>

          {/* Stacks on very narrow phones, two columns from 400px up */}
          <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
            <div>
              <label htmlFor="price" className={labelClass}>
                Price *
              </label>
              <input
                id="price"
                name="price"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                required
                value={form.price}
                onChange={handleChange}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="stock" className={labelClass}>
                Stock
              </label>
              <input
                id="stock"
                name="stock"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form.stock}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="category" className={labelClass}>
              Category *
            </label>
            <select
              id="category"
              name="category"
              value={form.category}
              onChange={handleChange}
              className={inputClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="image" className={labelClass}>
              Image *
            </label>
            <input
              id="image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImage}
              className="block w-full text-sm text-gray-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-1 text-xs text-gray-400">JPG, PNG or WEBP, up to 4MB</p>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Preview"
                className="mt-3 h-40 w-full rounded-lg bg-gray-100 object-contain"
              />
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            Visible in the store
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Full-width stacked buttons on phones, side by side from 640px up */}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Uploading..." : "Add product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}