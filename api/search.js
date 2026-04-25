const YT_API_KEY = process.env.YT_API_KEY || '';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const q      = (req.query.q || '').trim();
  const region = (req.query.region || 'BD').toUpperCase().slice(0, 2);

  if (!q) return res.json({ results: [] });

  if (!YT_API_KEY) {
    return res.status(500).json({ results: [], error: 'YT_API_KEY not set in Vercel environment variables' });
  }

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', q + ' official music');
    url.searchParams.set('type', 'video');
    url.searchParams.set('videoCategoryId', '10');
    url.searchParams.set('maxResults', '25');
    url.searchParams.set('regionCode', region);
    url.searchParams.set('relevanceLanguage', 'en');
    url.searchParams.set('key', YT_API_KEY);

    const r = await fetch(url.toString());
    if (!r.ok) {
      const errData = await r.json().catch(() => ({}));
      throw new Error(errData?.error?.message || 'YouTube API error ' + r.status);
    }

    const data = await r.json();
    const results = (data.items || []).map(item => ({
      id:     item.id?.videoId,
      title:  item.snippet?.title,
      artist: cleanChannel(item.snippet?.channelTitle),
      thumb:  item.snippet?.thumbnails?.high?.url ||
              item.snippet?.thumbnails?.medium?.url || '',
    })).filter(t => t.id && t.title);

    return res.json({ results });
  } catch (err) {
    console.error('[search]', err.message);
    return res.status(500).json({ results: [], error: err.message });
  }
};

function cleanChannel(name) {
  return (name || '').replace(/ - Topic$/i, '').replace(/VEVO$/i, '').replace(/Official$/i, '').trim();
}
