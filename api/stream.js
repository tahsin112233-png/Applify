// Uses multiple free Piped API instances (no API key needed!)
const PIPED = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.garudalinux.org',
  'https://api.piped.yt',
  'https://pipedapi.moomoo.me',
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'videoId required' });

  // Try each Piped instance until one works
  for (const base of PIPED) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const r = await fetch(`${base}/streams/${videoId}`, {
        headers: { 'User-Agent': 'Applify/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!r.ok) continue;

      const data = await r.json();
      if (data.error) continue;

      // Find best audio stream
      const audioStreams = (data.audioStreams || [])
        .filter(s => s.url && s.mimeType?.includes('audio'))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      if (!audioStreams.length) continue;

      return res.json({
        url:       audioStreams[0].url,
        quality:   audioStreams[0].quality || 'medium',
        mimeType:  audioStreams[0].mimeType,
        title:     data.title,
        artist:    data.uploader,
        thumbnail: data.thumbnailUrl,
      });
    } catch (e) {
      // Try next instance
      continue;
    }
  }

  res.status(502).json({ error: 'All stream sources failed. Try again.' });
};
