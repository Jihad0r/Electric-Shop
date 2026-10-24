import { getAuth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await getAuth();
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const report = {
    secretKeySet: Boolean(key),
    keyLooksLike: key.startsWith("pk_") ? "publishable key (wrong, it needs sk_...)" : /^[sr]k_test_/.test(key) ? "test key" : /^[sr]k_live_/.test(key) ? "live key" : key ? "unrecognised" : "missing",
    appUrl: process.env.APP_URL || "MISSING",
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

    const spec = await stripe.countrySpecs.retrieve(account.country);
    report.canChargeInEGP = spec.supported_payment_currencies.includes("egp");
  } catch (error) {
    report.problem = error.message;
  }

  return NextResponse.json(report);
}