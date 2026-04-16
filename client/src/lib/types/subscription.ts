import Stripe from 'stripe';
import { Request, Response } from 'express';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-08-16'
});
// Simulated user DB update & retrieval (replace with your actual DB logic)
const userDB = {
  // userId: { subscriptionId: string }
  subscriptions: new Map<string, string>(),

  saveSubscription(userId: string, subscriptionId: string) {
    this.subscriptions.set(userId, subscriptionId);
  },

  getSubscriptionId(userId: string): string | undefined {
    return this.subscriptions.get(userId);
  }
};

export const createSubscription = async (req: Request, res: Response) => {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { priceId } = req.body;
  if (!priceId) {
    return res.status(400).json({ error: 'Missing priceId' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        }
      ],
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/canceled`,
      metadata: {
        userId: req.user.id.toString()
      }
    });

    // IMPORTANT: You should handle webhook 'checkout.session.completed' event
    // to get the subscription ID and save it for the user. 
    // This is just a placeholder example.
    // userDB.saveSubscription(req.user.id.toString(), 'subscriptionIdFromWebhook');

    return res.status(200).json({ sessionId: session.id });
  } catch (error: any) {
    console.error("Stripe subscription error:", error);
    return res.status(500).json({ error: error.message || "Failed to create subscription" });
  }
};

export const getSubscription = async (req: Request, res: Response) => {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = req.user.id.toString();
  const subscriptionId = userDB.getSubscriptionId(userId);

  if (!subscriptionId) {
    return res.status(404).json({ error: 'No subscription found for this user' });
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return res.status(200).json({ subscription });
  } catch (error: any) {
    console.error('Stripe getSubscription error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get subscription' });
  }
};
