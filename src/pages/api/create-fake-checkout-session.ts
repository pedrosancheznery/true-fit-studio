import type { NextApiRequest, NextApiResponse } from 'next';

import { supabaseAdmin } from '@/lib/serverSupabase';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const authToken = req.headers.authorization?.split('Bearer ')[1];
  if (!authToken) {
    return res.status(401).json({ error: 'Sign in to book a class.' });
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(authToken);

  if (authError || !user) {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }

  const { instanceId, classId } = req.body ?? {};
  if (!instanceId || !classId) {
    return res.status(400).json({ error: 'Missing class or session details.' });
  }

  const [{ data: classInstance, error: instanceError }, { data: workoutClass, error: classError }] =
    await Promise.all([
      supabaseAdmin
        .from('class_instances')
        .select('id, class_id')
        .eq('id', instanceId)
        .eq('class_id', classId)
        .single(),
      supabaseAdmin.from('classes').select('id, capacity').eq('id', classId).single(),
    ]);

  if (instanceError || !classInstance || classError || !workoutClass) {
    return res.status(404).json({ error: 'That class session could not be found.' });
  }

  const { data: existingBooking, error: existingError } = await supabaseAdmin
    .from('bookings')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('class_instance_id', instanceId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return res.status(500).json({ error: 'Could not check your existing bookings.' });
  }

  if (existingBooking) {
    return res.status(200).json({
      url: `${baseUrl}/booking/success?booking_id=${existingBooking.id}&simulated_payment=1`,
    });
  }

  const { count, error: countError } = await supabaseAdmin
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('class_instance_id', instanceId)
    .neq('status', 'cancelled');

  if (countError) {
    return res.status(500).json({ error: 'Could not check remaining spots.' });
  }

  if (workoutClass.capacity && (count ?? 0) >= workoutClass.capacity) {
    return res.status(409).json({ error: 'This class is sold out.' });
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .insert({
      user_id: user.id,
      class_instance_id: instanceId,
      status: 'confirmed',
      paid: true,
    })
    .select('id')
    .single();

  if (bookingError || !booking) {
    return res.status(500).json({ error: 'Could not complete your booking.' });
  }

  return res.status(200).json({
    url: `${baseUrl}/booking/success?booking_id=${booking.id}&simulated_payment=1`,
  });
}
