// Proxies YouTube audio to browser, solving CORS restrictions
// Browser calls: /api/proxy?videoId=xxx
// This fetches the YT URL server-side and streams bytes to browser

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { videoId } = req.query;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId' });
  }

  try {
    // Get the stream URL first
    const streamRes = await fetch(
      `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/stream?videoId=${videoId}`
    );
    if (!streamRes.ok) {
      const err = await streamRes.json().catch(() => ({}));
      return res.status(streamRes.status).json({ error: err.error || 'Stream lookup failed' });
    }

    const { url, mimeType } = await streamRes.json();
    if (!url) return res.status(502).json({ error: 'No stream URL' });

    // Handle range requests (needed for seeking)
    const rangeHeader = req.headers['range'];
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com',
    };
    if (rangeHeader) fetchHeaders['Range'] = rangeHeader;

    const audioRes = await fetch(url, { headers: fetchHeaders });

    if (!audioRes.ok && audioRes.status !== 206) {
      throw new Error('YouTube fetch failed: ' + audioRes.status);
    }

    // Forward headers
    res.setHeader('Content-Type', mimeType || 'audio/webm');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const contentLength = audioRes.headers.get('content-length');
    const contentRange  = audioRes.headers.get('content-range');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange)  res.setHeader('Content-Range', contentRange);

    res.status(rangeHeader ? 206 : 200);

    // Stream the audio bytes
    const reader = audioRes.body.getReader();
    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      },
    });

    // Pipe to response
    const nodeStream = require('stream');
    const passThrough = new nodeStream.PassThrough();
    res.setHeader('Transfer-Encoding', 'chunked');
    passThrough.pipe(res);

    const readerForPipe = stream.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await readerForPipe.read();
        if (done) { passThrough.end(); break; }
        passThrough.write(Buffer.from(value));
      }
    };
    await pump();

  } catch (err) {
    console.error('[proxy] Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
};
