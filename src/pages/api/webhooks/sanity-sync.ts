import { buffer } from 'micro';
import type { NextApiRequest, NextApiResponse } from 'next';
import { isValidSignature, SIGNATURE_HEADER_NAME } from '@sanity/webhook';

import { supabaseAdmin } from '@/lib/serverSupabase';

export const config = {
  api: {
    bodyParser: false,
  },
};

type SanitySyncPayload = {
  _deleted?: boolean;
  _id?: string;
  _type?: 'instructor' | 'workoutClass';
  bio?: string | null;
  capacity?: number | null;
  dayOfWeek?: number | string | null;
  description?: string | null;
  instructor?: {
    _ref?: string | null;
  } | null;
  name?: string | null;
  startTime?: string | null;
  stripePriceId?: string | null;
  title?: string | null;
  duration?: number | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const secret = process.env.SANITY_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(500).json({
      message: 'Missing SANITY_WEBHOOK_SECRET.',
    });
  }

  try {
    const signature = readHeader(req.headers[SIGNATURE_HEADER_NAME]);
    if (!signature) {
      return res.status(401).json({ message: 'Missing signature' });
    }

    const rawBody = (await buffer(req)).toString('utf8');
    const validSignature = await isValidSignature(rawBody, signature, secret);

    if (!validSignature) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    await waitForEventualConsistency();

    const body = rawBody.trim()
      ? (JSON.parse(rawBody) as SanitySyncPayload)
      : null;
    const payload: SanitySyncPayload = body ?? {};
    const operation = readHeader(req.headers['sanity-operation']);
    const documentId =
      payload._id ?? readHeader(req.headers['sanity-document-id']);
    const documentType = payload._type;

    if (!documentId) {
      return res.status(400).json({ message: 'Missing document id' });
    }

    if (operation === 'delete' || payload._deleted) {
      await deleteSyncedDocument(documentId, documentType);

      return res.status(200).json({
        message: 'Delete synced',
        operation,
        documentId,
        documentType: documentType ?? 'unknown',
      });
    }

    if (documentType === 'instructor') {
      const { error } = await supabaseAdmin.from('instructors').upsert(
        {
          id: documentId,
          bio: payload.bio ?? null,
          name: payload.name ?? null,
        },
        { onConflict: 'id' }
      );

      if (error) {
        throw new Error(`Instructor sync failed: ${error.message}`);
      }
    } else if (documentType === 'workoutClass') {
      const instructorName = await findInstructorName(payload.instructor?._ref);

      const { error } = await supabaseAdmin.from('classes').upsert(
        {
          id: documentId,
          capacity: payload.capacity ?? null,
          day_of_week: toNullableString(payload.dayOfWeek),
          description: payload.description ?? null,
          duration: payload.duration ?? null,
          instructor: instructorName,
          instructor_id: payload.instructor?._ref ?? null,
          startTime: payload.startTime ?? null,
          stripePriceId: payload.stripePriceId ?? null,
          title: payload.title ?? null,
        },
        { onConflict: 'id' }
      );

      if (error) {
        throw new Error(`Class sync failed: ${error.message}`);
      }
    } else {
      return res.status(202).json({
        message: 'Document type ignored',
        documentId,
        documentType: documentType ?? 'unknown',
      });
    }

    return res.status(200).json({
      message: 'Sync complete',
      operation,
      documentId,
      documentType,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown sync error';

    return res.status(500).json({ message });
  }
}

async function deleteSyncedDocument(
  documentId: string,
  documentType?: SanitySyncPayload['_type']
) {
  if (documentType === 'instructor') {
    await removeRow('instructors', documentId);
    return;
  }

  if (documentType === 'workoutClass') {
    await removeRow('classes', documentId);
    return;
  }

  await Promise.all([
    removeRow('classes', documentId),
    removeRow('instructors', documentId),
  ]);
}

async function removeRow(table: 'classes' | 'instructors', documentId: string) {
  const { error } = await supabaseAdmin.from(table).delete().eq('id', documentId);

  if (error) {
    throw new Error(`${table} delete failed: ${error.message}`);
  }
}

function readHeader(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

async function findInstructorName(instructorId: string | null | undefined) {
  if (!instructorId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('instructors')
    .select('name')
    .eq('id', instructorId)
    .maybeSingle();

  if (error) {
    throw new Error(`Instructor lookup failed: ${error.message}`);
  }

  return data?.name ?? null;
}

function toNullableString(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value);
}

async function waitForEventualConsistency() {
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
