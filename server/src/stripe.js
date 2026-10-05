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
 * TEK FİYAT: ilk `lifetimeLimit` (1000) kişi için ömür boyu tek seferlik ödeme.
 * Sınır dolduğunda üyelik SATIŞI KAPANIR — aylık plana geçilmez: kullanıcıya
 * yanlış beklenti verip sonra geri çekmektense, kapıyı açıkça kapatıyoruz.
 * Kampanya bitince `SOLDOUT` döner ve rota 409 döner.
 */
export function planFor(lifetimeMemberCount, opts = pricing) {
  if (lifetimeMemberCount < opts.lifetimeLimit) {
    return {
      plan: "LIFETIME",
      mode: "payment",
      amountCents: opts.lifetimeCents,
      priceId: stripeConfig.priceLifetime,
      currency: opts.currency,
      soldOut: false,
      remaining: opts.lifetimeLimit - lifetimeMemberCount
    };
  }
  return {
    plan: "LIFETIME",
    mode: "payment",
    amountCents: opts.lifetimeCents,
    priceId: stripeConfig.priceLifetime,
    currency: opts.currency,
    soldOut: true,
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