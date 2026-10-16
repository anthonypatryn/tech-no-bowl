// Vercel function: /api/sync (see lib/sync.js)
import { makeSyncStore, handleSync } from '../lib/sync.js';

export default async function handler(req, res) {
  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    const [status, json] = await handleSync(makeSyncStore(), req.method, body);
    res.status(status).json(json);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
