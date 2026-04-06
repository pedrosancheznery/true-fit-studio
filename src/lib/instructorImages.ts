import { supabaseAdmin } from '@/lib/serverSupabase';

export const INSTRUCTOR_IMAGE_BUCKET = 'instructor-images';

type UploadInstructorImageInput = {
  imageDataUrl: string;
  instructorId: string;
};

export async function getInstructorImageUrlMap(instructorIds: string[]) {
  if (instructorIds.length === 0) {
    return new Map<string, string>();
  }

  await ensureInstructorImageBucket();

  const imageEntries = await Promise.all(
    instructorIds.map(async (instructorId) => {
      const imagePath = await getLatestInstructorImagePath(instructorId);
      if (!imagePath) {
        return null;
      }

      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from(INSTRUCTOR_IMAGE_BUCKET).getPublicUrl(imagePath);

      return [instructorId, publicUrl] as const;
    })
  );

  return new Map(
    imageEntries.filter((entry): entry is readonly [string, string] => entry !== null)
  );
}

export async function uploadInstructorImage({
  imageDataUrl,
  instructorId,
}: UploadInstructorImageInput) {
  await ensureInstructorImageBucket();

  const { contentType, fileBuffer, fileExtension } = parseDataUrl(imageDataUrl);
  const fileName = `${Date.now()}.${fileExtension}`;
  const filePath = `${instructorId}/${fileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(INSTRUCTOR_IMAGE_BUCKET)
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  await deleteOlderInstructorImages(instructorId, fileName);

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(INSTRUCTOR_IMAGE_BUCKET).getPublicUrl(filePath);

  return {
    filePath,
    publicUrl,
  };
}

async function ensureInstructorImageBucket() {
  const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
  if (bucketsError) {
    throw new Error(`Could not list storage buckets: ${bucketsError.message}`);
  }

  const existingBucket = buckets.find((bucket) => bucket.name === INSTRUCTOR_IMAGE_BUCKET);
  if (!existingBucket) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(
      INSTRUCTOR_IMAGE_BUCKET,
      {
        public: true,
      }
    );

    if (createError) {
      throw new Error(`Could not create image bucket: ${createError.message}`);
    }

    return;
  }

  if (!existingBucket.public) {
    const { error: updateError } = await supabaseAdmin.storage.updateBucket(
      INSTRUCTOR_IMAGE_BUCKET,
      {
        public: true,
      }
    );

    if (updateError) {
      throw new Error(`Could not update image bucket visibility: ${updateError.message}`);
    }
  }
}

async function getLatestInstructorImagePath(instructorId: string) {
  const { data: files, error } = await supabaseAdmin.storage
    .from(INSTRUCTOR_IMAGE_BUCKET)
    .list(instructorId, {
      limit: 1,
      sortBy: { column: 'name', order: 'desc' },
    });

  if (error) {
    throw new Error(`Could not list instructor images: ${error.message}`);
  }

  if (!files || files.length === 0) {
    return null;
  }

  return `${instructorId}/${files[0].name}`;
}

async function deleteOlderInstructorImages(instructorId: string, currentFileName: string) {
  const { data: files, error } = await supabaseAdmin.storage
    .from(INSTRUCTOR_IMAGE_BUCKET)
    .list(instructorId, {
      limit: 100,
      sortBy: { column: 'name', order: 'desc' },
    });

  if (error || !files || files.length <= 1) {
    return;
  }

  const pathsToDelete = files
    .filter((file) => file.name !== currentFileName)
    .map((file) => `${instructorId}/${file.name}`);

  if (pathsToDelete.length === 0) {
    return;
  }

  await supabaseAdmin.storage.from(INSTRUCTOR_IMAGE_BUCKET).remove(pathsToDelete);
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Image must be a valid base64-encoded data URL.');
  }

  const [, contentType, base64Data] = match;
  const fileExtension = inferFileExtension(contentType);

  return {
    contentType,
    fileBuffer: Buffer.from(base64Data, 'base64'),
    fileExtension,
  };
}

function inferFileExtension(contentType: string) {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      throw new Error('Unsupported image type. Use JPG, PNG, WEBP, or GIF.');
  }
}
