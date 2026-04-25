const ytdl = require('@distube/ytdl-core');

// Cookie is optional but helps avoid bot detection
// You can leave this empty - it will still work for most songs
const COOKIE = process.env.YT_COOKIE || '';

const agentOptions = COOKIE
  ? { headers: { cookie: COOKIE } }
  : {};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'videoId required' });

  // Validate videoId format
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId format' });
  }

  console.log('[stream] Getting info for:', videoId);

  try {
    const agent = COOKIE ? ytdl.createAgent([], agentOptions) : undefined;

    const info = await ytdl.getInfo(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        agent,
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        },
      }
    );

    // Get all audio-only formats, sorted by quality
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');

    if (!audioFormats.length) {
      throw new Error('No audio formats found');
    }

    // Sort: prefer opus ~128kbps for mobile efficiency
    audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

    // Pick best: prefer webm/opus around 128kbps, fallback to mp4a
    const opus128 = audioFormats.find(
      f => f.audioCodec?.includes('opus') && f.audioBitrate >= 100 && f.audioBitrate <= 160
    );
    const opusBest = audioFormats.find(f => f.audioCodec?.includes('opus'));
    const mp4a     = audioFormats.find(f => f.audioCodec?.includes('mp4a'));
    const chosen   = opus128 || opusBest || mp4a || audioFormats[0];

    console.log('[stream] Chosen format:', chosen.itag, chosen.mimeType, chosen.audioBitrate + 'kbps');

    return res.json({
      url:          chosen.url,
      mimeType:     chosen.mimeType,
      bitrate:      chosen.audioBitrate,
      codec:        chosen.audioCodec,
      title:        info.videoDetails.title,
      artist:       info.videoDetails.author?.name,
      duration:     info.videoDetails.lengthSeconds,
      thumbnail:    info.videoDetails.thumbnails?.slice(-1)[0]?.url,
    });

  } catch (err) {
    console.error('[stream] Error:', err.message);

    // Specific error messages to help diagnose
    if (err.message?.includes('age-restricted')) {
      return res.status(403).json({ error: 'Age restricted video' });
    }
    if (err.message?.includes('private')) {
      return res.status(403).json({ error: 'Private video' });
    }
    if (err.message?.includes('not available')) {
      return res.status(404).json({ error: 'Video not available in this region' });
    }

    return res.status(500).json({
      error: err.message || 'Failed to get stream',
      videoId,
    });
  }
};
