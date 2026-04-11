// pages/api/profile/update.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getSSRClient } from '@/lib/ssrClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
// Spread req and res, then add the missing properties TypeScript is looking for
    const supabase = getSSRClient({ 
      req, 
      res, 
      query: {}, 
      resolvedUrl: '' 
    } as any);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) return res.status(401).json({ error: 'Unauthorized' });

    const { full_name, membership_level } = req.body; // Payload from form
    if (!full_name) return res.status(400).json({ error: 'Name is required' });

    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name, membership_level })
      .eq('id', user.id) // Matches user
      .select();

    if (error) {
      console.error('DB update error:', error);
      return res.status(500).json({ error: 'Update failed' });
    }

    console.log('Profile updated:', data);
    res.status(200).json({ success: true, profile: data[0] }); // Return updated profile
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}