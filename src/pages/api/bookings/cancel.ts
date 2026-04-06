import { supabaseAdmin } from '@/lib/serverSupabase';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { bookingId } = req.body;
  if (!bookingId) {
    return res.status(400).json({ error: 'Missing bookingId' });
  }

  const authToken = req.headers.authorization?.split('Bearer ')[1];
  if (!authToken) {
    return res.status(401).json({ error: 'Sign in to manage bookings.' });
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(authToken);

  if (authError || !user) {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }

  const { data: booking, error: fetchError } = await supabaseAdmin
    .from('bookings')
    .select('id, user_id, status')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (booking.user_id !== user.id) {
    return res.status(403).json({ error: 'You can only cancel your own bookings.' });
  }

  if (booking.status === 'cancelled') {
    return res.status(400).json({ error: 'Already cancelled' });
  }

  const { error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'cancelled', paid: false })
    .eq('id', bookingId);

  if (updateError) {
    console.error('Cancellation Error:', updateError.message);
    return res.status(500).json({ error: 'Failed to cancel booking' });
  }

  return res.status(200).json({ success: true, simulatedRefund: true });
}
