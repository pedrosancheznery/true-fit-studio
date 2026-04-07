import { NextStudio } from 'next-sanity/studio'
import { deskTool } from 'sanity/desk'
import { defineConfig } from 'sanity'
import { visionTool } from '@sanity/vision'

import { schemaTypes } from '../../../sanity/schemaTypes'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET

function isValidSanityProjectId(value: string | undefined): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(value.trim())
}

export default function StudioPage() {
  if (!isValidSanityProjectId(projectId) || !dataset?.trim()) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Sanity Studio is unavailable</h1>
        <p>
          Check <code>NEXT_PUBLIC_SANITY_PROJECT_ID</code> and <code>NEXT_PUBLIC_SANITY_DATASET</code>.
        </p>
      </main>
    )
  }

  const config = defineConfig({
    name: 'default',
    title: 'Fitness Studio Admin',
    projectId: projectId.trim(),
    dataset: dataset.trim(),
    basePath: '/studio',
    plugins: [deskTool(), visionTool()],
    schema: {
      types: schemaTypes,
    },
  })

  return (
    <div style={{ height: '100vh' }}>
      <NextStudio config={config} />
    </div>
  )
}
