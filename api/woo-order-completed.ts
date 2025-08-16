import type { VercelRequest, VercelResponse } from '@vercel/node';

type Meta = { key: string; value: string | number };
type LineItem = { meta_data?: Meta[] };
type OrderPayload = {
  id: number;
  billing?: { email?: string; first_name?: string };
  line_items?: LineItem[];
  meta_data?: Meta[];
};

function getMeta(line: LineItem | undefined, key: string) {
  const v = line?.meta_data?.find(m => m.key?.toUpperCase() === key.toUpperCase())?.value;
  return typeof v === 'string' ? v : (v ?? '');
}
function getOrderMeta(order: OrderPayload, key: string) {
  const v = order.meta_data?.find(m => m.key?.toUpperCase() === key.toUpperCase())?.value;
  return typeof v === 'string' ? v : (v ?? '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // răspundem rapid ca WooCommerce să fie fericit
  res.status(200).json({ ok: true });

  const order: OrderPayload = req.body || {};
  const line = order.line_items?.[0];

  // extrage config cu fallback-uri sigure
  const RAM = Number(getMeta(line, 'RAM') || 4096);
  const SLOTS = Number(getMeta(line, 'SLOTS') || 10);
  const VERSION = String(getMeta(line, 'VERSION') || '1.20.6');
  const TYPE = String(getMeta(line, 'TYPE') || 'paper').toLowerCase();
  const SUBDOMAIN = String(getOrderMeta(order, 'subdomain') || getMeta(line, 'SUBDOMAIN') || `srv-${order.id}`);

  const email = order.billing?.email || 'no-reply@example.com';
  const firstName = order.billing?.first_name || 'Client';

  try {
    // 1) user Pterodactyl
    const userId = await getOrCreatePteroUser(email, firstName);

    // 2) server Pterodactyl
    const server = await createPterodactylServer({
      userId,
      RAM,
      SLOTS,
      VERSION,
      TYPE,
      name: `mc-${(firstName || 'client').toLowerCase()}-${order.id}`
    });

    // 3) DNS Cloudflare
    const fqdn = `${SUBDOMAIN}.cumpara.host`;
    await createCloudflareDNS(fqdn, process.env.NODE_IP!);

    console.log('OK', { orderId: order.id, serverId: server?.attributes?.id, fqdn });
  } catch (e) {
    console.error('Provisioning error', e);
    // aici poți adăuga un TODO: push într-o coadă sau retry la cron
  }
}

// ---------------- Pterodactyl ----------------
async function getOrCreatePteroUser(email: string, firstName: string) {
  const base = process.env.PANEL_URL!;
  const key = process.env.PTERO_APP_KEY!;
  // caută user după email
  const q = await fetch(`${base}/api/application/users?filter[email]=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }
  });
  if (q.ok) {
    const j = await q.json();
    if (j?.data?.[0]?.attributes?.id) return j.data[0].attributes.id;
  }
  // creează user
  const payload = {
    email,
    username: email.split('@')[0].replace(/[^a-z0-9_-]/gi, '').slice(0, 30) || `user${Date.now()}`,
    first_name: firstName || 'Client',
    last_name: 'Auto',
    password: null
  };
  const r = await fetch(`${base}/api/application/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Create user failed: ${r.status}`);
  const ju = await r.json();
  return ju?.attributes?.id;
}

async function createPterodactylServer(opts: {
  userId: number; RAM: number; SLOTS: number; VERSION: string; TYPE: string; name: string;
}) {
  const base = process.env.PANEL_URL!;
  const key = process.env.PTERO_APP_KEY!;
  const egg = Number(process.env.MC_EGG || 2);
  const nest = Number(process.env.MC_NEST || 1);
  const location = Number(process.env.PTERO_LOCATION || 1);

  const docker_image = 'ghcr.io/pterodactyl/yolks:java_17';
  const env: Record<string, string | number> = {
    MINECRAFT_VERSION: opts.VERSION,
    SERVER_JARFILE: opts.TYPE === 'paper' ? 'paper.jar' : 'server.jar'
  };

  const payload = {
    name: opts.name,
    user: opts.userId,
    egg, nest, docker_image,
    limits: { memory: opts.RAM, swap: 0, disk: 10240, io: 500, cpu: 0 },
    feature_limits: { databases: 1, allocations: 1, backups: 1 },
    environment: env,
    start_on_completion: true,
    deploy: { locations: [location], dedicated_ip: false, port_range: [] }
  };

  const r = await fetch(`${base}/api/application/servers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Create server failed: ${r.status}`);
  return r.json();
}

// ---------------- Cloudflare ----------------
async function createCloudflareDNS(fqdn: string, contentIP: string) {
  const zone = process.env.CF_ZONE_ID!;
  const token = process.env.CF_API_TOKEN!;
  const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/dns_records`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'A', name: fqdn, content: contentIP, ttl: 120, proxied: true })
  });
  if (!r.ok) throw new Error(`Cloudflare DNS failed: ${r.status}`);
}
