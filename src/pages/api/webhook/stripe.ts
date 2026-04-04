import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2022-11-15" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

import getRawBody from "raw-body";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const buf = await getRawBody(req);
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed.", err);
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const classId = session.metadata?.classId;
    const userId = session.metadata?.userId;
    const paymentIntent = session.payment_intent as string;

    if (classId && userId) {
      // insert booking row (adjust column names)
      const { error } = await supabase.from("bookings").insert([{
        class_id: classId,
        user_id: userId,
        stripe_payment_intent: paymentIntent,
        status: "confirmed",
        booked_at: new Date().toISOString(),
      }]);
      if (error) console.error("Supabase insert error:", error);
    }
  }

  res.status(200).json({ received: true });
}
