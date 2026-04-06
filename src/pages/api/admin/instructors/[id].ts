import type { NextApiRequest, NextApiResponse } from 'next';

import { uploadInstructorImage } from '@/lib/instructorImages';
import { requireAdminApiUser } from '@/lib/requireAdminApiUser';
import { supabaseAdmin } from '@/lib/serverSupabase';

type UpdateInstructorBody = {
  bio?: string;
  imageDataUrl?: string;
  name?: string;
};

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
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

  const instructorId = readQueryValue(req.query.id);
  if (!instructorId) {
    return res.status(400).json({ error: 'Missing instructor id.' });
  }

  const body = (req.body ?? {}) as UpdateInstructorBody;
  const name = body.name?.trim() ?? '';
  const bio = body.bio?.trim() ?? '';
  const imageDataUrl = body.imageDataUrl?.trim() ?? '';

  if (!name) {
    return res.status(400).json({ error: 'Instructor name is required.' });
  }

  const { data: existingInstructor, error: fetchError } = await supabaseAdmin
    .from('instructors')
    .select('id')
    .eq('id', instructorId)
    .maybeSingle();

  if (fetchError || !existingInstructor) {
    return res.status(404).json({ error: 'Instructor not found.' });
  }

  let imageUrl: string | null = null;
  if (imageDataUrl) {
    try {
      const uploadResult = await uploadInstructorImage({
        imageDataUrl,
        instructorId,
      });
      imageUrl = uploadResult.publicUrl;
    } catch (uploadError) {
      console.error(
        'Failed to upload instructor image:',
        uploadError instanceof Error ? uploadError.message : 'Unknown error'
      );

      return res.status(500).json({
        error:
          uploadError instanceof Error
            ? uploadError.message
            : 'Instructor image upload failed.',
      });
    }
  }

  const { data: instructor, error: updateError } = await supabaseAdmin
    .from('instructors')
    .update({
      bio: bio || null,
      name,
    })
    .eq('id', instructorId)
    .select('id, name, bio')
    .single();

  if (updateError || !instructor) {
    console.error('Failed to update instructor:', updateError?.message ?? 'Unknown error');
    return res.status(500).json({ error: 'Unable to update the instructor right now.' });
  }

  return res.status(200).json({
    instructor,
    imageUrl,
    message: `Instructor "${instructor.name}" updated.`,
  });
}

function readQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
