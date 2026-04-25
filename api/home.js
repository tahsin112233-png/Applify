const YT_API_KEY = process.env.YT_API_KEY || '';

const REGION_NAMES = {
  BD:'Bangladesh', IN:'India', US:'USA', GB:'UK', PK:'Pakistan',
  NG:'Nigeria', BR:'Brazil', JP:'Japan', KR:'South Korea',
  DE:'Germany', FR:'France', CA:'Canada', AU:'Australia', MX:'Mexico', AE:'UAE',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  const region = (req.query.region || 'BD').toUpperCase().slice(0, 2);

  if (!YT_API_KEY) {
    return res.status(500).json({ sections: [], error: 'YT_API_KEY not set in Vercel environment variables' });
  }

  try {
    const isSubcontinent = ['BD','IN','PK'].includes(region);
    const isAsia = ['JP','KR','CN'].includes(region);

    const [trending, globalHits, regional, kpop, international] = await Promise.all([
      fetchTrending(region),
      region !== 'US' ? fetchTrending('US') : Promise.resolve([]),
      isSubcontinent ? fetchSearch('latest hindi bangla songs 2025', region) :
      isAsia         ? fetchSearch('new asian music 2025', region) :
                       fetchSearch('top pop music 2025', region),
      fetchSearch('kpop new songs 2025', 'KR'),
      fetchSearch('top english hits 2025', 'US'),
    ]);

    const sections = [];

    if (trending.length)
      sections.push({ title: `Trending in ${REGION_NAMES[region] || region}`, items: trending });

    if (globalHits.length && region !== 'US')
      sections.push({ title: 'Global Hits', items: globalHits.slice(0, 15) });

    if (regional.length)
      sections.push({
        title: isSubcontinent ? 'Desi Hits' : isAsia ? 'Asian Hits' : 'Top Picks',
        items: regional.slice(0, 15)
      });

    if (kpop.length)
      sections.push({ title: 'K-Pop', items: kpop.slice(0, 12) });

    if (international.length)
      sections.push({ title: 'International', items: international.slice(0, 15) });

    return res.json({ sections, region });
  } catch (err) {
    console.error('[home]', err.message);
    return res.status(500).json({ sections: [], error: err.message });
  }
};

async function fetchTrending(region) {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('chart', 'mostPopular');
    url.searchParams.set('videoCategoryId', '10');
    url.searchParams.set('maxResults', '20');
    url.searchParams.set('regionCode', region);
    url.searchParams.set('key', YT_API_KEY);

    const r = await fetch(url.toString());
    if (!r.ok) return [];
    const data = await r.json();

    return (data.items || []).map(item => ({
      id:     item.id,
      title:  item.snippet?.title,
      artist: cleanChannel(item.snippet?.channelTitle),
      thumb:  item.snippet?.thumbnails?.maxres?.url ||
              item.snippet?.thumbnails?.high?.url ||
              item.snippet?.thumbnails?.medium?.url || '',
    })).filter(t => t.id && t.title);
  } catch { return []; }
}

async function fetchSearch(q, region) {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', q);
    url.searchParams.set('type', 'video');
    url.searchParams.set('videoCategoryId', '10');
    url.searchParams.set('maxResults', '15');
    url.searchParams.set('order', 'relevance');
    url.searchParams.set('regionCode', region);
    url.searchParams.set('key', YT_API_KEY);

    const r = await fetch(url.toString());
    if (!r.ok) return [];
    const data = await r.json();

    return (data.items || []).map(item => ({
      id:     item.id?.videoId,
      title:  item.snippet?.title,
      artist: cleanChannel(item.snippet?.channelTitle),
      thumb:  item.snippet?.thumbnails?.high?.url ||
              item.snippet?.thumbnails?.medium?.url || '',
    })).filter(t => t.id && t.title);
  } catch { return []; }
}

function cleanChannel(name) {
  return (name || '').replace(/ - Topic$/i, '').replace(/VEVO$/i, '').replace(/Official$/i, '').trim();
}
