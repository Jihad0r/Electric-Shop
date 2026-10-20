const BASE_URL = (process.env.BOSTA_BASE_URL || "https://app.bosta.co").replace(/\/$/, "");
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function isBostaConfigured() {
  return Boolean(process.env.BOSTA_API_KEY);
}

async function bostaFetch(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: process.env.BOSTA_API_KEY, // the key alone, no "Bearer"
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message = json?.message || json?.error || `Bosta answered with status ${res.status}`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return json;
}

/* ---------- Cities ---------- */

let cityCache = { at: 0, list: [] };
const CITY_TTL = 60 * 60 * 1000; // remember the list for an hour

// Bosta's answer may wrap the list in different ways, so look in the usual places
function findList(json) {
  const options = [
    json, json?.data, json?.result, json?.list,
    json?.data?.list, json?.data?.cities, json?.result?.list, json?.result?.cities,
  ];
  return options.find(Array.isArray) ?? [];
}

// The code Bosta wants in a delivery looks like "EG-01"
function codeOf(city) {
  const options = [city.code, city._id, city.id].filter(Boolean).map(String);
  return options.find((v) => /^EG-\d+/i.test(v)) ?? options[0] ?? "";
}

export async function listCities() {
  if (cityCache.list.length > 0 && Date.now() - cityCache.at < CITY_TTL) return cityCache.list;

  const json = await bostaFetch("/api/v0/cities");
  const list = findList(json)
    .map((c) => ({
      code: codeOf(c),
      name: String(c.name ?? c.nameEn ?? ""),
      nameAr: c.nameAr ? String(c.nameAr) : "",
    }))
    .filter((c) => c.code && c.name);

  if (list.length > 0) cityCache = { at: Date.now(), list };
  return list;
}

// Works out Bosta's code for the customer's city. Returns null if it can't.
export async function resolveCityCode(address) {
  let cities = [];
  try {
    cities = await listCities();
  } catch (error) {
    console.error("Could not load Bosta cities:", error.message);
  }

  // If the list is unavailable, trust a code that came from the checkout
  if (cities.length === 0) return address.cityCode || null;

  if (address.cityCode && cities.some((c) => c.code === address.cityCode)) return address.cityCode;

  const wanted = String(address.city ?? "").trim().toLowerCase();
  const match = cities.find(
    (c) => c.name.toLowerCase() === wanted || (c.nameAr && c.nameAr === String(address.city).trim())
  );
  return match?.code ?? null;
}

/* ---------- Deliveries ---------- */

function webhookUrl() {
  const base = process.env.APP_URL;
  const secret = process.env.BOSTA_WEBHOOK_SECRET;
  if (!base || !secret || /localhost|127\.0\.0\.1/.test(base)) return undefined;
  return `${base}/api/bosta/webhook?secret=${encodeURIComponent(secret)}`;
}

// Creates the delivery at Bosta. Returns { id, trackingNumber }.
export async function createBostaDelivery(order, { email } = {}) {
  const a = order.shippingAddress;

  const cityCode = await resolveCityCode(a);
  if (!cityCode) {
    throw new Error(`Bosta doesn't recognise the city "${a.city}". Check the customer's address.`);
  }

  const [firstName, ...rest] = String(a.fullName).trim().split(/\s+/);
  const itemsCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const hook = webhookUrl();

  const payload = {
    type: 10, // a normal delivery to the customer
    cod: order.paymentMethod === "cod" ? round2(order.totalPrice) : 0, // cash the courier collects
    dropOffAddress: {
      city: cityCode,
      firstLine: a.street,
      ...(a.postalCode ? { secondLine: `Postal code ${a.postalCode}` } : {}),
    },
    receiver: {
      firstName,
      lastName: rest.join(" ") || firstName,
      phone: a.phone,
      ...(email ? { email } : {}),
    },
    specs: { packageDetails: { itemsCount, description: `Order ${order.orderNumber}` } },
    businessReference: order.orderNumber,
    ...(hook ? { webhookUrl: hook } : {}),
  };

  const json = await bostaFetch("/api/v2/deliveries?apiVersion=1", { method: "POST", body: payload });

  const d = json?.data ?? json?.result ?? json;
  const id = d?._id ?? d?.id ?? json?._id;
  const trackingNumber = d?.trackingNumber ?? json?.trackingNumber;

  if (!id || !trackingNumber) {
    console.error("Unexpected answer from Bosta:", JSON.stringify(json));
    throw new Error(
      "Bosta accepted the delivery but didn't return a tracking number. Check your Bosta dashboard before trying again."
    );
  }

  return { id: String(id), trackingNumber: String(trackingNumber) };
}