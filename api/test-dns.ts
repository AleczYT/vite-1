import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const zone = process.env.CF_ZONE_ID!;
    const token = process.env.CF_API_TOKEN!;
    const ip = process.env.NODE_IP!; // IP-ul mini PC-ului tău
    const subdomain = "test"; // poți schimba cu altceva

    const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/dns_records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: "A",
        name: `${subdomain}.cumpara.host`,
        content: ip,
        ttl: 120,
        proxied: true
      })
    });

    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Cloudflare API error: ${r.status} - ${text}`);
    }

    const data = await r.json();
    return res.status(200).json({ ok: true, dns: data });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
