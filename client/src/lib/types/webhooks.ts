// src/api/webhooks.ts
import { Request, Response } from "express";
import Stripe from "stripe";
import { storage } from "../../../../server/storage";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-08-16'
});
// Ensure your storage types include this or adjust below logic accordingly
export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  status: "active" | "canceled";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  postsUsed: number;
  canceledAt?: Date;
}
// Allow these fields in the update
type SubscriptionUpdateInput = {
  status?: "active" | "canceled";
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  postsUsed?: number;
  canceledAt?: Date;
};
export const handleStripeWebhook = async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];

  if (!signature || Array.isArray(signature)) {
    return res.status(400).json({ error: "Missing or invalid Stripe signature" });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("❌ STRIPE_WEBHOOK_SECRET not set.");
    return res.status(500).json({ error: "Server configuration error" });
  }

  let event: Stripe.Event;

  try {
    // Stripe requires raw body for signature validation
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("⚠️ Stripe signature verification failed:", err);
    return res.status(400).json({ error: "Invalid Stripe signature" });
  }

  try {
    switch (event.type) {
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;

        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

        if (!subscriptionId) break;

        const subscription = await storage.getSubscriptionByStripeId(subscriptionId);

        if (subscription) {
          await storage.updateSubscription(subscription.id, {
            currentPeriodStart: new Date(invoice.period_start * 1000),
  currentPeriodEnd: new Date(invoice.period_end * 1000),
  postsUsed: 0,
  status: "active",
          } as any);
        }

        break;
      }

      case "customer.subscription.deleted": {
        const stripeSubscription = event.data.object as Stripe.Subscription;

        const subscription = await storage.getSubscriptionByStripeId(stripeSubscription.id);

        if (subscription) {
          // If your storage interface supports `canceledAt`
          await storage.updateSubscription(subscription.id, {
            status: "canceled",
            ...(subscription.hasOwnProperty("canceledAt") && {
              canceledAt: new Date(),
            }),
          });
        }

        break;
      }

      case "customer.subscription.updated": {
        // Optional future use
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("❌ Webhook handler error:", error);
    return res.status(500).json({ error: "Internal webhook error" });
  }
};
