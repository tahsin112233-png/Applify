const youtubeDl = require('youtube-dl-exec');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { videoId } = req.query;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId' });
  }

  console.log('[stream] videoId:', videoId);

  try {
    // Use yt-dlp to extract audio URL - handles PO tokens automatically
    const result = await youtubeDl(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        // Audio only, best quality
        format: 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
        // Skip downloading, just get info + URL
        skipDownload: true,
        // Bypass geo and age restrictions
        noPlaylistVideos: true,
        addHeader: [
          'referer:youtube.com',
          'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        ],
      }
    );

    if (!result || !result.url) {
      throw new Error('No URL returned from yt-dlp');
    }

    console.log('[stream] ✅ Got URL via yt-dlp, ext:', result.ext, 'tbr:', result.tbr);

    return res.json({
      url:      result.url,
      mimeType: result.ext === 'webm' ? 'audio/webm;codecs=opus'
              : result.ext === 'm4a'  ? 'audio/mp4'
              : result.ext === 'mp3'  ? 'audio/mpeg'
              : 'audio/webm',
      bitrate:  result.tbr ? Math.round(result.tbr * 1000) : null,
      title:    result.title,
      artist:   result.uploader,
      duration: result.duration,
      thumbnail: result.thumbnail,
    });

  } catch (err) {
    console.error('[stream] yt-dlp error:', err.message);
    return res.status(502).json({
      error: err.message || 'yt-dlp extraction failed',
      videoId,
    });
  }
};
