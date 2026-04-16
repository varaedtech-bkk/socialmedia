// src/controllers/paymentController.ts
import Stripe from "stripe";
import { storage } from "../../../server/storage";
import { Request, Response } from "express";
import { PACKAGES } from "./packages";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-08-16'
});

export const createSubscription = async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);

  try {
    const { packageId, paymentMethodId } = req.body;
    const user = req.user!;
    const selectedPackage = PACKAGES[packageId as keyof typeof PACKAGES];

    if (!selectedPackage) {
      return res.status(400).json({ error: "Invalid package selected" });
    }

    // Customer handling
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        payment_method: paymentMethodId,
        invoice_settings: { default_payment_method: paymentMethodId }
      });
      customerId = customer.id;
      await storage.updateUserStripeId(user.id, customerId);
    }

    // Type-safe subscription creation
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: createStripePriceId(selectedPackage) }],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"]
    });

    // Proper type assertion for the invoice
    const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = latestInvoice.payment_intent as Stripe.PaymentIntent;

    if (!paymentIntent?.client_secret) {
      throw new Error("Failed to retrieve payment intent");
    }

    res.json({
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
      package: selectedPackage.id
    });

    // Update user subscription in database
    await storage.updateUserSubscription(
      user.id,
      selectedPackage.id,
      0, // Initial posts used
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    );

  } catch (err) {
    console.error("Subscription error:", err);
    res.status(400).json({ 
      error: "Payment processing failed",
      details: err instanceof Error ? err.message : "Unknown error"
    });
  }
};

function createStripePriceId(pkg: typeof PACKAGES[keyof typeof PACKAGES]): string {
  return `price_${pkg.id}_${new Date().getTime()}`;
}