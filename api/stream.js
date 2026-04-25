// YouTube client configs - ordered by reliability on server IPs
const YT_CLIENTS = [
  {
    name: 'ANDROID_TESTSUITE',
    version: '1.9',
    userAgent: 'com.google.android.youtube/1.9 (Linux; U; Android 11) gzip',
    clientName: 30,
    extra: { androidSdkVersion: 30 },
  },
  {
    name: 'ANDROID',
    version: '19.09.37',
    userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
    clientName: 3,
    extra: { androidSdkVersion: 30 },
  },
  {
    name: 'IOS',
    version: '19.09.3',
    userAgent: 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 16_0 like Mac OS X)',
    clientName: 5,
    extra: { deviceModel: 'iPhone14,3' },
  },
  {
    name: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
    version: '2.0',
    userAgent: 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0)',
    clientName: 85,
    extra: {},
  },
];

async function getStreamUrl(videoId, client) {
  const body = {
    videoId,
    context: {
      client: {
        clientName: client.name,
        clientVersion: client.version,
        userAgent: client.userAgent,
        hl: 'en',
        gl: 'US',
        timeZone: 'UTC',
        utcOffsetMinutes: 0,
        ...client.extra,
      },
    },
    playbackContext: {
      contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' },
    },
    contentCheckOk: true,
    racyCheckOk: true,
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);

  try {
    const r = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc&prettyPrint=false`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': client.userAgent,
          'X-YouTube-Client-Name': String(client.clientName),
          'X-YouTube-Client-Version': client.version,
          'Origin': 'https://www.youtube.com',
          'Referer': 'https://www.youtube.com/',
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      }
    );
    clearTimeout(timer);

    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();

    const playability = data?.playabilityStatus?.status;
    if (playability === 'ERROR' || playability === 'LOGIN_REQUIRED') {
      throw new Error('Playability: ' + playability);
    }

    const allFormats = [
      ...(data?.streamingData?.adaptiveFormats || []),
      ...(data?.streamingData?.formats || []),
    ];

    // Only formats with direct URLs (not cipher/signatureCipher)
    const audioFormats = allFormats.filter(
      f => f.url && f.mimeType?.includes('audio')
    );

    if (!audioFormats.length) throw new Error('No direct audio URLs');

    audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    // Prefer opus ~128kbps for mobile
    const chosen =
      audioFormats.find(f => f.mimeType?.includes('opus') && f.bitrate >= 100000 && f.bitrate <= 180000) ||
      audioFormats.find(f => f.mimeType?.includes('opus')) ||
      audioFormats.find(f => f.mimeType?.includes('mp4a')) ||
      audioFormats[0];

    return {
      url: chosen.url,
      mimeType: chosen.mimeType || 'audio/webm;codecs=opus',
      bitrate: chosen.bitrate,
      approxDurationMs: chosen.approxDurationMs,
      client: client.name,
    };
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { videoId } = req.query;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId' });
  }

  console.log('[stream] videoId:', videoId);

  let lastError = null;

  for (const client of YT_CLIENTS) {
    try {
      console.log('[stream] Trying client:', client.name);
      const result = await getStreamUrl(videoId, client);
      console.log('[stream] Success with:', client.name, result.mimeType, result.bitrate);
      return res.json(result);
    } catch (err) {
      console.warn('[stream] Client failed:', client.name, err.message);
      lastError = err;
    }
  }

  return res.status(502).json({
    error: 'All clients failed: ' + (lastError?.message || 'unknown'),
    videoId,
  });
};
