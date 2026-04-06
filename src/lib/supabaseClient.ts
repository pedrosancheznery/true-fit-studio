<<<<<<< HEAD
import { createBrowserClient } from '@supabase/ssr'

// We create the client once and export it as a constant named 'supabase'
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
=======
// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Keep single instance across HMR
declare global {
  // eslint-disable-next-line no-var
  var __supabaseClient: ReturnType<typeof createClient> | undefined;
}

export const supabase =
  global.__supabaseClient ??
  (global.__supabaseClient = createClient(url, anonKey));
>>>>>>> dev
