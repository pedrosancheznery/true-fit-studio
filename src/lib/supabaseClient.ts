import { createBrowserClient } from '@supabase/ssr'

// We create the client once and export it as a constant named 'supabase'
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
