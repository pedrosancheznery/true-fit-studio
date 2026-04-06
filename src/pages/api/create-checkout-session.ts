import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  return res.status(410).json({
    error: 'Stripe checkout is temporarily disabled. Use the simulated class booking flow instead.',
  });
}
