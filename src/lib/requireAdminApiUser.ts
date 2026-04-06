import type { User } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

import { supabaseAdmin } from '@/lib/serverSupabase';

export async function requireAdminApiUser(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<User | null> {
  const authToken = req.headers.authorization?.split('Bearer ')[1];
  if (!authToken) {
    res.status(401).json({ error: 'Sign in to continue.' });
    return null;
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(authToken);

  if (authError || !user) {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    return null;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    res.status(500).json({ error: 'Unable to verify your permissions right now.' });
    return null;
  }

  if (profile?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access is required for this action.' });
    return null;
  }

  return user;
}
