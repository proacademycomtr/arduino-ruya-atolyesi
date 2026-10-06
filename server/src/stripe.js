import Stripe from "stripe";
import { stripeConfig, pricing } from "./config.js";

let client = null;

export function stripeConfigured() {
  return Boolean(stripeConfig.secretKey);
}

export function getStripe() {
  if (!stripeConfigured()) return null;
  if (!client) client = new Stripe(stripeConfig.secretKey);
  return client;
}

/**
 * Fiyat ve plan YALNIZCA sunucuda belirlenir; istemciden gelen fiyat yok sayılır.
 *
 * ÜÇ KADEME (v4.4.0):
 *   1. `freeLimit` kişiye kadar   → ÜCRETSİZ ömür boyu (`free: true`, fiyat 0)
 *   2. `paidLimit`'e kadar       → tek seferlik `lifetimeCents` ($1) ömür boyu
 *   3. sonrası                  → `monthlyCents` ($1/ay) aylık abonelik
 *
 * `amountCents: 0` olan kademede Stripe'a hiç uğranmaz (bkz. billing.js).
 */
export function planFor(lifetimeMemberCount, opts = pricing) {
  const used = lifetimeMemberCount;
  const base = { currency: opts.currency, soldOut: false, used };

  if (used < opts.freeLimit) {
    return {
      ...base,
      tier: "FREE",
      plan: "LIFETIME",
      mode: "payment",
      free: true,
      amountCents: 0,
      priceId: null,
      remaining: opts.freeLimit - used
    };
  }
  if (used < opts.paidLimit) {
    return {
      ...base,
      tier: "LIFETIME",
      plan: "LIFETIME",
      mode: "payment",
      free: false,
      amountCents: opts.lifetimeCents,
      priceId: stripeConfig.priceLifetime,
      remaining: opts.paidLimit - used
    };
  }
  return {
    ...base,
    tier: "MONTHLY",
    plan: "MONTHLY",
    mode: "subscription",
    free: false,
    amountCents: opts.monthlyCents,
    priceId: stripeConfig.priceMonthly,
    remaining: 0
  };
}

/** Ham gövde + imza doğrulaması. Webhook rotası express.raw() ile beslenir. */
export function constructEvent(rawBody, signature) {
  const stripe = getStripe();
  if (!stripe) throw new Error("stripe_not_configured");
  if (!stripeConfig.webhookSecret) throw new Error("stripe_webhook_secret_missing");
  return stripe.webhooks.constructEvent(rawBody, signature, stripeConfig.webhookSecret);
}