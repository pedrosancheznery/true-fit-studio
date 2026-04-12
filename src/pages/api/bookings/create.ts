// pages/api/bookings/create.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabaseClient'; // Or createClient
import { sendEmail } from '@/lib/email'; // Mailgun utility

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { instanceId, to: encodedTo } = req.body;
  if (!instanceId || !encodedTo) {
    return res.status(400).json({ error: 'instanceId and to are required' });
  }

  const to = decodeURIComponent(encodedTo);
  if (!to.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  // Step 1: Fetch instance details (date, FK, and cancellation status)
  const { data: instance, error: fetchInstanceError } = await supabase
    .from('class_instances')
    .select('date, class_id, is_cancelled')
    .eq('id', instanceId)
    .single();

  if (fetchInstanceError || !instance) {
    return res.status(404).json({ error: 'Instance not found' });
  }

  if (instance.is_cancelled) {
    return res.status(400).json({ error: 'Instance is cancelled' });
  }

  // Step 2: Fetch class details separately for clean access
  const { data: theClass, error: fetchClassError } = await supabase
    .from('classes')
    .select('title')
    .eq('id', instance.class_id)
    .single();

  if (fetchClassError || !theClass) {
    return res.status(404).json({ error: 'Related class not found' });
  }

  // Optional: If you want to verify a booking already exists, add a check here
  // const { data: existingBooking } = await supabase.from('bookings').select('*').eq('class_instance_id', instanceId).eq('...user check...').single();
  // if (!existingBooking) return res.status(400).json({ error: 'No matching booking found' });

  // Step 3: Build and send email (now with error-free access: theClass.title)
  try {
    await sendEmail(
      to,
      'Booking Confirmed',
      `
        <h1>Booking Confirmation</h1>
        <p>Your reservation for <strong>${theClass.title}</strong> on ${new Date(instance.date).toLocaleDateString()} has been confirmed!</p>
        <p>Please arrive 10 minutes early. Bring water and enthusiasm!</p>
        <p>If you need to cancel, do so via your dashboard.</p>
        <p>See you soon—stay fit!</p>
        <p>Fitness Studio Team</p>
      `
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Email send failed:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
}