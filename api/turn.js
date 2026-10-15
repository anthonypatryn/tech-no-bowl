// Vercel function: /api/turn — relay (TURN) servers for online play, as short-lived Cloudflare credentials.
// Friends on networks that can't reach the host directly (phone data, strict home routers) go through the relay;
// PeerJS's own free relay is dead (2026-10-10). Needs CF_TURN_KEY_ID + CF_TURN_API_TOKEN (Cloudflare dashboard →
// Realtime → TURN Server). Without them it answers with no servers and online play falls back to direct connections.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const id = process.env.CF_TURN_KEY_ID, token = process.env.CF_TURN_API_TOKEN;
  if (!id || !token) return res.status(200).json({ iceServers: [] });
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 86400 }), // a day: longer than any race
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(200).json({ iceServers: [], error: `Cloudflare said ${r.status}` });
    const list = Array.isArray(j.iceServers) ? j.iceServers : j.iceServers ? [j.iceServers] : [];
    // browsers refuse port 53 (Cloudflare's docs say to drop those URLs)
    const iceServers = list.map((s) => ({ ...s, urls: [].concat(s.urls).filter((u) => !/:53(\?|$)/.test(u)) })).filter((s) => s.urls.length);
    res.status(200).json({ iceServers });
  } catch (e) {
    res.status(200).json({ iceServers: [], error: e.message || String(e) });
  }
}
