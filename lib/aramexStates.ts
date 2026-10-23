// Aramex describes each tracking update with a code and a text.
// VERIFY these against Aramex's documentation. Every update received is logged
// to your terminal ("Aramex update:") so you can see the real codes.
export const ARAMEX_DELIVERED_CODES = ["SH005"];
export const ARAMEX_RETURNED_CODES: string[] = []; // ask Aramex for the codes your account uses

export type TrackingOutcome = "delivered" | "returned" | "other";

export function classifyUpdate(code: string, text: string): TrackingOutcome {
  const t = text.trim().toLowerCase();

  // "Delivered" counts, but "delivery attempted" and "not delivered" don't
  const looksDelivered = /^(shipment\s+)?delivered\b/.test(t) && !/not delivered|attempt/.test(t);
  if (ARAMEX_DELIVERED_CODES.includes(code) || looksDelivered) return "delivered";

  const looksReturned = /return(ed)?\s+to\s+(shipper|client|sender|origin)/.test(t);
  if (ARAMEX_RETURNED_CODES.includes(code) || looksReturned) return "returned";

  return "other";
}

// Aramex's public tracking page. Check this link opens the right page.
export function aramexTrackUrl(trackingNumber: string): string {
  return `https://www.aramex.com/track/results?ShipmentNumber=${encodeURIComponent(trackingNumber)}`;
}