/**
 * Fetches og:image / twitter:image from each unique bookingUrl in deals.json.
 * Outputs results to offer-images.json  { url -> imageUrl }
 *
 * Run:  node utils/extractOfferImages.js
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const DEALS_FILE  = path.join(__dirname, '..', 'deals.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'offer-images.json');
const TIMEOUT_MS  = 12000;

// Browser-like headers to avoid WAF blocks
const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'identity',
  'Cache-Control':   'no-cache',
  'Pragma':          'no-cache',
  'Sec-Fetch-Dest':  'document',
  'Sec-Fetch-Mode':  'navigate',
  'Sec-Fetch-Site':  'none',
  'Upgrade-Insecure-Requests': '1',
};

function fetchHtml(rawUrl, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    let url;
    try { url = new URL(rawUrl); } catch { return reject(new Error(`Bad URL: ${rawUrl}`)); }

    const lib     = url.protocol === 'https:' ? https : http;
    const options = { hostname: url.hostname, path: url.pathname + url.search, headers: HEADERS, timeout: TIMEOUT_MS };

    const req = lib.get(options, (res) => {
      // follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, rawUrl).href;
        res.resume();
        return resolve(fetchHtml(next, redirectCount + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.setEncoding('utf8');
      let body = '';
      // Only read first 64 KB — og:image is always in <head>
      res.on('data', chunk => {
        body += chunk;
        if (body.length > 65536) { res.destroy(); }
      });
      res.on('end',   () => resolve(body));
      res.on('close', () => resolve(body));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error',   reject);
  });
}

function extractMetaImage(html) {
  // Try og:image first, then twitter:image, then any large-ish img src in head
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1] && !m[1].startsWith('data:')) return m[1].trim();
  }
  return null;
}

async function processUrl(url) {
  try {
    const html = await fetchHtml(url);
    const img  = extractMetaImage(html);
    return { url, img, ok: true };
  } catch (err) {
    return { url, img: null, ok: false, error: err.message };
  }
}

async function main() {
  const deals = JSON.parse(fs.readFileSync(DEALS_FILE, 'utf8'));
  const urlSet = [...new Set(deals.map(d => d.bookingUrl).filter(Boolean))];
  console.log(`Fetching og:image from ${urlSet.length} unique offer URLs...\n`);

  // Process in small batches to avoid hammering servers
  const BATCH = 4;
  const results = {};
  for (let i = 0; i < urlSet.length; i += BATCH) {
    const batch = urlSet.slice(i, i + BATCH);
    const settled = await Promise.allSettled(batch.map(processUrl));
    for (const s of settled) {
      const r = s.value || { url: '?', img: null, ok: false, error: s.reason?.message };
      results[r.url] = r.img;
      const status = r.img ? '✓' : `✗ (${r.error})`;
      console.log(`  ${status}  ${r.url}`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');
  const found = Object.values(results).filter(Boolean).length;
  console.log(`\nDone. ${found}/${urlSet.length} images found → ${OUTPUT_FILE}`);
}

main().catch(err => { console.error(err); process.exit(1); });
