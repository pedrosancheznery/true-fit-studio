import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return res.status(410).json({
    error: 'Stripe webhook handling is temporarily disabled. The booking flow now uses simulated payments.',
  });
}
