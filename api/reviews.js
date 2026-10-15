// Vercel function: /api/reviews (see lib/reviews.js)
import { makeReviewStore, handleReviews } from '../lib/reviews.js';

export default async function handler(req, res) {
  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    const [status, json] = await handleReviews(makeReviewStore(), req.method, body, req.headers['x-bug-pin'], process.env.BUG_PIN);
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json(json);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
