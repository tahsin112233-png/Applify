const ITKEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-KKVH2y5AA';

function ctx(gl = 'US') {
  return {
    client: {
      clientName: 'WEB_REMIX',
      clientVersion: '1.20240101.01.00',
      hl: 'en', gl,
    }
  };
}

const HEADERS = {
  'Content-Type': 'application/json',
  'X-YouTube-Client-Name': '67',
  'X-YouTube-Client-Version': '1.20240101.01.00',
  'Origin': 'https://music.youtube.com',
  'Referer': 'https://music.youtube.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const q      = (req.query.q || '').trim();
  const region = (req.query.region || 'US').toUpperCase().slice(0, 2);
  if (!q) return res.json({ results: [] });

  try {
    const response = await fetch(
      `https://music.youtube.com/youtubei/v1/search?key=${ITKEY}`,
      {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          query: q,
          context: ctx(region),
          params: 'EgWKAQIIAWoKEAoQAxAEEAkQBQ%3D%3D', // songs filter
        }),
      }
    );

    if (!response.ok) throw new Error('YTM ' + response.status);
    const data = await response.json();
    const results = parseSearch(data);
    return res.json({ results });
  } catch (err) {
    console.error('[search]', err.message);
    return res.status(500).json({ results: [], error: err.message });
  }
};

function parseSearch(data) {
  try {
    const out = [];
    // Tabbed results
    const tabs =
      data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.contents ||
      data?.contents?.sectionListRenderer?.contents || [];

    for (const content of tabs) {
      const shelf = content?.musicShelfRenderer;
      if (!shelf) continue;
      for (const item of (shelf.contents || [])) {
        const parsed = parseItem(item);
        if (parsed) out.push(parsed);
      }
      if (out.length >= 25) break;
    }
    return out;
  } catch (e) {
    console.error('[parseSearch]', e.message);
    return [];
  }
}

function parseItem(item) {
  const rl = item?.musicResponsiveListItemRenderer;
  if (!rl) return null;

  const title  = rl?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
  if (!title) return null;

  const subRuns = rl?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const artist  = subRuns.filter(r => r.text !== ' • ').map(r => r.text).join('').trim();

  const thumbs = rl?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
  const thumb  = [...thumbs].sort((a,b)=>(b.width||0)-(a.width||0))[0]?.url || '';

  const videoId =
    rl?.overlay?.musicItemThumbnailOverlayRenderer?.content
      ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
    rl?.navigationEndpoint?.watchEndpoint?.videoId ||
    rl?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
      ?.navigationEndpoint?.watchEndpoint?.videoId;

  if (!videoId) return null;
  return { id: videoId, title, artist, thumb };
}
