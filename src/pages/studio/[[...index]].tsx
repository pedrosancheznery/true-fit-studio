import { NextStudio } from 'next-sanity/studio'
import config from '../../../sanity.config' // Adjust path to find your sanity.config.ts

export default function StudioPage() {
  return (
    <div style={{ height: '100vh' }}>
      <NextStudio config={config} />
    </div>
  )
}
