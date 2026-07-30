import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function createPreAuth(amount: number, currency: string, metadata: Record<string, string>) {
  return await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: currency.toLowerCase(),
    capture_method: "manual",
    metadata,
    automatic_payment_methods: { enabled: true },
  });
}

export async function capturePreAuth(paymentIntentId: string) {
  return await stripe.paymentIntents.capture(paymentIntentId);
}

export async function releasePreAuth(paymentIntentId: string) {
  return await stripe.paymentIntents.cancel(paymentIntentId);
}
