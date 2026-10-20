import crypto from "crypto";

const BASE_URL = "https://accept.paymob.com";

function integrationId(method) {
  if (method === "card") return Number(process.env.PAYMOB_INTEGRATION_CARD);
  if (method === "wallet") return Number(process.env.PAYMOB_INTEGRATION_WALLET);
  return NaN;
}

// A method is offered only when its integration ID and all the keys are set
function configured(method) {
  return Boolean(
    integrationId(method) &&
      process.env.PAYMOB_SECRET_KEY &&
      process.env.PAYMOB_PUBLIC_KEY &&
      process.env.PAYMOB_HMAC_SECRET
  );
}

export const isOnlineAvailable = configured;

export function availableMethods() {
  const methods = ["cod"];
  if (configured("card")) methods.push("card");
  if (configured("wallet")) methods.push("wallet");
  return methods;
}

// Creates a payment (an "intention"). Amounts are in cents/piasters.
export async function createIntention({ order, user, attempt }) {
  const id = integrationId(order.paymentMethod);
  if (!id) throw new Error(`No Paymob integration for "${order.paymentMethod}"`);

  const amount = Math.round(order.totalPrice * 100);
  const [firstName, ...rest] = order.shippingAddress.fullName.trim().split(/\s+/);

  const res = await fetch(`${BASE_URL}/v1/intention/`, {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.PAYMOB_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: order.currency,
      payment_methods: [id],
      // One line for the whole order, so the items always add up to the amount
      items: [
        {
          name: `Order ${order.orderNumber}`,
          amount,
          description: `Order ${order.orderNumber}`,
          quantity: 1,
        },
      ],
      billing_data: {
        first_name: firstName,
        last_name: rest.join(" ") || "NA",
        email: user.email,
        phone_number: order.shippingAddress.phone,
        street: order.shippingAddress.street,
        city: order.shippingAddress.city,
        apartment: "NA",
        floor: "NA",
        building: "NA",
        state: "NA",
        country: "NA",
      },
      // Comes back in the callback so we can find the order.
      // The attempt suffix keeps it unique when the customer retries payment.
      special_reference: `${order.orderNumber}_${attempt}`,
      notification_url: `${process.env.APP_URL}/api/paymob/webhook`,
      redirection_url: `${process.env.APP_URL}/orders/${order._id}/confirmation`,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Paymob error: ${JSON.stringify(data)}`);
  return data; // includes client_secret, id, intention_order_id
}

export function checkoutUrl(clientSecret) {
  const params = new URLSearchParams({
    publicKey: process.env.PAYMOB_PUBLIC_KEY,
    clientSecret,
  });
  return `${BASE_URL}/unifiedcheckout/?${params.toString()}`;
}

// Fields joined (in this exact order) to compute the callback's HMAC
const HMAC_FIELDS = [
  "amount_cents", "created_at", "currency", "error_occured",
  "has_parent_transaction", "id", "integration_id", "is_3d_secure",
  "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
  "is_voided", "order.id", "owner", "pending",
  "source_data.pan", "source_data.sub_type", "source_data.type", "success",
];

const get = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);

// Proves the callback really came from Paymob and wasn't changed
export function verifyHmac(obj, received) {
  if (!received || !process.env.PAYMOB_HMAC_SECRET) return false;

  const joined = HMAC_FIELDS.map((f) => String(get(obj, f) ?? "")).join("");
  const calculated = crypto
    .createHmac("sha512", process.env.PAYMOB_HMAC_SECRET)
    .update(joined)
    .digest("hex");

  const a = Buffer.from(calculated);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}