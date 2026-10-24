import { getAuth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { CURRENCY } from "@/lib/store";
import { NextResponse } from "next/server";

const NEEDED_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
];

export async function GET(request) {
  const auth = await getAuth();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const appUrl = String(process.env.APP_URL ?? "").trim().replace(/\/$/, "");

  const report = {
    environment: process.env.NODE_ENV,
    keyType: !key
      ? "MISSING"
      : key.startsWith("pk_")
        ? "WRONG: this is the publishable key (pk_), the secret key (sk_) is needed"
        : /^[sr]k_test_/.test(key)
          ? "test"
          : /^[sr]k_live_/.test(key)
            ? "live"
            : "unrecognised",
    appUrl: appUrl || "MISSING",
    appUrlIsLocalhost: /localhost|127\.0\.0\.1/.test(appUrl),
    appUrlIsHttps: appUrl.startsWith("https://"),
    webhookSecretSet: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  };

  try {
    const stripe = getStripe();

    const account = await stripe.accounts.retrieve();
    report.account = {
      country: account.country,
      defaultCurrency: account.default_currency,
      chargesEnabled: account.charges_enabled,
    };

    try {
      const spec = await stripe.countrySpecs.retrieve(account.country);
      report.canChargeInEGP = spec.supported_payment_currencies.includes("egp");
    } catch {
      report.canChargeInEGP = "could not check";
    }

    // Is there a webhook for THIS site, and does it listen for the right events?
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const mine = endpoints.data.find((e) => e.url === `${appUrl}/api/stripe/webhook`);
    report.webhook = mine
      ? {
          found: true,
          status: mine.status,
          missingEvents: NEEDED_EVENTS.filter(
            (ev) => !mine.enabled_events.includes(ev) && !mine.enabled_events.includes("*")
          ),
        }
      : { found: false, createThisUrl: `${appUrl}/api/stripe/webhook` };

    // Add ?test=1 to try a real payment page and close it again straight away
    if (new URL(request.url).searchParams.get("test") === "1") {
      try {
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: CURRENCY.toLowerCase(),
                unit_amount: 10000,
                product_data: { name: "Connection test" },
              },
            },
          ],
          success_url: `${appUrl}/`,
          cancel_url: `${appUrl}/`,
        });
        await stripe.checkout.sessions.expire(session.id);
        report.testPaymentPage = "OK: Stripe accepted a payment page with your settings";
      } catch (error) {
        report.testPaymentPage = `FAILED: ${error.message}`;
      }
    }
  } catch (error) {
    report.problem = error.message;
  }

  return NextResponse.json(report);
}