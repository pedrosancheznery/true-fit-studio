import { defineConfig } from 'sanity';
import { deskTool } from 'sanity/desk'; // or 'structureTool' for newer versions
import { visionTool } from '@sanity/vision';
import { schemaTypes } from './sanity/schemaTypes';

export default defineConfig({
  name: 'default',
  title: 'Fitness Studio Admin',
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  basePath: '/studio', // This MUST match your folder path in step 3
  plugins: [deskTool(), visionTool()],
  schema: {
    types: schemaTypes,
  },
});
