export default async function handler(req: any, res: any) {
  const slug = Array.isArray(req.query.slug)
    ? req.query.slug.join('/')
    : (req.query.slug || '');

  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(req.query)) {
    if (key !== 'slug') {
      params.set(key, val as string);
    }
  }

  const qs = params.toString();
  const url = `https://api.ytify.workers.dev/${slug}${qs ? `?${qs}` : ''}`;

  try {
    const upstream = await fetch(url);
    const data = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(upstream.status).json(data);
  } catch {
    res.status(500).json({ error: 'Proxy failed' });
  }
}
