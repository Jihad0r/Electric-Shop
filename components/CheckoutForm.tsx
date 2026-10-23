"use client";
import { useEffect, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearCart } from "@/lib/cart";
import { formatMoney } from "@/lib/format";
import { CURRENCY } from "@/lib/store";
import { useCartPricing } from "@/lib/useCartPricing";
import type { PaymentMethod } from "@/types/order";
import CityField from "@/components/CityField";

type Me = {
  id: string;
  name: string;
  phone?: string;
  address?: { street?: string; city?: string; country?: string };
};

type Access = "checking" | "guest" | "user";
type Step = 1 | 2 | 3;

type Address = {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  cityCode: string;
  postalCode: string;
  country: string;
};
type Errors = Partial<Record<keyof Address, string>>;

const STEPS = ["Address", "Payment", "Review"] as const;

const METHOD_INFO: Record<PaymentMethod, { title: string; text: string }> = {
  cod: { title: "Cash on delivery", text: "Pay in cash when your order arrives." },
    card: {
    title: "Credit or debit card",
    text: "Pay securely online. You'll go to Stripe's secure page to enter your card.",
  },
  wallet: { title: "Mobile wallet", text: "Pay online with your mobile wallet." },
};

const inputClass =
  "w-full rounded-lg border bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm";
const money = (n: number) => formatMoney(n, CURRENCY);

function validate(a: Address): Errors {
  const e: Errors = {};
  if (a.fullName.trim().length < 2) e.fullName = "Enter your full name";
  if (!/^\+?[\d\s\-()]{8,20}$/.test(a.phone.trim())) e.phone = "Enter a valid phone number";
  if (a.street.trim().length < 5) e.street = "Enter your street and building";
  if (!a.city.trim()) e.city = "Enter your city";
  if (!a.country.trim()) e.country = "Enter your country";
  return e;
}

function Input({
  id,
  label,
  error,
  ...props
}: { id: string; label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass} ${error ? "border-red-400" : "border-gray-300"}`}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

const card = "rounded-2xl bg-white p-4 text-gray-900 shadow-xl shadow-black/20 sm:p-6";

export default function CheckoutForm({ methods }: { methods: PaymentMethod[] }) {
  const router = useRouter();
  const pricing = useCartPricing();

  const [access, setAccess] = useState<Access>("checking");
  const [step, setStep] = useState<Step>(1);
  const [address, setAddress] = useState<Address>({
    fullName: "",
    cityCode: "",
    phone: "",
    street: "",
    city: "",
    postalCode: "",
    country: "Egypt",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [saveAddress, setSaveAddress] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>("cod");
  const [placing, setPlacing] = useState(false);
  const [placedId, setPlacedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Check the customer is logged in, and fill in what we already know
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          if (!cancelled) setAccess("guest");
          return;
        }
        const me: Me = await res.json();
        if (cancelled) return;

        setAddress((prev) => ({
          ...prev,
          fullName: me.name ?? "",
          phone: me.phone ?? "",
          street: me.address?.street ?? "",
          city: me.address?.city ?? "",
          country: me.address?.country || prev.country,
        }));
        setAccess("user");
      } catch {
        if (!cancelled) setAccess("guest");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const name = e.target.name as keyof Address;
    setAddress((prev) => ({ ...prev, [name]: e.target.value, cityCode: "",}));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const goToPayment = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = validate(address);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep(2);
  };

  const placeOrder = async () => {
    setError("");
    setPlacing(true);
    let redirecting = false;

    try {
      let orderId = placedId;

      // Create the order once. A retry after a failed payment start reuses it.
      if (!orderId) {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: pricing.items.map((i) => ({
              productId: i.productId,
              variantId: i.variantId,
              quantity: i.quantity,
            })),
            shippingAddress: {
              fullName: address.fullName.trim(),
              phone: address.phone.trim(),
              street: address.street.trim(),
              city: address.city.trim(),
              postalCode: address.postalCode.trim(),
              country: address.country.trim(),
            },
            paymentMethod: method,
          }),
        });
        const json = await res.json();

        if (!res.ok) {
          if (res.status === 401) setAccess("guest");
          setError(json.error || "Could not place your order. Please try again.");
          return;
        }

        orderId = json._id as string;
        setPlacedId(orderId);
        clearCart(); // the order now holds these items

        if (saveAddress) {
          fetch("/api/users/address", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: address.phone,
              street: address.street,
              city: address.city,
              country: address.country,
            }),
          }).catch(() => {});
        }
      }

      if (method === "cod") {
        redirecting = true;
        router.push(`/orders/${orderId}/confirmation`);
        return;
      }

      const payRes = await fetch(`/api/orders/${orderId}/pay`, { method: "POST" });
      const payJson = await payRes.json();

      if (!payRes.ok) {
        setError(payJson.error || "We couldn't start the payment.");
        return;
      }

      redirecting = true;
      window.location.href = payJson.checkoutUrl;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      if (!redirecting) setPlacing(false);
    }
  };

  /* ---------- Screens other than the form ---------- */

  if (access === "checking" || !pricing.hydrated) {
    return (
      <div aria-hidden="true" className={card}>
        <div className="h-7 w-48 animate-pulse rounded bg-gray-100" />
        <div className="mt-6 space-y-3">
          <div className="h-10 animate-pulse rounded bg-gray-100" />
          <div className="h-10 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  if (access === "guest") {
    return (
      <div className={`${card} mx-auto max-w-md py-10 text-center`}>
        <h1 className="text-2xl font-bold">Log in to check out</h1>
        <p className="mt-2 text-gray-500">
          Your cart is saved. Log in or create an account to place your order.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link
            href="/login?next=/checkout"
            className="rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Log in
          </Link>
          <Link
            href="/signup?next=/checkout"
            className="rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Sign up
          </Link>
        </div>
      </div>
    );
  }

  // The order exists. Either we're on the way to payment, or starting it failed.
  if (placedId) {
    return (
      <div className={`${card} mx-auto max-w-md py-10 text-center`}>
        <h1 className="text-xl font-bold">
          {error ? "Your order is saved" : method === "cod" ? "Order placed" : "Taking you to payment"}
        </h1>
        {error ? (
          <>
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Nothing has been charged. You can try the payment again.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={placeOrder}
                disabled={placing}
                className="rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {placing ? "Please wait..." : "Try payment again"}
              </button>
              <Link
                href={`/orders/${placedId}/confirmation`}
                className="rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                View order
              </Link>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-gray-500">Please don&apos;t close this page.</p>
        )}
      </div>
    );
  }

  if (pricing.items.length === 0) {
    return (
      <div className={`${card} mx-auto max-w-md py-10 text-center`}>
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-gray-500">Add something to your cart before checking out.</p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  const canPlace = !pricing.checking && !pricing.hasProblem;
  const online = method !== "cod";

  /* ---------- The checkout ---------- */

  return (
    <div>
      <h1 className="text-2xl font-bold text-white sm:text-3xl">Checkout</h1>

      {/* Steps */}
      <ol className="mt-5 grid grid-cols-3 gap-2" aria-label="Checkout steps">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step;
          const done = n < step;
          const current = n === step;
          return (
            <li key={label}>
              <button
                type="button"
                disabled={n > step}
                onClick={() => setStep(n)}
                aria-current={current ? "step" : undefined}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  current
                    ? "bg-brand-600 text-white"
                    : done
                      ? "bg-white/10 text-white hover:bg-white/20"
                      : "bg-white/5 text-slate-500"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    current ? "bg-white text-brand-700" : done ? "bg-green-500 text-white" : "bg-white/10"
                  }`}
                >
                  {done ? "✓" : n}
                </span>
                <span className="truncate">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-4">
          {/* Step 1: address */}
          {step === 1 && (
            <form onSubmit={goToPayment} noValidate className={card}>
              <h2 className="text-lg font-bold">Shipping address</h2>
              <p className="text-sm text-gray-500">Where should we deliver your order?</p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input
                    id="fullName"
                    name="fullName"
                    label="Full name"
                    autoComplete="name"
                    value={address.fullName}
                    onChange={onChange}
                    error={errors.fullName}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    label="Phone number"
                    autoComplete="tel"
                    placeholder="01000000000"
                    value={address.phone}
                    onChange={onChange}
                    error={errors.phone}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    id="street"
                    name="street"
                    label="Street and building"
                    autoComplete="street-address"
                    placeholder="12 Main St, building 3, floor 2"
                    value={address.street}
                    onChange={onChange}
                    error={errors.street}
                  />
                </div>
                <Input
                  id="city"
                  name="city"
                  label="City"
                  autoComplete="address-level2"
                  value={address.city}
                  onChange={onChange}
                  error={errors.city}
                />
                <Input
                  id="postalCode"
                  name="postalCode"
                  label="Postal code (optional)"
                  autoComplete="postal-code"
                  value={address.postalCode}
                  onChange={onChange}
                  error={errors.postalCode}
                />
                <div className="sm:col-span-2">
                  <Input
                    id="country"
                    name="country"
                    label="Country"
                    autoComplete="country-name"
                    value={address.country}
                    onChange={onChange}
                    error={errors.country}
                  />
                </div>
              </div>

              <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={saveAddress}
                  onChange={(e) => setSaveAddress(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                Save this address for next time
              </label>

              <button
                type="submit"
                className="mt-5 w-full rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white transition hover:bg-brand-700 sm:w-auto"
              >
                Continue to payment
              </button>
            </form>
          )}

          {/* Step 2: payment method */}
          {step === 2 && (
            <section className={card}>
              <h2 className="text-lg font-bold">Payment method</h2>
              <p className="text-sm text-gray-500">How would you like to pay?</p>

              <div role="radiogroup" aria-label="Payment method" className="mt-4 space-y-3">
                {methods.map((m) => (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                      method === m
                        ? "border-brand-600 bg-blue-50 ring-1 ring-brand-600"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={m}
                      checked={method === m}
                      onChange={() => setMethod(m)}
                      className="mt-1 h-4 w-4 text-blue-600"
                    />
                    <span>
                      <span className="block font-medium text-gray-900">{METHOD_INFO[m].title}</span>
                      <span className="block text-sm text-gray-500">{METHOD_INFO[m].text}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white transition hover:bg-brand-700"
                >
                  Review order
                </button>
              </div>
            </section>
          )}

          {/* Step 3: review */}
          {step === 3 && (
            <section className={card}>
              <h2 className="text-lg font-bold">Review your order</h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-gray-50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Ship to
                    </h3>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="mt-1 font-medium text-gray-900">{address.fullName}</p>
                  <p className="text-gray-600">{address.phone}</p>
                  <p className="text-gray-600">
                    {address.street}, {address.city}
                    {address.postalCode ? ` ${address.postalCode}` : ""}, {address.country}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Payment
                    </h3>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                  <p className="mt-1 font-medium text-gray-900">{METHOD_INFO[method].title}</p>
                  <p className="text-gray-600">
                    {online ? "You'll pay on the next page." : "Pay when it arrives."}
                  </p>
                </div>
              </div>

              {pricing.hasProblem && (
                <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  Some items in your cart need attention.{" "}
                  <Link href="/cart" className="font-medium underline">
                    Go to your cart
                  </Link>
                </p>
              )}
              {pricing.failed && (
                <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  We couldn&apos;t refresh prices just now. They&apos;ll be checked again when you place
                  the order.
                </p>
              )}
              {error && (
                <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={placing}
                  className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={placeOrder}
                  disabled={!canPlace || placing}
                  className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {placing
                    ? "Please wait..."
                    : online
                      ? `Continue to payment · ${money(pricing.total)}`
                      : `Place order · ${money(pricing.total)}`}
                </button>
              </div>
              {pricing.checking && (
                <p className="mt-2 text-xs text-gray-500">Checking prices and stock...</p>
              )}
            </section>
          )}
        </div>

        {/* Order summary */}
        <aside className={`${card} lg:sticky lg:top-24`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Order summary</h2>
            <Link href="/cart" className="text-xs font-medium text-brand-600 hover:underline">
              Edit cart
            </Link>
          </div>

          <ul className="mt-3 max-h-64 divide-y divide-gray-100 overflow-y-auto">
            {pricing.rows.map((r) => (
              <li key={r.item.key} className="flex gap-3 py-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                  {r.image && (
                    <Image src={r.image} alt="" fill sizes="48px" className="object-contain p-1" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-gray-900">{r.name}</p>
                  {r.label && <p className="text-xs text-brand-600">{r.label}</p>}
                  <p className="text-xs text-gray-500">
                    {r.item.quantity} × {money(r.unit)}
                  </p>
                  {r.problem && <p className="text-xs font-medium text-red-600">{r.problem}</p>}
                </div>
                {!r.problem && (
                  <p className="shrink-0 text-sm font-medium">{money(r.unit * r.item.quantity)}</p>
                )}
              </li>
            ))}
          </ul>

          <dl className="mt-3 space-y-2 border-t border-gray-200 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Subtotal</dt>
              <dd>{money(pricing.subtotal)}</dd>
            </div>
            {pricing.savings > 0 && (
              <div className="flex justify-between text-green-700">
                <dt>You save</dt>
                <dd>{money(pricing.savings)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-600">Shipping</dt>
              <dd>{pricing.shipping === 0 ? "Free" : money(pricing.shipping)}</dd>
            </div>
            {pricing.tax > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-600">Tax</dt>
                <dd>{money(pricing.tax)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-bold">
              <dt>Total</dt>
              <dd>{money(pricing.total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}