import type { Request, Response } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { storage } from "./storage";
import { isFeatureEnabled, FEATURE_KEYS } from "./feature-config";

const CHECKOUT_PRODUCT = "advance_package";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

export function advanceStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_ADVANCE_PRICE_ID?.trim() &&
      process.env.STRIPE_WEBHOOK_SECRET?.trim()
  );
}

function advancePriceId(): string | undefined {
  return process.env.STRIPE_ADVANCE_PRICE_ID?.trim() || undefined;
}

function clientBaseUrl(): string {
  return (process.env.CLIENT_URL || "http://localhost:9002").replace(/\/$/, "");
}

function parseUserIdFromSession(session: Stripe.Checkout.Session): number | null {
  const fromMeta = session.metadata?.app_user_id;
  if (fromMeta) {
    const n = parseInt(fromMeta, 10);
    return Number.isFinite(n) ? n : null;
  }
  const ref = session.client_reference_id;
  if (ref) {
    const n = parseInt(ref, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Apply Advance tier from a paid Checkout session (webhook + success-page fallback). */
export async function applyAdvanceFromCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== "subscription") return;
  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  ) {
    return;
  }

  const userId = parseUserIdFromSession(session);
  if (!userId) {
    console.warn("[stripe] checkout.session missing app_user_id / client_reference_id");
    return;
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  if (customerId) {
    await storage.updateUserStripeId(userId, customerId);
  }
  await storage.updateUserPackageTier(userId, "advance");
}

function subscriptionLooksLikeAdvance(sub: Stripe.Subscription): boolean {
  if (sub.metadata?.product === CHECKOUT_PRODUCT) return true;
  const priceId = advancePriceId();
  if (priceId && sub.items.data.some((item) => item.price?.id === priceId)) return true;
  return false;
}

export async function createAdvanceCheckoutSession(req: Request, res: Response): Promise<void> {
  if (!req.isAuthenticated()) {
    res.sendStatus(401);
    return;
  }

  if (!isFeatureEnabled(FEATURE_KEYS.STRIPE_PAYMENTS_ENABLED)) {
    res.status(403).json({ error: "Stripe payments are disabled for this deployment." });
    return;
  }

  const stripe = getStripe();
  const priceId = advancePriceId();
  if (!stripe || !priceId || !process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
    res.status(503).json({
      error: "Billing is not configured. Set STRIPE_SECRET_KEY, STRIPE_ADVANCE_PRICE_ID, and STRIPE_WEBHOOK_SECRET.",
    });
    return;
  }

  const user = await storage.getUser(req.user!.id);
  if (!user) {
    res.sendStatus(401);
    return;
  }

  if (user.packageTier === "advance") {
    res.status(400).json({ error: "You are already on the Advance plan." });
    return;
  }

  const base = clientBaseUrl();

  try {
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/billing?canceled=1`,
      client_reference_id: String(user.id),
      metadata: {
        app_user_id: String(user.id),
        product: CHECKOUT_PRODUCT,
      },
      subscription_data: {
        metadata: {
          app_user_id: String(user.id),
          product: CHECKOUT_PRODUCT,
        },
      },
    };

    if (user.stripeCustomerId) {
      params.customer = user.stripeCustomerId;
    } else {
      params.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(params);
    if (!session.url) {
      res.status(500).json({ error: "Stripe did not return a checkout URL." });
      return;
    }
    res.json({ url: session.url });
  } catch (e) {
    console.error("[stripe] checkout create failed", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Checkout failed" });
  }
}

export async function verifyAdvanceCheckoutSession(req: Request, res: Response): Promise<void> {
  if (!req.isAuthenticated()) {
    res.sendStatus(401);
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "Stripe is not configured." });
    return;
  }

  let sessionId: string;
  try {
    sessionId = z.string().min(10).parse(req.query.session_id);
  } catch {
    res.status(400).json({ error: "Missing or invalid session_id" });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const uid = parseUserIdFromSession(session);
    if (uid !== req.user!.id) {
      res.status(403).json({ error: "This checkout session does not belong to your account." });
      return;
    }

    if (
      session.mode === "subscription" &&
      (session.payment_status === "paid" || session.payment_status === "no_payment_required")
    ) {
      await applyAdvanceFromCheckoutSession(session);
      res.json({ ok: true, packageTier: "advance" as const });
      return;
    }

    res.json({
      ok: false,
      payment_status: session.payment_status,
      status: session.status,
    });
  } catch (e) {
    console.error("[stripe] session retrieve failed", e);
    res.status(400).json({ error: e instanceof Error ? e.message : "Invalid session" });
  }
}

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  if (!isFeatureEnabled(FEATURE_KEYS.STRIPE_PAYMENTS_ENABLED)) {
    res.status(403).json({ error: "Stripe webhooks disabled" });
    return;
  }

  const stripe = getStripe();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !whSecret) {
    res.status(500).json({ error: "Stripe webhook not configured" });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!signature || Array.isArray(signature)) {
    res.status(400).json({ error: "Missing stripe-signature" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature, whSecret);
  } catch (err) {
    console.error("[stripe] signature verification failed", err);
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await applyAdvanceFromCheckoutSession(session);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (subscriptionLooksLikeAdvance(sub)) {
          const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
          if (customerId) {
            await storage.downgradeAdvancePackageForStripeCustomer(customerId);
          }
        }
        const existing = await storage.getSubscriptionByStripeId(sub.id);
        if (existing) {
          await storage.updateSubscription(existing.id, { status: "canceled" });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;
        if (!subscriptionId) break;

        const subscription = await storage.getSubscriptionByStripeId(subscriptionId);
        if (
          subscription &&
          invoice.period_start != null &&
          invoice.period_end != null
        ) {
          await storage.updateSubscription(subscription.id, {
            periodStart: invoice.period_start * 1000,
            periodEnd: invoice.period_end * 1000,
            postsUsed: 0,
            status: "active",
          });
        }
        break;
      }

      default:
        break;
    }

    res.sendStatus(200);
  } catch (e) {
    console.error("[stripe] webhook handler error", e);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}
