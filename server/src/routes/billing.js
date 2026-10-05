import express from "express";
import { prisma } from "../db.js";
import { isMember, requireAuth } from "../auth.js";
import { constructEvent, getStripe, planFor, stripeConfigured } from "../stripe.js";
import { config, pricing } from "../config.js";

const router = express.Router();

/** İstemciden gelen dönüş adresi yalnız beyaz listedeki origin'lerden kabul edilir. */
export function safeReturnUrl(raw) {
  const fallback = config.appOrigins[0] || "";
  if (!raw) return fallback;
  try {
    const url = new URL(String(raw));
    return config.appOrigins.includes(url.origin) ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

async function countLifetimeMembers() {
  return prisma.membership.count({ where: { plan: "LIFETIME", status: "ACTIVE" } });
}

/**
 * Ödeme başarısını üyelik olarak işler. `providerRef` benzersiz olduğu için
 * webhook'un iki kez gelmesi veya `verify` ile elle çağrılması ikinci bir
 * üyelik/ödeme kaydı oluşturmaz.
 */
export async function grantMembershipFromCheckout(session) {
  const userId = session?.metadata?.userId;
  if (!userId) return { skipped: "no_user" };
  const existing = await prisma.payment.findUnique({ where: { providerRef: session.id } });
  if (existing) return { skipped: "already_processed", paymentId: existing.id };

  const amount = session.amount_total ?? 0;
  const currency = session.currency || pricing.currency;

  if (session.mode === "subscription") {
    await prisma.payment.create({
      data: { userId, providerRef: session.id, kind: "SUBSCRIPTION", amountCents: amount, currency, raw: session }
    });
    await prisma.membership.upsert({
      where: { userId },
      create: {
        userId,
        plan: "MONTHLY",
        status: "ACTIVE",
        priceCents: pricing.monthlyCents,
        currency,
        stripeCustomerId: session.customer ? String(session.customer) : null,
        stripeSessionId: session.id,
        stripeSubscriptionId: session.subscription ? String(session.subscription) : null,
        currentPeriodEnd: null
      },
      update: {
        plan: "MONTHLY",
        status: "ACTIVE",
        stripeCustomerId: session.customer ? String(session.customer) : null,
        stripeSubscriptionId: session.subscription ? String(session.subscription) : null,
        stripeSessionId: session.id
      }
    });
    return { plan: "MONTHLY" };
  }

  await prisma.payment.create({
    data: { userId, providerRef: session.id, kind: "LIFETIME", amountCents: amount, currency, raw: session }
  });
  await prisma.membership.upsert({
    where: { userId },
    create: {
      userId,
      plan: "LIFETIME",
      status: "ACTIVE",
      priceCents: pricing.lifetimeCents,
      currency,
      stripeCustomerId: session.customer ? String(session.customer) : null,
      stripeSessionId: session.id,
      lifetimeAt: new Date()
    },
    update: { plan: "LIFETIME", status: "ACTIVE", lifetimeAt: new Date(), stripeSessionId: session.id }
  });
  return { plan: "LIFETIME" };
}

/** POST /api/billing/checkout — fiyat ve plan yalnızca sunucuda belirlenir. */
router.post("/checkout", requireAuth, async (req, res, next) => {
  try {
    if (isMember(req.user)) return res.status(409).json({ error: "already_member" });
    if (!stripeConfigured()) {
      return res.status(503).json({ error: "stripe_not_configured", message: "Ödeme altyapısı henüz yapılandırılmamış." });
    }
    const decision = planFor(await countLifetimeMembers());
    if (!decision.priceId) {
      return res.status(503).json({
        error: "stripe_price_missing",
        message: `Stripe ${decision.plan} fiyatı tanımlı değil (STRIPE_PRICE_${decision.plan}).`
      });
    }
    const returnUrl = safeReturnUrl(req.body?.returnUrl);
    const session = await getStripe().checkout.sessions.create({
      mode: decision.mode,
      line_items: [{ price: decision.priceId, quantity: 1 }],
      client_reference_id: req.user.id,
      customer_email: req.user.email,
      metadata: { userId: req.user.id, plan: decision.plan },
      success_url: `${returnUrl}/?pay=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}/?pay=cancel`
    });
    res.json({ url: session.url, plan: decision.plan, amountCents: decision.amountCents, currency: decision.currency });
  } catch (e) {
    next(e);
  }
});

/** POST /api/billing/portal — Stripe müşteri portalı. */
router.post("/portal", requireAuth, async (req, res, next) => {
  try {
    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ error: "stripe_not_configured" });
    const customerId = req.user.membership?.stripeCustomerId;
    if (!customerId) return res.status(400).json({ error: "no_customer" });
    const returnUrl = safeReturnUrl(req.body?.returnUrl);
    const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
    res.json({ url: session.url });
  } catch (e) {
    next(e);
  }
});

/** POST /api/billing/verify — webhook ulaşmazsa sunucu tarafı doğrulama. */
router.post("/verify", requireAuth, async (req, res, next) => {
  try {
    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ error: "stripe_not_configured" });
    const sessionId = String(req.body?.sessionId || "");
    if (!sessionId) return res.status(400).json({ error: "missing_session_id" });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.userId !== req.user.id) return res.status(403).json({ error: "forbidden" });
    if (session.payment_status !== "paid") return res.json({ paid: false, status: session.status });
    const result = await grantMembershipFromCheckout(session);
    res.json({ paid: true, ...result });
  } catch (e) {
    next(e);
  }
});

/** POST /api/webhooks/stripe — ham gövde + imza doğrulaması. */
export async function handleWebhook(req, res) {
  let event;
  try {
    event = constructEvent(req.body, req.get("stripe-signature"));
  } catch (e) {
    return res.status(400).json({ error: "invalid_signature", message: e.message });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        if (event.data.object.payment_status === "paid" || event.data.object.mode === "subscription") {
          await grantMembershipFromCheckout(event.data.object);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const membership = await prisma.membership.findFirst({ where: { stripeSubscriptionId: String(sub.id) } });
        if (membership) {
          await prisma.membership.update({
            where: { id: membership.id },
            data: {
              status: event.type === "customer.subscription.deleted" ? "CANCELED" : "ACTIVE",
              currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : membership.currentPeriodEnd
            }
          });
        }
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (e) {
    res.status(500).json({ error: "webhook_failed", message: e.message });
  }
}

export default router;