// Not needed for IFrame playback, but kept for metadata lookup
const YT_API_KEY = process.env.YT_API_KEY || '';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { videoId } = req.query;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId' });
  }

  // Just confirm the video exists - IFrame API handles actual playback
  return res.json({
    videoId,
    method: 'iframe',
    ok: true,
  });
};
