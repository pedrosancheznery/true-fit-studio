import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/serverSupabase';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2022-11-15' });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const auth = req.headers.authorization?.split('Bearer ')[1];
  if (!auth) return res.status(401).json({ error: 'Missing token' });

  // Verify session via Supabase
  const { data: userData } = await supabaseAdmin.auth.getUser(auth).catch(() => ({ data: null }));
  if (!userData?.user) return res.status(401).json({ error: 'Invalid token' });

  const userId = userData.user.id;
  const { classId } = req.body;
  if (!classId) return res.status(400).json({ error: 'Missing classId' });

  // Check capacity
  const { data: cls } = await supabaseAdmin.from('classes').select('*').eq('id', classId).single();
  if (!cls) return res.status(404).json({ error: 'Class not found' });

  const { count } = await supabaseAdmin.from('bookings').select('*', { count: 'exact' }).eq('class_id', classId).eq('status', 'booked');
  if (cls.capacity && count != null && count >= cls.capacity) return res.status(409).json({ error: 'Class full' });

  // Insert booking
  const { data: booking } = await supabaseAdmin.from('bookings').insert({
    user_id: userId,
    class_id: classId,
    status: 'pending',
  }).select('*').single();

  // If paid class (assumes cls.price in cents)
  if (cls.price && cls.price > 0) {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', product_data: { name: cls.title }, unit_amount: cls.price }, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/members`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/book/${classId}`,
      metadata: { booking_id: booking.id },
    });
    return res.json({ checkoutUrl: session.url });
  } else {
    // Free class — mark booked
    await supabaseAdmin.from('bookings').update({ status: 'booked', paid: false }).eq('id', booking.id);
    return res.json({ success: true });
  }
}

// PSN