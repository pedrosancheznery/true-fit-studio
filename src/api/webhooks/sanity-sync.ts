import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

// Use Service Role Key to bypass RLS for administrative sync
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { _id, title, description, instructor, startTime, duration, capacity } = req.body

    const { data, error } = await supabaseAdmin
      .from('classes')
      .upsert({
        sanity_id: _id,
        title: title,
        description: description,
        instructor: instructor,
        start_time: startTime,
        duration_minutes: duration,
        capacity: capacity,
      }, { onConflict: 'sanity_id' })

    if (error) throw error

    return res.status(200).json({ message: 'Sync successful', data })
  } catch (err: any) {
    return res.status(500).json({ message: err.message })
  }
}
