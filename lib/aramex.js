const IS_LIVE = process.env.ARAMEX_ENV === "live";
const API = `${IS_LIVE ? "https://ws.aramex.net" : "https://ws.dev.aramex.net"}/ShippingAPI.V2`;

const env = (name, fallback = "") => String(process.env[name] ?? fallback).trim();
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const REQUIRED = [
  "ARAMEX_USERNAME", "ARAMEX_PASSWORD", "ARAMEX_ACCOUNT_NUMBER", "ARAMEX_ACCOUNT_PIN",
  "ARAMEX_ACCOUNT_ENTITY", "ARAMEX_ACCOUNT_COUNTRY",
  "ARAMEX_SHIPPER_NAME", "ARAMEX_SHIPPER_PHONE", "ARAMEX_SHIPPER_ADDRESS", "ARAMEX_SHIPPER_CITY",
];

export function isAramexConfigured() {
  return REQUIRED.every((name) => env(name));
}

function clientInfo() {
  return {
    UserName: env("ARAMEX_USERNAME"),
    Password: env("ARAMEX_PASSWORD"),
    Version: "v1.0",
    AccountNumber: env("ARAMEX_ACCOUNT_NUMBER"),
    AccountPin: env("ARAMEX_ACCOUNT_PIN"),
    AccountEntity: env("ARAMEX_ACCOUNT_ENTITY"),
    AccountCountryCode: env("ARAMEX_ACCOUNT_COUNTRY"),
  };
}

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!json) throw new Error(`Aramex answered with status ${res.status} and no readable data`);
  return json;
}

// Aramex reports problems as a list of { Code, Message }
function problems(json) {
  const list = [...(json?.Notifications ?? []), ...(json?.Shipments?.[0]?.Notifications ?? [])];
  return list
    .map((n) => [n?.Code, n?.Message].filter(Boolean).join(": "))
    .filter(Boolean)
    .join("; ");
}

// Aramex dates look like "/Date(1700000000000+0200)/"
function parseDate(value) {
  const match = /\/Date\((-?\d+)/.exec(String(value ?? ""));
  return match ? new Date(Number(match[1])) : null;
}

const aramexDate = (ms) => `/Date(${ms})/`;

// This store delivers inside Egypt, so the country is always Egypt unless the text says otherwise
function countryCode(text) {
  const t = String(text ?? "").trim();
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return "EG";
}

/* ---------- Cities ---------- */

let cityCache = { at: 0, list: [] };
const CITY_TTL = 24 * 60 * 60 * 1000;

export async function listCities() {
  if (cityCache.list.length > 0 && Date.now() - cityCache.at < CITY_TTL) return cityCache.list;

  // VERIFY the field names against Aramex's Location API documentation
  const json = await post("/Location/Service_1_0.svc/json/FetchCities", {
    ClientInfo: clientInfo(),
    CountryCode: env("ARAMEX_ACCOUNT_COUNTRY", "EG"),
    State: "",
    NameStartsWith: "",
    Transaction: { Reference1: "" },
  });

  if (json.HasErrors) throw new Error(problems(json) || "Aramex could not list the cities");

  const names = (json.Cities ?? [])
    .map((c) => (typeof c === "string" ? c : c?.Name))
    .filter(Boolean)
    .map(String);

  // Aramex identifies a city by its name, so the "code" is the name itself
  const list = [...new Set(names)].sort((a, b) => a.localeCompare(b)).map((name) => ({ code: name, name }));

  if (list.length > 0) cityCache = { at: Date.now(), list };
  return list;
}

/* ---------- Shipments ---------- */

// Creates the shipment at Aramex. Returns { trackingNumber, labelUrl }.
export async function createAramexShipment(order, { email } = {}) {
  const a = order.shippingAddress;
  const isCod = order.paymentMethod === "cod";
  const itemsCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const weight = Math.max(0.5, itemsCount * Number(env("ARAMEX_WEIGHT_PER_ITEM_KG", "1")));
  const accountNumber = env("ARAMEX_ACCOUNT_NUMBER");
  const now = Date.now();

  const payload = {
    ClientInfo: clientInfo(),
    LabelInfo: { ReportID: 9201, ReportType: "URL" }, // the answer includes a link to the label
    Shipments: [
      {
        Reference1: order.orderNumber,
        Shipper: {
          Reference1: order.orderNumber,
          AccountNumber: accountNumber,
          PartyAddress: {
            Line1: env("ARAMEX_SHIPPER_ADDRESS"),
            City: env("ARAMEX_SHIPPER_CITY"),
            CountryCode: env("ARAMEX_ACCOUNT_COUNTRY", "EG"),
          },
          Contact: {
            PersonName: env("ARAMEX_SHIPPER_NAME"),
            CompanyName: env("ARAMEX_SHIPPER_COMPANY") || env("ARAMEX_SHIPPER_NAME"),
            PhoneNumber1: env("ARAMEX_SHIPPER_PHONE"),
            CellPhone: env("ARAMEX_SHIPPER_PHONE"),
            EmailAddress: env("ARAMEX_SHIPPER_EMAIL"),
          },
        },
        Consignee: {
          Reference1: order.orderNumber,
          PartyAddress: {
            Line1: a.street,
            City: a.city,
            PostCode: a.postalCode || "",
            CountryCode: countryCode(a.country),
          },
          Contact: {
            PersonName: a.fullName,
            CompanyName: a.fullName,
            PhoneNumber1: a.phone,
            CellPhone: a.phone,
            EmailAddress: email || env("ARAMEX_SHIPPER_EMAIL"),
          },
        },
        ShippingDateTime: aramexDate(now + 2 * 60 * 60 * 1000),
        DueDate: aramexDate(now + 3 * 24 * 60 * 60 * 1000),
        Details: {
          ActualWeight: { Unit: "KG", Value: weight },
          ChargeableWeight: { Unit: "KG", Value: weight },
          DescriptionOfGoods: `Order ${order.orderNumber}`,
          GoodsOriginCountry: env("ARAMEX_ACCOUNT_COUNTRY", "EG"),
          NumberOfPieces: 1,
          ProductGroup: env("ARAMEX_PRODUCT_GROUP", "DOM"),
          ProductType: env("ARAMEX_PRODUCT_TYPE", "ONP"),
          PaymentType: "P", // you pay Aramex's fee
          Services: isCod ? "CODS" : "", // cash on delivery
          CashOnDeliveryAmount: {
            CurrencyCode: order.currency,
            Value: isCod ? round2(order.totalPrice) : 0,
          },
        },
      },
    ],
    Transaction: { Reference1: order.orderNumber },
  };

  const json = await post("/Shipping/Service_1_0.svc/json/CreateShipments", payload);

  const shipment = json.Shipments?.[0];
  if (json.HasErrors || shipment?.HasErrors || !shipment?.ID) {
    throw new Error(problems(json) || "Aramex did not accept the shipment");
  }

  return {
    trackingNumber: String(shipment.ID),
    labelUrl: shipment.ShipmentLabel?.LabelURL ? String(shipment.ShipmentLabel.LabelURL) : "",
  };
}

/* ---------- Tracking ---------- */

// Returns a Map of tracking number -> { code, text, at, location } for its latest update
export async function trackShipments(trackingNumbers) {
  const json = await post("/Tracking/Service_1_0.svc/json/TrackShipments", {
    ClientInfo: clientInfo(),
    GetLastTrackingUpdateOnly: false,
    Shipments: trackingNumbers,
    Transaction: { Reference1: "" },
  });

  const results = json.TrackingResults ?? [];
  if (json.HasErrors && results.length === 0) {
    throw new Error(problems(json) || "Aramex tracking failed");
  }

  const latest = new Map();
  for (const result of results) {
    const updates = (result.Value ?? [])
      .map((u) => ({
        code: String(u.UpdateCode ?? ""),
        text: String(u.UpdateDescription ?? ""),
        at: parseDate(u.UpdateDateTime),
        location: String(u.UpdateLocation ?? ""),
      }))
      .sort((x, y) => (y.at?.getTime() ?? 0) - (x.at?.getTime() ?? 0));

    if (updates[0]) latest.set(String(result.Key), updates[0]);
  }
  return latest;
}