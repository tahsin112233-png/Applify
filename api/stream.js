const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.garudalinux.org',
  'https://api.piped.yt',
  'https://piped.adminforge.de/api',
  'https://pipedapi.moomoo.me',
  'https://piped.smnz.de/api',
  'https://piped.lunar.icu/api',
  'https://api.piped.projectsegfau.lt',
  'https://pipedapi.reallyaweso.me',
  'https://piped-api.cfe.re',
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');

  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'videoId required' });

  console.log('[stream] Requesting:', videoId);

  // Try instances in groups of 3, race each group
  const groups = [];
  for (let i = 0; i < PIPED_INSTANCES.length; i += 3) {
    groups.push(PIPED_INSTANCES.slice(i, i + 3));
  }

  for (const group of groups) {
    const result = await Promise.any(
      group.map(base => tryPiped(base, videoId))
    ).catch(() => null);

    if (result) {
      console.log('[stream] Success from:', result.source);
      return res.json(result);
    }
  }

  console.error('[stream] All instances failed for:', videoId);
  return res.status(502).json({
    error: 'All stream sources failed. Please try another song.',
    videoId,
  });
};

async function tryPiped(base, videoId) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);

  try {
    const r = await fetch(`${base}/streams/${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://piped.video/',
        'Origin': 'https://piped.video',
      },
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (data?.error) throw new Error(data.error);

    const audioStreams = (data.audioStreams || [])
      .filter(s => s.url && s.mimeType)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    if (!audioStreams.length) throw new Error('No audio streams');

    // Best: opus ~128kbps (efficient on mobile), fallback to mp4a, fallback to highest
    const chosen =
      audioStreams.find(s => s.mimeType?.includes('opus') && s.bitrate >= 100000 && s.bitrate <= 200000) ||
      audioStreams.find(s => s.mimeType?.includes('opus')) ||
      audioStreams.find(s => s.mimeType?.includes('mp4a')) ||
      audioStreams[0];

    return {
      url:      chosen.url,
      mimeType: chosen.mimeType || 'audio/webm;codecs=opus',
      bitrate:  chosen.bitrate,
      quality:  chosen.quality || 'medium',
      source:   base,
    };
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}
