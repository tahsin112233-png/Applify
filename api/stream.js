// YouTube client configs - these return DIRECT audio URLs (no cipher)
const CLIENTS = [
  // TV Embedded - most reliable for direct URLs, no bot detection
  {
    name: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
    clientName: 85,
    version: '2.0',
    userAgent: 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/538.20 (KHTML, like Gecko) SamsungBrowser/2.1 Chrome/56.0.2924.0 TV Safari/538.20',
    extra: {},
  },
  // Web Embedded Player - returns direct URLs
  {
    name: 'WEB_EMBEDDED_PLAYER',
    clientName: 56,
    version: '1.20240101.00.00',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    extra: { clientFormFactor: 'UNKNOWN_FORM_FACTOR' },
  },
  // Android VR - rarely blocked, returns direct URLs
  {
    name: 'ANDROID_VR',
    clientName: 28,
    version: '1.56.21',
    userAgent: 'Mozilla/5.0 (Linux; Android 10; Quest 2 Build/QQ3A.200805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.164 Mobile Safari/537.36',
    extra: { androidSdkVersion: 29, deviceModel: 'Quest 2' },
  },
  // Android Music - YouTube Music app client
  {
    name: 'ANDROID_MUSIC',
    clientName: 21,
    version: '6.42.52',
    userAgent: 'com.google.android.apps.youtube.music/6.42.52 (Linux; U; Android 11) gzip',
    extra: { androidSdkVersion: 30 },
  },
  // iOS Music - YouTube Music iOS client
  {
    name: 'IOS_MUSIC',
    clientName: 26,
    version: '6.33.3',
    userAgent: 'com.google.ios.youtubemusic/6.33.3 (iPhone14,3; U; CPU iOS 16_0 like Mac OS X)',
    extra: { deviceModel: 'iPhone14,3', osVersion: '16.0.0.250010' },
  },
];

async function fetchPlayer(videoId, client) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);

  try {
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
        thirdParty: {
          embedUrl: 'https://www.youtube.com/',
        },
      },
      playbackContext: {
        contentPlaybackContext: {
          html5Preference: 'HTML5_PREF_WANTS',
          signatureTimestamp: 19950,
        },
      },
      contentCheckOk: true,
      racyCheckOk: true,
    };

    const r = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc&prettyPrint=false`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': client.userAgent,
          'X-YouTube-Client-Name': String(client.clientName),
          'X-YouTube-Client-Version': client.version,
          'X-YouTube-Trusted-If-Embedded': '1',
          'Origin': 'https://www.youtube.com',
          'Referer': 'https://www.youtube.com/',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      }
    );
    clearTimeout(timer);

    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    const status = data?.playabilityStatus?.status;
    const reason = data?.playabilityStatus?.reason || '';
    console.log(`[stream] ${client.name} playability: ${status} ${reason}`);

    if (status === 'ERROR') throw new Error(`Video error: ${reason}`);
    if (status === 'LOGIN_REQUIRED') throw new Error(`Login required: ${reason}`);
    if (status === 'UNPLAYABLE') throw new Error(`Unplayable: ${reason}`);

    const allFormats = [
      ...(data?.streamingData?.adaptiveFormats || []),
      ...(data?.streamingData?.formats || []),
    ];

    console.log(`[stream] ${client.name} total formats: ${allFormats.length}`);

    // ONLY formats with direct URL (not signatureCipher / cipher)
    const directAudio = allFormats.filter(f =>
      f.url &&
      !f.signatureCipher &&
      !f.cipher &&
      f.mimeType?.includes('audio')
    );

    console.log(`[stream] ${client.name} direct audio URLs: ${directAudio.length}`);

    if (!directAudio.length) throw new Error('No direct audio URLs');

    directAudio.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    // Pick best quality: prefer opus ~128kbps for mobile efficiency
    const chosen =
      directAudio.find(f => f.mimeType?.includes('opus') && f.bitrate >= 100000 && f.bitrate <= 180000) ||
      directAudio.find(f => f.mimeType?.includes('opus')) ||
      directAudio.find(f => f.mimeType?.includes('mp4a')) ||
      directAudio[0];

    return {
      url:      chosen.url,
      mimeType: chosen.mimeType,
      bitrate:  chosen.bitrate,
      client:   client.name,
      title:    data?.videoDetails?.title,
      artist:   data?.videoDetails?.author,
      duration: data?.videoDetails?.lengthSeconds,
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

  console.log(`[stream] videoId: ${videoId}`);

  const errors = [];
  for (const client of CLIENTS) {
    try {
      console.log(`[stream] Trying: ${client.name}`);
      const result = await fetchPlayer(videoId, client);
      console.log(`[stream] ✅ Success: ${client.name} | ${result.mimeType} | ${result.bitrate}bps`);
      return res.json(result);
    } catch (err) {
      console.warn(`[stream] ❌ Failed: ${client.name} | ${err.message}`);
      errors.push(`${client.name}: ${err.message}`);
    }
  }

  console.error('[stream] All clients failed:', errors.join(' | '));
  return res.status(502).json({
    error: 'All stream clients failed',
    details: errors,
    videoId,
  });
};
