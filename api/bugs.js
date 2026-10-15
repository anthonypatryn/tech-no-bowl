// Vercel function: /api/bugs (see lib/bugs.js)
import { makeStore, handleBugs } from '../lib/bugs.js';

export default async function handler(req, res) {
  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    const [status, json] = await handleBugs(makeStore(), req.method, body, req.headers['x-bug-pin'], process.env.BUG_PIN);
    res.status(status).json(json);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
