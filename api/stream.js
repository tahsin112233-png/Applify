// Multiple stream sources with automatic fallback
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.garudalinux.org',
  'https://api.piped.yt',
  'https://pipedapi.moomoo.me',
  'https://piped.video/api',
  'https://piped.adminforge.de/api',
];

const INVIDIOUS_INSTANCES = [
  'https://invidious.snopyta.org',
  'https://vid.puffyan.us',
  'https://invidious.kavin.rocks',
  'https://y.com.sb',
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800');

  const { videoId, quality = 'medium' } = req.query;
  if (!videoId) return res.status(400).json({ error: 'videoId required' });

  // Try Piped instances first (better quality selection)
  for (const base of PIPED_INSTANCES) {
    try {
      const url = await tryPiped(base, videoId, quality);
      if (url) {
        console.log('[stream] Got URL from', base);
        return res.json({ url, source: 'piped', instance: base });
      }
    } catch (e) {
      console.warn('[stream] Piped failed:', base, e.message);
    }
  }

  // Fallback to Invidious
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const url = await tryInvidious(base, videoId, quality);
      if (url) {
        console.log('[stream] Got URL from Invidious:', base);
        return res.json({ url, source: 'invidious', instance: base });
      }
    } catch (e) {
      console.warn('[stream] Invidious failed:', base, e.message);
    }
  }

  return res.status(502).json({ error: 'All sources exhausted. Please try again.' });
};

async function tryPiped(base, videoId, quality) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${base}/streams/${videoId}`, {
      headers: { 'User-Agent': 'Applify/2.0', 'Accept': 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return null;
    const data = await r.json();
    if (data?.error || !data?.audioStreams?.length) return null;

    const streams = data.audioStreams
      .filter(s => s.url && s.mimeType?.includes('audio'))
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    if (!streams.length) return null;

    // Pick quality
    let chosen;
    if (quality === 'high')        chosen = streams[0];
    else if (quality === 'low')    chosen = streams[streams.length - 1];
    else {
      // medium: prefer ~128kbps opus
      chosen = streams.find(s => s.bitrate >= 100000 && s.bitrate <= 160000)
             || streams.find(s => s.mimeType?.includes('opus'))
             || streams[Math.floor(streams.length / 2)];
    }
    return chosen?.url || null;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function tryInvidious(base, videoId, quality) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${base}/api/v1/videos/${videoId}?fields=adaptiveFormats`, {
      headers: { 'User-Agent': 'Applify/2.0' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return null;
    const data = await r.json();
    const streams = (data?.adaptiveFormats || [])
      .filter(f => f.type?.includes('audio') && f.url)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    if (!streams.length) return null;
    return quality === 'low' ? streams[streams.length-1]?.url : streams[0]?.url;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}
