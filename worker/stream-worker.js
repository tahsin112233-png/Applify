// Deploy this to Cloudflare Workers (free tier - 100k requests/day)
// 1. Go to workers.cloudflare.com
// 2. Create new worker
// 3. Paste this code
// 4. Deploy - you get a URL like: https://applify-stream.YOUR-NAME.workers.dev

const CLIENTS = [
  {
    name: 'ANDROID_TESTSUITE',
    clientName: 30,
    version: '1.9',
    userAgent: 'com.google.android.youtube/1.9 (Linux; U; Android 11) gzip',
    extra: { androidSdkVersion: 30 },
  },
  {
    name: 'ANDROID_MUSIC',
    clientName: 21,
    version: '6.42.52',
    userAgent: 'com.google.android.apps.youtube.music/6.42.52 (Linux; U; Android 11) gzip',
    extra: { androidSdkVersion: 30 },
  },
  {
    name: 'IOS',
    clientName: 5,
    version: '19.09.3',
    userAgent: 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 16_0 like Mac OS X)',
    extra: { deviceModel: 'iPhone14,3' },
  },
];

async function fetchPlayer(videoId, client) {
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
      contentPlaybackContext: {
        html5Preference: 'HTML5_PREF_WANTS',
        signatureTimestamp: 19950,
      },
    },
    contentCheckOk: true,
    racyCheckOk: true,
  };

  const r = await fetch(
    'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
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
    }
  );

  if (!r.ok) throw new Error('HTTP ' + r.status);
  const data = await r.json();

  const status = data?.playabilityStatus?.status;
  if (status === 'ERROR' || status === 'LOGIN_REQUIRED' || status === 'UNPLAYABLE') {
    throw new Error(status + ': ' + (data?.playabilityStatus?.reason || ''));
  }

  const allFormats = [
    ...(data?.streamingData?.adaptiveFormats || []),
    ...(data?.streamingData?.formats || []),
  ];

  const directAudio = allFormats.filter(f =>
    f.url && !f.signatureCipher && !f.cipher && f.mimeType?.includes('audio')
  );

  if (!directAudio.length) throw new Error('No direct audio URLs');

  directAudio.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

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
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    const videoId = url.searchParams.get('videoId');
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return new Response(JSON.stringify({ error: 'Invalid videoId' }), { status: 400, headers });
    }

    const errors = [];
    for (const client of CLIENTS) {
      try {
        const result = await fetchPlayer(videoId, client);
        return new Response(JSON.stringify(result), { headers });
      } catch (err) {
        errors.push(`${client.name}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({ error: 'All clients failed', details: errors }),
      { status: 502, headers }
    );
  },
};
