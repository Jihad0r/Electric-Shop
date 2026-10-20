import { bostaStateLabel } from "@/lib/bostaStates";
import type { ShipmentInfo } from "@/types/order";

export default function ShippingInfo({
  shipment,
  admin = false,
}: {
  shipment?: ShipmentInfo | null;
  admin?: boolean;
}) {
  if (!shipment) return null;

  const { trackingNumber, courier, status, bostaState, lastError } = shipment;
  const showError = admin && Boolean(lastError) && !trackingNumber;
  if (!trackingNumber && !showError) return null;

  const trackUrl = trackingNumber
    ? `https://bosta.co/tracking-shipment/?lang=en&track_num=${encodeURIComponent(trackingNumber)}`
    : "";
  const stateLabel = bostaStateLabel(bostaState);

  return (
    <section className="rounded-xl bg-gray-50 p-3 text-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Delivery</h3>

      {trackingNumber && (
        <>
          <p className="mt-1 text-gray-900">
            {courier || "Courier"} · tracking number <strong>{trackingNumber}</strong>
          </p>
          {stateLabel && (
            <p className="text-gray-600">
              {admin ? `Bosta status: ${stateLabel}` : stateLabel}
            </p>
          )}
          {status === "returned" && admin && (
            <p className="mt-1 font-medium text-amber-700">
              Bosta reports this parcel as returned. Use &quot;Parcel returned&quot; to give the
              stock back.
            </p>
          )}
          <a
            href={trackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block font-medium text-brand-600 hover:underline"
          >
            Track this parcel
          </a>
        </>
      )}

      {showError && (
        <p role="alert" className="mt-1 text-red-700">
          Bosta couldn&apos;t create the delivery: {lastError}. Click &quot;Start shipping&quot; to
          try again.
        </p>
      )}
    </section>
  );
}