import type { NextApiRequest, NextApiResponse } from 'next';

import { uploadInstructorImage } from '@/lib/instructorImages';
import { requireAdminApiUser } from '@/lib/requireAdminApiUser';
import { supabaseAdmin } from '@/lib/serverSupabase';

type CreateInstructorBody = {
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
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const adminUser = await requireAdminApiUser(req, res);
  if (!adminUser) {
    return;
  }

  const body = (req.body ?? {}) as CreateInstructorBody;
  const name = body.name?.trim() ?? '';
  const bio = body.bio?.trim() ?? '';
  const imageDataUrl = body.imageDataUrl?.trim() ?? '';

  if (!name) {
    return res.status(400).json({ error: 'Instructor name is required.' });
  }

  const { data: instructor, error } = await supabaseAdmin
    .from('instructors')
    .insert({
      name,
      bio: bio || null,
    })
    .select('id, name, bio')
    .single();

  if (error || !instructor) {
    console.error('Failed to create instructor:', error?.message ?? 'Unknown error');
    return res.status(500).json({ error: 'Unable to create the instructor right now.' });
  }

  let imageUrl: string | null = null;
  if (imageDataUrl) {
    try {
      const uploadResult = await uploadInstructorImage({
        imageDataUrl,
        instructorId: instructor.id,
      });
      imageUrl = uploadResult.publicUrl;
    } catch (uploadError) {
      console.error(
        'Failed to upload instructor image:',
        uploadError instanceof Error ? uploadError.message : 'Unknown error'
      );

      await supabaseAdmin.from('instructors').delete().eq('id', instructor.id);

      return res.status(500).json({
        error:
          uploadError instanceof Error
            ? uploadError.message
            : 'Instructor image upload failed.',
      });
    }
  }

  return res.status(201).json({
    instructor,
    imageUrl,
    message: `Instructor "${instructor.name}" created.`,
  });
}
