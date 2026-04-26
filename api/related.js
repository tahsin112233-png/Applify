// Fetches related/similar songs after each track ends
const YT_API_KEY = process.env.YT_API_KEY || '';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600');

  const { videoId, artist, title, region = 'US' } = req.query;
  if (!videoId) return res.status(400).json({ results: [] });

  try {
    // Search for related songs by same artist + genre
    const queries = [
      artist ? `${artist} songs` : null,
      title  ? `${title.split(' ').slice(0,3).join(' ')} similar` : null,
      `related to ${title || videoId}`,
    ].filter(Boolean);

    const q = queries[0];
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', q);
    url.searchParams.set('type', 'video');
    url.searchParams.set('videoCategoryId', '10');
    url.searchParams.set('maxResults', '15');
    url.searchParams.set('regionCode', region.toUpperCase().slice(0,2));
    url.searchParams.set('key', YT_API_KEY);

    const r = await fetch(url.toString());
    if (!r.ok) throw new Error('YT API ' + r.status);
    const data = await r.json();

    const results = (data.items || [])
      .filter(item => item.id?.videoId !== videoId)
      .map(item => ({
        id:     item.id?.videoId,
        title:  item.snippet?.title,
        artist: (item.snippet?.channelTitle || '')
          .replace(/ - Topic$/i,'').replace(/VEVO$/i,'').replace(/Official$/i,'').trim(),
        thumb:  item.snippet?.thumbnails?.high?.url ||
                item.snippet?.thumbnails?.medium?.url || '',
      }))
      .filter(t => t.id && t.title);

    return res.json({ results });
  } catch (err) {
    console.error('[related]', err.message);
    return res.status(500).json({ results: [], error: err.message });
  }
};
