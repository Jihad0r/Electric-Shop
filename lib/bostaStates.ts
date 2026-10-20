// Bosta reports a parcel's progress as a number. VERIFY these against Bosta's documentation,
// or against the webhooks you receive while testing: the webhook logs every code it gets.
export const BOSTA_DELIVERED = [45];
export const BOSTA_RETURNED = [46];
export const BOSTA_TERMINATED = [48, 49];

export const BOSTA_STATE_LABELS: Record<number, string> = {
  10: "Pickup requested",
  21: "Picked up from you",
  24: "Received at Bosta warehouse",
  41: "Out for delivery",
  45: "Delivered",
  46: "Returned to you",
  47: "Delivery exception",
  48: "Terminated",
  49: "Canceled",
};

export function bostaStateLabel(code?: number): string {
  if (code === undefined || code === null) return "";
  return BOSTA_STATE_LABELS[code] ?? `Status code ${code}`;
}