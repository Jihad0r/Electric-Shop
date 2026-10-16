export type DiscountType = "percent" | "fixed";

export type Offer = {
  _id: string;
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  applyToAll: boolean;
  products: string[]; // product ids
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  showOnHome: boolean;
  createdAt: string;
};

export type OfferState = "active" | "scheduled" | "expired" | "paused";

export function offerState(offer: Offer, now: number = Date.now()): OfferState {
  if (!offer.isActive) return "paused";
  if (offer.startsAt && new Date(offer.startsAt).getTime() > now) return "scheduled";
  if (offer.endsAt && new Date(offer.endsAt).getTime() < now) return "expired";
  return "active";
}