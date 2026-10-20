"use client";
import { useEffect, useState } from "react";

type City = { code: string; name: string; nameAr?: string };

type Props = {
  value: string; // the city name
  cityCode: string;
  onChange: (city: string, cityCode: string) => void;
  error?: string;
};

const inputClass =
  "w-full rounded-lg border bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm";

let cached: City[] | null = null; // the list is loaded once per visit

export default function CityField({ value, cityCode, onChange, error }: Props) {
  const [cities, setCities] = useState<City[] | null>(cached);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/shipping/cities");
        const data: { cities?: City[] } = res.ok ? await res.json() : {};
        cached = data.cities ?? [];
      } catch {
        cached = [];
      }
      if (!cancelled) setCities(cached);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // A saved city name that matches one on the list gets its code filled in
  const byName = cities?.find((c) => c.name.toLowerCase() === value.trim().toLowerCase());
  useEffect(() => {
    if (byName && !cityCode) onChange(byName.name, byName.code);
  }, [byName, cityCode, onChange]);

  const border = error ? "border-red-400" : "border-gray-300";

  return (
    <div>
      <label htmlFor="city" className="mb-1 block text-sm font-medium text-gray-700">
        City
      </label>

      {cities && cities.length > 0 ? (
        <select
          id="city"
          name="city"
          value={cityCode || byName?.code || ""}
          onChange={(e) => {
            const picked = cities.find((c) => c.code === e.target.value);
            onChange(picked?.name ?? "", picked?.code ?? "");
          }}
          aria-invalid={Boolean(error)}
          className={`${inputClass} ${border}`}
        >
          <option value="">Select your city</option>
          {cities.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      ) : (
        <input
          id="city"
          name="city"
          type="text"
          autoComplete="address-level2"
          value={value}
          onChange={(e) => onChange(e.target.value, "")}
          aria-invalid={Boolean(error)}
          className={`${inputClass} ${border}`}
        />
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}