export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const endpoint = url.pathname.replace(/^\/api\//, '');
  const search = url.search;

  const upstream = `https://api.ytify.workers.dev/${endpoint}${search}`;

  try {
    const response = await fetch(upstream, {
      headers: { 'User-Agent': 'Applify/1.0' }
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
