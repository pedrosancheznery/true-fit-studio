import { buffer } from 'micro';
import type { NextApiRequest } from 'next';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/serverSupabase';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2022-11-15' });

export default async function handler(req: NextApiRequest, res: any) {
  const sig = req.headers['stripe-signature'] as string | undefined;
  const buf = await buffer(req);
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(buf.toString(), sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.booking_id;
    if (bookingId) {
      await supabaseAdmin.from('bookings').update({ status: 'booked', paid: true }).eq('id', bookingId);
    }
  }

  res.json({ received: true });
}
