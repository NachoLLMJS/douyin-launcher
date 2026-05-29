const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';

async function fetchJson(url, opts = {}) {
  const resp = await fetch(url, {
    ...opts,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json,text/plain,*/*',
      ...(opts.headers || {}),
    },
  });
  const text = await resp.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { resp, json, text };
}

function safeText(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function pick(...vals) {
  return vals.map(safeText).find(Boolean) || '';
}

function mapTikwmVideo(v, rank) {
  const id = v.video_id || v.aweme_id || String(rank);
  const username = pick(v.author?.unique_id, v.author?.id);
  const title = (v.title || v.desc || `Trend #${rank}`).trim();
  const cover = pick(v.origin_cover, v.cover, v.ai_dynamic_cover);
  const videoUrl = pick(v.play, v.wmplay);
  const shareUrl = username
    ? `https://www.tiktok.com/@${username}/video/${id}`
    : `https://www.tiktok.com/video/${id}`;

  return {
    rank,
    id,
    title,
    views: Number(v.play_count || 0),
    likes: Number(v.digg_count || 0),
    comments: Number(v.comment_count || 0),
    shares: Number(v.share_count || 0),
    duration: Number(v.duration || 0),
    author: pick(v.author?.nickname, username) || 'Unknown',
    username,
    region: v.region || '',
    thumbnail: cover,
    videoUrl,
    shareUrl,
    source: 'tikwm-free-feed',
  };
}

async function fetchTikwmTrends(count = 30) {
  // Free, no-key feed endpoint. We query multiple regions because TikWM's feed is global-ish
  // and sometimes a single region returns repeated/low quality videos.
  const regions = ['US', 'JP', 'KR', 'TH', 'VN', 'ID', 'BR', 'FR'];
  const perRegion = 30;
  const keywords = ['trend', 'trending', 'viral', 'dance trend', 'funny', 'cat trend', 'food trend', 'douyin'];
  const urls = [
    ...regions.map(r => `https://www.tikwm.com/api/feed/list?region=${r}&count=${perRegion}`),
    ...keywords.map(k => `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(k)}&count=20`),
  ];
  const batches = await Promise.allSettled(urls.map(url => fetchJson(url)));

  const seen = new Set();
  const items = [];
  for (const batch of batches) {
    if (batch.status !== 'fulfilled') continue;
    const data = batch.value.json?.data;
    const arr = Array.isArray(data) ? data : (Array.isArray(data?.videos) ? data.videos : []);
    for (const v of arr) {
      const id = v.video_id || v.aweme_id;
      if (!id || seen.has(id) || v.is_ad) continue;
      const mapped = mapTikwmVideo(v, items.length + 1);
      if (!mapped.thumbnail || !mapped.title) continue;
      if (!mapped.duration || !/video|\.mp4|mime_type=video/i.test(mapped.videoUrl || '')) continue;
      seen.add(id);
      items.push(mapped);
    }
  }

  items.sort((a, b) => (b.views || 0) - (a.views || 0));
  return items.slice(0, Number(count || 30)).map((v, i) => ({ ...v, rank: i + 1 }));
}

async function fetchRapidApiTrends(apiKey, count = 30) {
  // 5 diverse trending categories — max unique results, minimal overlap
  // 热门=hot, 搞笑=funny, 舞蹈=dance, 美食=food, 萌宠=cute pets
  const KEYWORDS = [
    '%E7%83%AD%E9%97%A8',
    '%E6%90%9E%E7%AC%91',
    '%E8%88%9E%E8%B9%88',
    '%E7%BE%8E%E9%A3%9F',
    '%E8%90%8C%E5%AE%A0',
  ];

  const requests = KEYWORDS.map(kw =>
    fetchJson(`https://tiktok-api23.p.rapidapi.com/api/search/video?keyword=${kw}&cursor=0`, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'tiktok-api23.p.rapidapi.com',
      },
    })
      .then(({ resp, json, text }) => {
        if (!resp.ok) throw new Error(json?.message || text || `RapidAPI ${resp.status}`);
        return json;
      })
  );

  const results = await Promise.allSettled(requests);
  const errors = results.filter(r => r.status === 'rejected').map(r => r.reason?.message).filter(Boolean);

  const seen = new Set();
  const allItems = [];
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const v of (result.value?.item_list || [])) {
      if (!seen.has(v.id) && !v.isAd && !v.privateItem) {
        seen.add(v.id);
        allItems.push(v);
      }
    }
  }

  if (!allItems.length) {
    throw new Error(errors[0] || 'Sin videos');
  }

  return allItems.slice(0, Number(count)).map((v, i) => {
    const id       = v.id || String(i);
    const title    = v.desc  || `Trend #${i + 1}`;
    const plays    = v.stats?.playCount || 0;
    const likes    = v.stats?.diggCount || 0;
    const author   = v.author?.nickname || 'Unknown';
    const username = v.author?.uniqueId || '';
    const thumb    = v.video?.cover || v.video?.dynamicCover || v.video?.originCover || '';
    const videoUrl = v.video?.playAddr || v.video?.downloadAddr || '';
    const shareUrl = username
      ? `https://www.tiktok.com/@${username}/video/${id}`
      : `https://www.tiktok.com/video/${id}`;

    return {
      rank: i + 1,
      id,
      title,
      views: plays,
      likes,
      comments: v.stats?.commentCount || 0,
      shares: v.stats?.shareCount || 0,
      duration: v.video?.duration || 0,
      author,
      username,
      region: v.region || '',
      thumbnail: thumb,
      videoUrl,
      shareUrl,
      source: 'rapidapi-tiktok-api23',
    };
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  const { apiKey, count = 30 } = req.body || {};

  try {
    let rapidError = '';
    if (apiKey) {
      try {
        const trends = await fetchRapidApiTrends(apiKey, count);
        return res.status(200).json({ ok: true, source: 'rapidapi', trends });
      } catch (err) {
        rapidError = err.message || String(err);
        console.warn('[douyin] RapidAPI failed, using free TikWM feed:', rapidError);
      }
    }

    const trends = await fetchTikwmTrends(count);
    if (!trends.length) {
      return res.status(200).json({ ok: false, error: rapidError || 'Sin videos gratis' });
    }
    return res.status(200).json({ ok: true, source: 'tikwm-free-feed', fallbackFrom: rapidError || null, trends });

  } catch (err) {
    console.error('[douyin]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
