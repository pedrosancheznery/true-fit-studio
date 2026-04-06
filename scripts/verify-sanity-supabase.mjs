import process from 'node:process';

import nextEnv from '@next/env';
import { createClient as createSanityClient } from '@sanity/client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const shouldSync = process.argv.includes('--sync');
const shouldPrune = process.argv.includes('--prune');

const sanityProjectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? process.env.SANITY_PROJECT_ID;
const sanityDataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ?? process.env.SANITY_DATASET;
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

assertEnv(sanityProjectId, 'NEXT_PUBLIC_SANITY_PROJECT_ID or SANITY_PROJECT_ID');
assertEnv(sanityDataset, 'NEXT_PUBLIC_SANITY_DATASET or SANITY_DATASET');
assertEnv(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
assertEnv(supabaseServiceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY');

const sanity = createSanityClient({
  projectId: sanityProjectId,
  dataset: sanityDataset,
  apiVersion: '2026-04-05',
  useCdn: false,
  token: process.env.SANITY_API_READ_TOKEN,
});

const supabase = createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const sanityInstructors = await sanity.fetch(
  `*[_type == "instructor"] | order(_createdAt asc){
    _id,
    name,
    bio
  }`
);

const sanityClasses = await sanity.fetch(
  `*[_type == "workoutClass"] | order(_createdAt asc){
    _id,
    title,
    description,
    duration,
    capacity,
    stripePriceId,
    dayOfWeek,
    startTime,
    "instructorId": instructor._ref,
    "instructorName": instructor->name
  }`
);

const [{ data: supabaseInstructors, error: instructorError }, { data: supabaseClasses, error: classError }] =
  await Promise.all([
    supabase.from('instructors').select('*').order('id', { ascending: true }),
    supabase.from('classes').select('*').order('id', { ascending: true }),
  ]);

if (instructorError) {
  throw new Error(`Failed to read Supabase instructors: ${instructorError.message}`);
}

if (classError) {
  throw new Error(`Failed to read Supabase classes: ${classError.message}`);
}

printDiff('instructors', sanityInstructors, supabaseInstructors ?? []);
printDiff('classes', sanityClasses, supabaseClasses ?? []);

if (shouldSync) {
  console.log('\nApplying upserts from Sanity to Supabase...');
  const classColumns = inferColumns(
    supabaseClasses ?? [],
    [
      'id',
      'title',
      'description',
      'instructor',
      'capacity',
      'startTime',
      'day_of_week',
      'duration',
      'stripePriceId',
      'instructor_id',
    ]
  );

  if (sanityInstructors.length > 0) {
    const { error } = await supabase.from('instructors').upsert(
      sanityInstructors.map((doc) => ({
        id: doc._id,
        bio: doc.bio ?? null,
        name: doc.name ?? null,
      })),
      { onConflict: 'id' }
    );

    if (error) {
      throw new Error(`Instructor upsert failed: ${error.message}`);
    }
  }

  if (sanityClasses.length > 0) {
    const { error } = await supabase.from('classes').upsert(
      sanityClasses.map((doc) => mapClassRow(doc, classColumns)),
      { onConflict: 'id' }
    );

    if (error) {
      throw new Error(`Class upsert failed: ${error.message}`);
    }
  }

  console.log('Upserts complete.');
}

if (shouldPrune) {
  console.log('\nRemoving Supabase rows missing from Sanity...');

  await pruneMissingRows('instructors', sanityInstructors, supabaseInstructors ?? []);
  await pruneMissingRows('classes', sanityClasses, supabaseClasses ?? []);

  console.log('Prune complete.');
}

function assertEnv(value, name) {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
}

function printDiff(label, sanityDocs, supabaseRows) {
  const sanityIds = new Set(sanityDocs.map((doc) => doc._id));
  const supabaseIds = new Set(supabaseRows.map((row) => row.id));

  const missingInSupabase = [...sanityIds].filter((id) => !supabaseIds.has(id));
  const missingInSanity = [...supabaseIds].filter((id) => !sanityIds.has(id));

  console.log(`\n${label.toUpperCase()}`);
  console.log(`  Sanity:   ${sanityDocs.length}`);
  console.log(`  Supabase: ${supabaseRows.length}`);
  console.log(`  Missing in Supabase: ${missingInSupabase.length}`);
  if (missingInSupabase.length > 0) {
    console.log(`    ${missingInSupabase.join(', ')}`);
  }
  console.log(`  Missing in Sanity:   ${missingInSanity.length}`);
  if (missingInSanity.length > 0) {
    console.log(`    ${missingInSanity.join(', ')}`);
  }
}

function inferColumns(rows, fallbackColumns) {
  if (rows.length === 0) {
    return new Set(fallbackColumns);
  }

  return new Set(Object.keys(rows[0]));
}

function mapClassRow(doc, classColumns) {
  const row = {
    id: doc._id,
    title: doc.title ?? null,
    description: doc.description ?? null,
    capacity: doc.capacity ?? null,
    duration: doc.duration ?? null,
  };

  if (classColumns.has('instructor')) {
    row.instructor = doc.instructorName ?? null;
  }

  if (classColumns.has('instructor_id')) {
    row.instructor_id = doc.instructorId ?? null;
  }

  if (classColumns.has('day_of_week')) {
    row.day_of_week = toNullableString(doc.dayOfWeek);
  }

  if (classColumns.has('startTime')) {
    row.startTime = doc.startTime ?? null;
  }

  if (classColumns.has('start_time')) {
    row.start_time = doc.startTime ?? null;
  }

  if (classColumns.has('stripePriceId')) {
    row.stripePriceId = doc.stripePriceId ?? null;
  }

  if (classColumns.has('stripe_price_id')) {
    row.stripe_price_id = doc.stripePriceId ?? null;
  }

  return row;
}

async function pruneMissingRows(table, sanityDocs, supabaseRows) {
  const sanityIds = new Set(sanityDocs.map((doc) => doc._id));
  const idsToDelete = supabaseRows
    .map((row) => row.id)
    .filter((id) => !sanityIds.has(id));

  if (idsToDelete.length === 0) {
    return;
  }

  const { error } = await supabase.from(table).delete().in('id', idsToDelete);

  if (error) {
    throw new Error(`${table} prune failed: ${error.message}`);
  }
}

function toNullableString(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value);
}
