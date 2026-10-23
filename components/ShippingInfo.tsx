import { aramexTrackUrl } from "@/lib/aramexStates";
import { formatDate } from "@/lib/format";
import type { ShipmentInfo } from "@/types/order";

export default function ShippingInfo({
  shipment,
  admin = false,
}: {
  shipment?: ShipmentInfo | null;
  admin?: boolean;
}) {
  if (!shipment) return null;

  const { trackingNumber, courier, status, labelUrl, lastUpdateText, lastUpdateAt, lastError } =
    shipment;
  const showError = admin && Boolean(lastError) && !trackingNumber;
  if (!trackingNumber && !showError) return null;

  return (
    <section className="rounded-xl bg-gray-50 p-3 text-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Delivery</h3>

      {trackingNumber && (
        <>
          <p className="mt-1 text-gray-900">
            {courier || "Courier"} · tracking number <strong>{trackingNumber}</strong>
          </p>

          {lastUpdateText && (
            <p className="text-gray-600">
              {lastUpdateText}
              {lastUpdateAt ? ` · ${formatDate(lastUpdateAt)}` : ""}
            </p>
          )}

          {status === "returned" && admin && (
            <p className="mt-1 font-medium text-amber-700">
              Aramex reports this parcel as returned. Use &quot;Parcel returned&quot; to give the
              stock back.
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <a
              href={aramexTrackUrl(trackingNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-600 hover:underline"
            >
              Track this parcel
            </a>
            {admin && labelUrl && (
              <a
                href={labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-600 hover:underline"
              >
                Print label
              </a>
            )}
          </div>
        </>
      )}

      {showError && (
        <p role="alert" className="mt-1 text-red-700">
          Aramex couldn&apos;t create the shipment: {lastError}. Click &quot;Retry shipping&quot; to
          try again.
        </p>
      )}
    </section>
  );
}