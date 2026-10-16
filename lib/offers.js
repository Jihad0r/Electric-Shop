import Offer from "@/models/Offer";

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Offers that are switched on and inside their date range. Call connectDB() first.
export async function getActiveOffers() {
  const now = new Date();
  return Offer.find({
    isActive: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  })
    .sort({ createdAt: -1 })
    .lean();
}

function appliesTo(offer, productId) {
  return offer.applyToAll || offer.products.some((id) => String(id) === String(productId));
}

function discountFor(offer, price) {
  const raw = offer.discountType === "percent" ? (price * offer.discountValue) / 100 : offer.discountValue;
  return round2(Math.min(Math.max(raw, 0), price));
}

// The single best offer for a product at a given unit price (offers never stack).
// Returns { offer, amount } or null.
export function bestOffer(productId, price, offers) {
  let best = null;
  for (const offer of offers) {
    if (!appliesTo(offer, productId)) continue;
    const amount = discountFor(offer, price);
    if (amount > 0 && (!best || amount > best.amount)) best = { offer, amount };
  }
  return best;
}