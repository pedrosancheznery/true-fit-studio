import { supabaseAdmin } from '@/lib/serverSupabase';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 1. Attempt to fetch a row count from your 'classes' table
    const { error, count } = await supabaseAdmin
      .from('classes')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return res.status(500).json({ 
        success: false, 
        message: 'Supabase Admin check failed', 
        error: error.message,
        hint: 'Check if your SERVICE_ROLE_KEY is valid and the table "classes" exists.'
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Supabase Admin is connected and bypasses RLS.',
      rowCount: count
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Server-side crash', 
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
