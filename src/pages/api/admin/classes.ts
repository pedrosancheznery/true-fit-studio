import type { NextApiRequest, NextApiResponse } from 'next';

import { requireAdminApiUser } from '@/lib/requireAdminApiUser';
import { supabaseAdmin } from '@/lib/serverSupabase';

const STUDIO_DAY_VALUES = new Set(['0', '1', '2', '3', '4', '5', '6']);

type CreateClassBody = {
  capacity?: number | string;
  dayOfWeek?: string;
  description?: string;
  duration?: number | string;
  firstDate?: string;
  instructorId?: string;
  sessionCount?: number | string;
  startTime?: string;
  stripePriceId?: string;
  title?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const adminUser = await requireAdminApiUser(req, res);
  if (!adminUser) {
    return;
  }

  const body = (req.body ?? {}) as CreateClassBody;
  const title = body.title?.trim() ?? '';
  const description = body.description?.trim() ?? '';
  const startTime = body.startTime?.trim() ?? '';
  const dayOfWeek = body.dayOfWeek?.trim() ?? '';
  const firstDate = body.firstDate?.trim() ?? '';
  const instructorId = body.instructorId?.trim() ?? '';
  const stripePriceId = body.stripePriceId?.trim() ?? '';
  const capacity = parsePositiveInteger(body.capacity);
  const duration = parsePositiveInteger(body.duration);
  const sessionCount = parsePositiveInteger(body.sessionCount);

  if (!title) {
    return res.status(400).json({ error: 'Class title is required.' });
  }

  if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
    return res.status(400).json({ error: 'Start time must use the HH:mm format.' });
  }

  if (!STUDIO_DAY_VALUES.has(dayOfWeek)) {
    return res.status(400).json({ error: 'Choose a valid day of the week.' });
  }

  if (!capacity) {
    return res.status(400).json({ error: 'Capacity must be a positive number.' });
  }

  if (!duration) {
    return res.status(400).json({ error: 'Duration must be a positive number of minutes.' });
  }

  if (!sessionCount || sessionCount < 1 || sessionCount > 52) {
    return res.status(400).json({ error: 'Generate between 1 and 52 sessions.' });
  }

  if (!isIsoDate(firstDate)) {
    return res.status(400).json({ error: 'First session date must use the YYYY-MM-DD format.' });
  }

  const firstSessionDate = parseIsoDate(firstDate);
  if (!firstSessionDate) {
    return res.status(400).json({ error: 'Choose a valid first session date.' });
  }

  if (toStudioDayValue(firstSessionDate) !== dayOfWeek) {
    return res.status(400).json({
      error: 'The first session date must match the selected day of the week.',
    });
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

  const { data: workoutClass, error: classError } = await supabaseAdmin
    .from('classes')
    .insert({
      title,
      description: description || null,
      capacity,
      duration,
      startTime,
      day_of_week: dayOfWeek,
      stripePriceId: stripePriceId || null,
      instructor_id: instructorId || null,
    })
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

  if (classError || !workoutClass) {
    console.error('Failed to create class:', classError?.message ?? 'Unknown error');
    return res.status(500).json({ error: 'Unable to create the class right now.' });
  }

  const instancesToInsert = Array.from({ length: sessionCount }, (_, index) => ({
    class_id: workoutClass.id,
    date: formatIsoDate(addUtcDays(firstSessionDate, index * 7)),
    is_cancelled: false,
  }));

  const { error: instanceError } = await supabaseAdmin
    .from('class_instances')
    .insert(instancesToInsert);

  if (instanceError) {
    console.error('Failed to create class instances:', instanceError.message);
    await supabaseAdmin.from('classes').delete().eq('id', workoutClass.id);

    return res.status(500).json({
      error: 'The class was not saved because its schedule could not be generated.',
    });
  }

  return res.status(201).json({
    class: workoutClass,
    instancesCreated: instancesToInsert.length,
    message: `Created "${workoutClass.title}" with ${instancesToInsert.length} sessions.`,
  });
}

function parsePositiveInteger(value: number | string | undefined) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseIsoDate(value: string) {
  if (!isIsoDate(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(date: Date, amount: number) {
  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + amount);
  return nextDate;
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toStudioDayValue(date: Date) {
  return String((date.getUTCDay() + 1) % 7);
}
