import { isValidSignature, SIGNATURE_HEADER_NAME } from '@sanity/webhook';
import { supabaseAdmin } from '@/lib/serverSupabase';
import type { NextApiRequest, NextApiResponse } from 'next';

const secret = process.env.SANITY_WEBHOOK_SECRET;

async function readBody(readable: any) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Verify Signature
  const signature = req.headers[SIGNATURE_HEADER_NAME] as string;
  const body = await readBody(req); // Helper to get raw body for verification

  if (!isValidSignature(body, signature, secret)) {
    return res.status(401).json({ message: 'Invalid signature' });
  }

  const jsonBody = JSON.parse(body);
  const { _id, title, price, description } = jsonBody;

  // 2. Sync to Supabase
  const { error } = await supabaseAdmin
    .from('classes')
    .upsert({ 
      id: _id, 
      name: title, 
      price_cents: price * 100, 
      description 
    });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ message: 'Synced successfully' });
}
