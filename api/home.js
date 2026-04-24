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
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

  try {
    const r = await fetch(
      `https://music.youtube.com/youtubei/v1/browse?key=${ITKEY}`,
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
        body: JSON.stringify({ browseId: 'FEmusic_home', context: CTX }),
      }
    );

    const data = await r.json();
    const sections = parseHome(data);
    res.json({ sections });
  } catch (err) {
    console.error('home error:', err.message);
    res.status(500).json({ sections: [], error: err.message });
  }
};

function parseHome(data) {
  try {
    const tabs = data?.contents?.singleColumnBrowseResultsRenderer?.tabs;
    if (!tabs) return [];
    const contents =
      tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
    const out = [];

    for (const c of contents) {
      const shelf =
        c?.musicCarouselShelfRenderer ||
        c?.musicImmersiveCarouselRenderer;
      if (!shelf) continue;

      const title =
        shelf?.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text ||
        shelf?.header?.musicImmersiveCarouselRenderer?.title?.runs?.[0]?.text ||
        'Featured';

      const items = (shelf.contents || [])
        .map(parseItem)
        .filter(Boolean);

      if (items.length) out.push({ title, items });
    }
    return out;
  } catch { return []; }
}

function parseItem(item) {
  // Two-row card (album / playlist / song)
  const tr = item?.musicTwoRowItemRenderer;
  if (tr) {
    const title = tr?.title?.runs?.[0]?.text;
    const artist = tr?.subtitle?.runs?.map(r => r.text).join('') || '';
    const thumbs = tr?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
    const thumb  = thumbs[thumbs.length - 1]?.url || '';
    const videoId =
      tr?.navigationEndpoint?.watchEndpoint?.videoId ||
      tr?.navigationEndpoint?.watchPlaylistEndpoint?.videoId;
    if (videoId && title) return { id: videoId, title, artist, thumb };
  }

  // Responsive list item
  const rl = item?.musicResponsiveListItemRenderer;
  if (rl) {
    const title  = rl?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
    const artist = rl?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || '';
    const thumbs = rl?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
    const thumb  = thumbs[thumbs.length - 1]?.url || '';
    const videoId = rl?.overlay
      ?.musicItemThumbnailOverlayRenderer?.content
      ?.musicPlayButtonRenderer?.playNavigationEndpoint
      ?.watchEndpoint?.videoId;
    if (videoId && title) return { id: videoId, title, artist, thumb };
  }

  return null;
}
