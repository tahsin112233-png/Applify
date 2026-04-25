const ITKEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-KKVH2y5AA';

function ctx(gl = 'US') {
  return {
    client: {
      clientName: 'WEB_REMIX',
      clientVersion: '1.20240101.01.00',
      hl: 'en', gl,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
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
  'Accept-Language': 'en-US,en;q=0.9',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=60');

  const region = (req.query.region || 'US').toUpperCase().slice(0, 2);

  try {
    const response = await fetch(
      `https://music.youtube.com/youtubei/v1/browse?key=${ITKEY}`,
      {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ browseId: 'FEmusic_home', context: ctx(region) }),
      }
    );

    if (!response.ok) throw new Error('YTM returned ' + response.status);
    const data = await response.json();
    const sections = parseHome(data);

    if (!sections.length) throw new Error('No sections parsed');
    return res.json({ sections, region });
  } catch (err) {
    console.error('[home]', err.message);
    return res.status(500).json({ sections: [], error: err.message });
  }
};

function parseHome(data) {
  try {
    const tabs = data?.contents?.singleColumnBrowseResultsRenderer?.tabs;
    if (!tabs) return [];
    const contents = tabs[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
    const out = [];

    for (const c of contents) {
      const shelf = c?.musicCarouselShelfRenderer || c?.musicImmersiveCarouselRenderer;
      if (!shelf) continue;

      const title =
        shelf?.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text ||
        shelf?.header?.musicImmersiveCarouselRenderer?.title?.runs?.[0]?.text ||
        'Featured';

      const items = (shelf.contents || []).map(parseItem).filter(Boolean);
      if (items.length) out.push({ title, items });
    }
    return out;
  } catch (e) {
    console.error('[parseHome]', e.message);
    return [];
  }
}

function getBestThumb(thumbs) {
  if (!thumbs?.length) return '';
  const sorted = [...thumbs].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0]?.url || '';
}

function parseItem(item) {
  // Two-row item (most common)
  const tr = item?.musicTwoRowItemRenderer;
  if (tr) {
    const title  = tr?.title?.runs?.[0]?.text;
    const artist = tr?.subtitle?.runs?.map(r => r.text).join('') || '';
    const thumbs = tr?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
    const thumb  = getBestThumb(thumbs);
    const videoId =
      tr?.navigationEndpoint?.watchEndpoint?.videoId ||
      tr?.navigationEndpoint?.watchPlaylistEndpoint?.videoId ||
      tr?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
    if (videoId && title) return { id: videoId, title, artist, thumb };
  }

  // Responsive list item
  const rl = item?.musicResponsiveListItemRenderer;
  if (rl) {
    const title  = rl?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
    const artist = rl?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map(r=>r.text).join('') || '';
    const thumbs = rl?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
    const thumb  = getBestThumb(thumbs);
    const videoId =
      rl?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
      rl?.navigationEndpoint?.watchEndpoint?.videoId;
    if (videoId && title) return { id: videoId, title, artist, thumb };
  }

  return null;
}
