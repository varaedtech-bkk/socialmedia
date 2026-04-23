import type { Request, Response } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { storage } from "./storage";
import { isFeatureEnabled, FEATURE_KEYS } from "./feature-config";
import { notifySuperAdmin } from "./notify-super-admin";
import { db, schema } from "./db";
import { eq } from "drizzle-orm";
import { getTrialDays } from "./trial-policy";

const CHECKOUT_PRODUCT = "advance_package";
const ACCESS_REQUEST_PRODUCT = "access_request";
const STRIPE_APPROVAL_REQUIRED_DEFAULT = true;

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2023-08-16" });
}

export function advanceStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_ADVANCE_PRICE_ID?.trim() &&
      process.env.STRIPE_WEBHOOK_SECRET?.trim()
  );
}

export function getAdvanceBillingConfigStatus(): {
  checkoutAvailable: boolean;
  missingKeys: string[];
  webhookPath: string;
} {
  const required: Array<[string, string | undefined]> = [
    ["STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY?.trim()],
    ["STRIPE_ADVANCE_PRICE_ID", process.env.STRIPE_ADVANCE_PRICE_ID?.trim()],
    ["STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET?.trim()],
  ];
  const missingKeys = required.filter(([, v]) => !v).map(([k]) => k);
  return {
    checkoutAvailable: missingKeys.length === 0,
    missingKeys,
    webhookPath: "/api/webhooks/stripe",
  };
}

function advancePriceId(): string | undefined {
  return process.env.STRIPE_ADVANCE_PRICE_ID?.trim() || undefined;
}

function accessRequestPriceId(packageTier: "basic" | "advance"): string | undefined {
  if (packageTier === "advance") {
    return (
      process.env.STRIPE_ACCESS_REQUEST_ADVANCE_PRICE_ID?.trim() ||
      process.env.STRIPE_ADVANCE_PRICE_ID?.trim() ||
      undefined
    );
  }
  return process.env.STRIPE_ACCESS_REQUEST_BASIC_PRICE_ID?.trim() || undefined;
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

function parseAccessRequestIdFromSession(session: Stripe.Checkout.Session): number | null {
  const raw = session.metadata?.access_request_id;
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeStripeTimestamp(ts: number | null | undefined, fallbackMs: number): number {
  if (!ts || !Number.isFinite(ts)) return fallbackMs;
  return ts * 1000;
}

async function syncAdvanceSubscriptionRecord(params: {
  userId: number;
  stripeSubscriptionId: string;
  status: string;
  periodStartMs: number;
  periodEndMs: number;
}): Promise<void> {
  const existingByStripe = await storage.getSubscriptionByStripeId(params.stripeSubscriptionId);
  if (existingByStripe) {
    await storage.updateSubscription(existingByStripe.id, {
      status: params.status,
      postsUsed: 0,
      periodStart: params.periodStartMs,
      periodEnd: params.periodEndMs,
      stripeSubscriptionId: params.stripeSubscriptionId,
    });
    return;
  }

  const existingByUser = await storage.getUserSubscription(params.userId);
  if (existingByUser) {
    await storage.updateSubscription(existingByUser.id, {
      status: params.status,
      postsUsed: 0,
      periodStart: params.periodStartMs,
      periodEnd: params.periodEndMs,
      stripeSubscriptionId: params.stripeSubscriptionId,
    });
    return;
  }

  await storage.createSubscription({
    userId: params.userId,
    plan: "advance",
    status: params.status,
    postsUsed: 0,
    postsLimit: 0,
    periodStart: Math.floor(params.periodStartMs / 1000),
    periodEnd: Math.floor(params.periodEndMs / 1000),
    stripeSubscriptionId: params.stripeSubscriptionId,
    stripeCustomerId: "",
  });
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

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  if (subscriptionId) {
    const now = Date.now();
    try {
      await syncAdvanceSubscriptionRecord({
        userId,
        stripeSubscriptionId: subscriptionId,
        status: "active",
        periodStartMs: now,
        periodEndMs: now + 30 * 24 * 60 * 60 * 1000,
      });
    } catch (syncError) {
      console.error("[stripe] failed to sync subscription record from checkout session", syncError);
    }
  }
  await storage.updateUserPackageTier(userId, "advance");

  const requireApproval =
    (process.env.STRIPE_REQUIRE_SUPER_ADMIN_APPROVAL || "").trim().toLowerCase() === "true" ||
    ((process.env.STRIPE_REQUIRE_SUPER_ADMIN_APPROVAL || "").trim() === "" && STRIPE_APPROVAL_REQUIRED_DEFAULT);
  if (requireApproval) {
    await db
      .update(schema.users)
      .set({ isApproved: false, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  }

  const user = await storage.getUser(userId);
  const companyCtx = await storage.getUserCompanyContext(userId).catch(() => null);
  await notifySuperAdmin(
    `[Billing] Company purchase completed${requireApproval ? " (approval required)" : ""}`,
    [
      `User ID: ${userId}`,
      `Username: ${user?.username || "unknown"}`,
      `Email: ${user?.email || "unknown"}`,
      `Company: ${companyCtx?.company?.name || "N/A"}`,
      `Company ID: ${companyCtx?.company?.id || "N/A"}`,
      `Stripe customer: ${customerId || "N/A"}`,
      `Checkout session: ${session.id}`,
      requireApproval
        ? "Action: Super admin should set user isApproved=true in Admin -> Users to activate login."
        : "Action: No manual approval required (auto-approved mode).",
    ].join("\n"),
  );
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

export async function createAccessRequestCheckoutSession(params: {
  requestId: number;
  email: string;
  packageTierRequested: "basic" | "advance";
}): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
    throw new Error("Billing is not configured. Missing Stripe secret or webhook secret.");
  }
  const priceId = accessRequestPriceId(params.packageTierRequested);
  if (!priceId) {
    throw new Error(
      params.packageTierRequested === "basic"
        ? "Missing STRIPE_ACCESS_REQUEST_BASIC_PRICE_ID for Basic onboarding checkout."
        : "Missing STRIPE_ACCESS_REQUEST_ADVANCE_PRICE_ID (or STRIPE_ADVANCE_PRICE_ID) for Advance onboarding checkout.",
    );
  }

  const base = clientBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: params.email,
    success_url: `${base}/auth?request_paid=1`,
    cancel_url: `${base}/request-access?canceled=1`,
    metadata: {
      flow: ACCESS_REQUEST_PRODUCT,
      access_request_id: String(params.requestId),
      package_tier_requested: params.packageTierRequested,
      product: ACCESS_REQUEST_PRODUCT,
    },
    subscription_data: {
      trial_period_days: getTrialDays(),
      metadata: {
        flow: ACCESS_REQUEST_PRODUCT,
        access_request_id: String(params.requestId),
        package_tier_requested: params.packageTierRequested,
        product: ACCESS_REQUEST_PRODUCT,
      },
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }
  return { url: session.url, sessionId: session.id };
}

async function applyAccessRequestCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== "subscription") return;
  if (session.metadata?.flow !== ACCESS_REQUEST_PRODUCT) return;

  const requestId = parseAccessRequestIdFromSession(session);
  if (!requestId) return;

  const row = await storage.getAccessRequest(requestId);
  if (!row || row.status !== "pending") return;

  let trialEndsAt: Date | null = null;
  let paymentStatus: "pending" | "trialing" | "paid" = "pending";
  let paidAt: Date | null = null;

  const stripe = getStripe();
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  if (stripe && subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    if (sub.status === "trialing") {
      paymentStatus = "trialing";
      trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
    } else if (sub.status === "active") {
      paymentStatus = "paid";
      paidAt = new Date();
    }
  } else if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
    paymentStatus = session.payment_status === "paid" ? "paid" : "trialing";
    if (paymentStatus === "paid") paidAt = new Date();
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  await storage.updateAccessRequest(requestId, {
    paymentStatus,
    stripeCheckoutSessionId: session.id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    trialEndsAt,
    paidAt,
  });

  await notifySuperAdmin(
    `[Billing] Access request funded (${paymentStatus})`,
    [
      `Request ID: ${requestId}`,
      `Email: ${row.email}`,
      `Plan requested: ${row.packageTierRequested}`,
      `Payment status: ${paymentStatus}`,
      `Trial ends: ${trialEndsAt ? trialEndsAt.toISOString() : "N/A"}`,
      `Stripe checkout session: ${session.id}`,
      `Stripe subscription: ${subscriptionId || "N/A"}`,
      `Action: You can now approve this access request and create login credentials.`,
    ].join("\n"),
  );
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

export async function createAdvanceBillingPortalSession(req: Request, res: Response): Promise<void> {
  if (!req.isAuthenticated()) {
    res.sendStatus(401);
    return;
  }

  if (!isFeatureEnabled(FEATURE_KEYS.STRIPE_PAYMENTS_ENABLED)) {
    res.status(403).json({ error: "Stripe payments are disabled for this deployment." });
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "Stripe is not configured." });
    return;
  }

  const user = await storage.getUser(req.user!.id);
  if (!user) {
    res.sendStatus(401);
    return;
  }

  let customerId = user.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { app_user_id: String(user.id) },
    });
    customerId = customer.id;
    await storage.updateUserStripeId(user.id, customerId);
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${clientBaseUrl()}/billing`,
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error("[stripe] portal session create failed", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Could not open billing portal" });
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
        if (session.metadata?.flow === ACCESS_REQUEST_PRODUCT) {
          await applyAccessRequestCheckoutSession(session);
        } else {
          await applyAdvanceFromCheckoutSession(session);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        if (!subscriptionLooksLikeAdvance(sub)) break;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (!customerId) break;

        const users = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.stripeCustomerId, customerId))
          .limit(1);
        const targetUserId = users[0]?.id;
        if (!targetUserId) break;

        await storage.updateUserPackageTier(targetUserId, "advance");
        try {
          await syncAdvanceSubscriptionRecord({
            userId: targetUserId,
            stripeSubscriptionId: sub.id,
            status: sub.status,
            periodStartMs: normalizeStripeTimestamp(sub.current_period_start, Date.now()),
            periodEndMs: normalizeStripeTimestamp(
              sub.current_period_end,
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ),
          });
        } catch (syncError) {
          console.error("[stripe] failed to sync subscription record from subscription webhook", syncError);
        }
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
          await storage.updateSubscription(existing.id, {
            status: "canceled",
            periodStart: normalizeStripeTimestamp(sub.current_period_start, existing.periodStart),
            periodEnd: normalizeStripeTimestamp(sub.current_period_end, existing.periodEnd),
          });
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
