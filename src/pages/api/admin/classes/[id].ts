import type { NextApiRequest, NextApiResponse } from 'next';

import { requireAdminApiUser } from '@/lib/requireAdminApiUser';
import { supabaseAdmin } from '@/lib/serverSupabase';

type UpdateClassBody = {
  capacity?: number | string;
  description?: string;
  duration?: number | string;
  instructorId?: string;
  startTime?: string;
  stripePriceId?: string;
  title?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PATCH') {
    return res.status(405).end();
  }

  const adminUser = await requireAdminApiUser(req, res);
  if (!adminUser) {
    return;
  }

  const classId = readQueryValue(req.query.id);
  if (!classId) {
    return res.status(400).json({ error: 'Missing class id.' });
  }

  const body = (req.body ?? {}) as UpdateClassBody;
  const title = body.title?.trim() ?? '';
  const description = body.description?.trim() ?? '';
  const startTime = body.startTime?.trim() ?? '';
  const instructorId = body.instructorId?.trim() ?? '';
  const stripePriceId = body.stripePriceId?.trim() ?? '';
  const capacity = parsePositiveInteger(body.capacity);
  const duration = parsePositiveInteger(body.duration);

  if (!title) {
    return res.status(400).json({ error: 'Class title is required.' });
  }

  if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
    return res.status(400).json({ error: 'Start time must use the HH:mm format.' });
  }

  if (!capacity) {
    return res.status(400).json({ error: 'Capacity must be a positive number.' });
  }

  if (!duration) {
    return res.status(400).json({ error: 'Duration must be a positive number of minutes.' });
  }

  const { data: existingClass, error: fetchError } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', classId)
    .maybeSingle();

  if (fetchError || !existingClass) {
    return res.status(404).json({ error: 'Class not found.' });
  }

  if (instructorId) {
    const { data: instructor, error: instructorError } = await supabaseAdmin
      .from('instructors')
      .select('id')
      .eq('id', instructorId)
      .maybeSingle();

    if (instructorError || !instructor) {
      return res.status(400).json({ error: 'Choose a valid instructor or leave it unassigned.' });
    }
  }

  const { data: workoutClass, error: updateError } = await supabaseAdmin
    .from('classes')
    .update({
      capacity,
      description: description || null,
      duration,
      instructor_id: instructorId || null,
      startTime,
      stripePriceId: stripePriceId || null,
      title,
    })
    .eq('id', classId)
    .select(`
      id,
      title,
      description,
      capacity,
      duration,
      startTime,
      day_of_week,
      stripePriceId,
      instructor_id
    `)
    .single();

  if (updateError || !workoutClass) {
    console.error('Failed to update class:', updateError?.message ?? 'Unknown error');
    return res.status(500).json({ error: 'Unable to update the class right now.' });
  }

  return res.status(200).json({
    class: workoutClass,
    message: `Class "${workoutClass.title}" updated.`,
  });
}

function parsePositiveInteger(value: number | string | undefined) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
