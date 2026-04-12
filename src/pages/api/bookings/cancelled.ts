// pages/api/bookings/cancelled.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient'; // Or createClient
import { sendEmail } from '@/lib/email'; // Mailgun utility

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { bookingId, to: encodedTo } = req.body;
  if (!bookingId || !encodedTo) {
    return res.status(400).json({ error: 'bookingId and to are required' });
  }

  const to = decodeURIComponent(encodedTo);
  if (!to.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  // Step 1: Fetch basic booking details
  const { data: booking, error: fetchBookingError } = await supabase
    .from('bookings')
    .select('id, status, class_instance_id')
    .eq('id', bookingId)
    .single();

  if (fetchBookingError || !booking || booking.status !== 'cancelled') {
    return res.status(404).json({ error: 'Booking not found or not cancelled' });
  }

  // Step 2: Fetch instance details (date and FK)
  const { data: instance, error: fetchInstanceError } = await supabase
    .from('class_instances')
    .select('date, class_id') // Simplest select, no nest
    .eq('id', booking.class_instance_id)
    .single();

  if (fetchInstanceError || !instance) {
    return res.status(404).json({ error: 'Related instance not found' });
  }

  // Step 3: Fetch class details separately for clean access
  const { data: theClass, error: fetchClassError } = await supabase
    .from('classes')
    .select('title')
    .eq('id', instance.class_id)
    .single();

  if (fetchClassError || !theClass) {
    return res.status(404).json({ error: 'Related class not found' });
  }

  // Step 4: Build and send email (now with error-free access: theClass.title)
  try {
    await sendEmail(
      to,
      'Booking Cancelled',
      `
        <h1>Booking Cancellation Confirmed</h1>
        <p>Your reservation for <strong>${theClass.title}</strong> on ${new Date(instance.date).toLocaleDateString()} has been cancelled.</p>
        <p>If this was a paid booking, your refund is processing and should appear on your statement in 5-10 business days.</p>
        <p>Take care and book again soon!</p>
        <p>Fitness Studio Team</p>
      `
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Email send failed:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
}
