const ITKEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-KKVH2y5AA';
const CTX = {
  client: {
    clientName: 'WEB_REMIX',
    clientVersion: '1.20230501.01.00',
    hl: 'en', gl: 'US',
  }
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const q = (req.query.q || '').trim();
  if (!q) return res.json({ results: [] });

  try {
    const r = await fetch(
      `https://music.youtube.com/youtubei/v1/search?key=${ITKEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-YouTube-Client-Name': '67',
          'X-YouTube-Client-Version': '1.20230501.01.00',
          'Origin': 'https://music.youtube.com',
          'Referer': 'https://music.youtube.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        },
        body: JSON.stringify({ query: q, context: CTX }),
      }
    );

    const data = await r.json();
    const results = parseSearch(data);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ results: [], error: err.message });
  }
};

function parseSearch(data) {
  try {
    const tabs =
      data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.contents || [];

    const out = [];
    for (const content of tabs) {
      const shelf = content?.musicShelfRenderer;
      if (!shelf) continue;

      for (const item of (shelf.contents || [])) {
        const parsed = parseSearchItem(item);
        if (parsed) out.push(parsed);
      }
    }
    return out;
  } catch { return []; }
}

function parseSearchItem(item) {
  const rl = item?.musicResponsiveListItemRenderer;
  if (!rl) return null;

  const title = rl?.flexColumns?.[0]
    ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;

  const subRuns = rl?.flexColumns?.[1]
    ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const artist = subRuns
    .map(r => r.text)
    .filter(t => t !== ' • ' && t !== '•')
    .join('');

  const thumbs = rl?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
  const thumb  = thumbs[thumbs.length - 1]?.url || '';

  const videoId = rl?.overlay
    ?.musicItemThumbnailOverlayRenderer?.content
    ?.musicPlayButtonRenderer?.playNavigationEndpoint
    ?.watchEndpoint?.videoId;

  if (!videoId || !title) return null;
  return { id: videoId, title, artist, thumb };
}
