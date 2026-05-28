/**
 * scraper.js — multi-strategy hotel deal scraper
 * Uses axios + cheerio; falls back gracefully when sites block scraping.
 */

const axios  = require('axios');
const cheerio = require('cheerio');

// ── Chain catalogue ────────────────────────────────────────────────────────
const CHAINS = [
  { slug:'marriott',     name:'Marriott',              tier:1, url:'https://www.marriott.com/offers.mi' },
  { slug:'hilton',       name:'Hilton',                tier:1, url:'https://www.hilton.com/en/hilton-honors/deals/' },
  { slug:'ihg',          name:'IHG',                   tier:1, url:'https://www.ihg.com/hotels/us/en/offers' },
  { slug:'hyatt',        name:'Hyatt',                 tier:1, url:'https://www.hyatt.com/offers' },
  { slug:'accor',        name:'Accor',                 tier:1, url:'https://all.accor.com/promotions/index.en.shtml' },
  { slug:'banyantree',   name:'Banyan Tree',           tier:1, url:'https://www.banyantree.com/en/offers' },
  { slug:'aman',         name:'Aman',                  tier:1, url:'https://www.aman.com/offers' },
  { slug:'kempinski',    name:'Kempinski',             tier:1, url:'https://www.kempinski.com/en/offers' },
  { slug:'rosewood',     name:'Rosewood Hotels',       tier:1, url:'https://www.rosewoodhotels.com/en/offers/luxury-hotel-offers' },
  { slug:'wyndham',      name:'Wyndham',               tier:2, url:'https://www.wyndhamhotels.com/offers' },
  { slug:'bestwestern',  name:'Best Western',          tier:2, url:'https://www.bestwestern.com/en_US/hotels/deals-and-offers.html' },
  { slug:'choicehotels', name:'Choice Hotels',         tier:2, url:'https://www.choicehotels.com/deals' },
  { slug:'radisson',     name:'Radisson',              tier:2, url:'https://www.radissonhotels.com/en-us/offers' },
  { slug:'melia',        name:'Melia Hotels',          tier:2, url:'https://www.melia.com/en/offers' },
  { slug:'millennium',   name:'Millennium Hotels',     tier:2, url:'https://www.millenniumhotels.com/en/offers/' },
  { slug:'kimpton',      name:'Kimpton Hotels',        tier:3, url:'https://www.ihg.com/kimptonhotels/hotels/us/en/offers' },
  { slug:'autograph',    name:'Autograph Collection',  tier:3, url:'https://autograph-hotels.marriott.com/offers/' },
  { slug:'curio',        name:'Curio Collection',      tier:3, url:'https://www.hilton.com/en/curio-collection/deals/' },
  { slug:'tribute',      name:'Tribute Portfolio',     tier:3, url:'https://tribute-portfolio.marriott.com/' },
  { slug:'hardrock',     name:'Hard Rock Hotels',      tier:3, url:'https://hotel.hardrock.com/offers.aspx' },
  { slug:'motel6',       name:'Motel 6',               tier:4, url:'https://www.motel6.com/en/deals.html' },
  { slug:'extendedstay', name:'Extended Stay America', tier:4, url:'https://www.extendedstayamerica.com/deals' },
  { slug:'laquinta',     name:'La Quinta',             tier:4, url:'https://www.laquinta.com/hotel-deals' },
  { slug:'redroof',      name:'Red Roof Inn',          tier:4, url:'https://www.redroof.com/deals' },
  { slug:'studio6',      name:'Studio 6',              tier:4, url:'https://www.staystudio6.com/en/deals.html' },
];
module.exports.CHAINS = CHAINS;

// ── Helpers ────────────────────────────────────────────────────────────────
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function extractDiscount(text) {
  const pats = [
    /up\s*to\s*(\d+)\s*%/i,
    /save\s*(?:up\s*to\s*)?(\d+)\s*%/i,
    /(\d+)\s*%\s*off/i,
    /(\d+)\s*%\s*savings?/i,
    /(\d+)\s*%\s*discount/i,
  ];
  for (const p of pats) {
    const m = text.match(p);
    if (m) { const v = parseInt(m[1]); if (v > 0 && v < 90) return v; }
  }
  return 0;
}

function extractValidUntil(text) {
  const now = new Date();
  const clean = text.replace(/(\d+)(st|nd|rd|th)/gi, '$1');
  const pats = [
    /(?:book|valid|offer|expires?|ends?|through|until|by)\s+(?:by\s+)?([A-Z][a-z]+ \d{1,2},? \d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
    /([A-Z][a-z]+ \d{1,2},? \d{4})/i,
  ];
  for (const p of pats) {
    const m = clean.match(p);
    if (m) {
      try { const d = new Date(m[1]); if (!isNaN(d) && d > now) return d.toISOString().slice(0,10); } catch {}
    }
  }
  return '';
}

function extractTags(text) {
  const map = {
    'member':        /member|loyalty|reward|bonvoy|honors/i,
    'advance':       /advance|early.bird|book.*ahead/i,
    'weekend':       /weekend/i,
    'breakfast':     /breakfast/i,
    'spa':           /spa|wellness/i,
    'suite':         /suite/i,
    'family':        /family|kid|children/i,
    'summer':        /summer/i,
    'extended stay': /extended.stay|long.stay|weekly/i,
    'all-inclusive': /all.inclusive/i,
    'last-minute':   /last.minute|flash.sale|urgent/i,
  };
  return Object.entries(map).filter(([,re]) => re.test(text)).map(([tag]) => tag).slice(0, 4);
}

function resolveUrl(href, base) {
  if (!href) return base;
  if (href.startsWith('http')) return href;
  try { return new URL(href, base).href; } catch { return base; }
}

// ── Single chain scraper ───────────────────────────────────────────────────
async function scrapeChain(chain) {
  const out = { slug: chain.slug, name: chain.name, tier: chain.tier,
                status: 'pending', deals: [], error: null, url: chain.url };
  try {
    const resp = await axios.get(chain.url, { timeout: 18000, headers: HEADERS, maxRedirects: 5 });
    const $ = cheerio.load(resp.data);

    // Remove noise before text extraction
    $('script[src], link, style, nav, header, footer, [class*="cookie"], [id*="cookie"]').remove();
    const bodyText = $('body').text().replace(/\s+/g,' ').slice(0, 10000);

    const deals = [];
    let found = false;

    // ── Strategy 1: DOM card extraction ───────────────────────────────────
    const cardSels = [
      '[class*="offer-card"]','[class*="offerCard"]',
      '[class*="deal-card"]','[class*="dealCard"]',
      '[class*="promo-card"]','[class*="promoCard"]',
      '[class*="offer-item"]','[class*="offerItem"]',
      '[class*="promotion-card"]',
      '.offer','.deal','.promo',
      'article[class]',
    ];
    for (const sel of cardSels) {
      const els = $(sel).toArray().slice(0, 6);
      if (!els.length) continue;
      for (const el of els) {
        const $el = $(el);
        const text = $el.text().replace(/\s+/g,' ').trim();
        if (text.length < 40) continue;
        const title    = $el.find('h1,h2,h3,h4,[class*="title"],[class*="heading"]').first().text().trim();
        const desc     = $el.find('p,[class*="desc"],[class*="body"]').first().text().trim();
        const discPct  = extractDiscount(text);
        const imgSrc   = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '';
        const linkHref = $el.find('a').first().attr('href') || '';
        if (!title || title.length < 4) continue;
        found = true;
        deals.push({
          title:       `${chain.name} — ${title.slice(0,60)}`,
          chain:       chain.name, chainSlug: chain.slug, tier: chain.tier,
          discount:    discPct ? `Up to ${discPct}% Off` : 'Special Offer',
          discountPct: discPct,
          description: (desc || text).slice(0, 280),
          bookingUrl:  resolveUrl(linkHref, chain.url),
          imageUrl:    resolveUrl(imgSrc,   chain.url),
          imageAlt:    `${chain.name} hotel offer`,
          validFrom:   '', validUntil: extractValidUntil(text),
          location:    '', tags: extractTags(text),
        });
      }
      if (found) break;
    }

    // ── Strategy 2: inline <script> JSON mining ───────────────────────────
    if (!found) {
      $('script:not([src])').each((_, el) => {
        const txt = $(el).text();
        if (!txt.includes('offer') && !txt.includes('deal') && !txt.includes('promot')) return;
        const discPct = extractDiscount(txt);
        if (discPct > 0 && !found) {
          found = true;
          deals.push({
            title: `${chain.name} — Current Offer`, chain: chain.name,
            chainSlug: chain.slug, tier: chain.tier,
            discount: `Up to ${discPct}% Off`, discountPct: discPct,
            description: `Save up to ${discPct}% at ${chain.name}. Visit the website for full details.`,
            bookingUrl: chain.url, imageUrl: '', imageAlt: `${chain.name} hotel`,
            validFrom: '', validUntil: extractValidUntil(txt), location: '',
            tags: extractTags(txt),
          });
        }
      });
    }

    // ── Strategy 3: plain text discount extraction ─────────────────────────
    if (!found) {
      const discPct   = extractDiscount(bodyText);
      const validUntil = extractValidUntil(bodyText);
      if (discPct > 0) {
        const sentence = (bodyText.match(/[^.!?]*(?:save|off|discount|deal)[^.!?]*[.!?]/i) || [''])[0].trim();
        deals.push({
          title: `${chain.name} — Current Offer`, chain: chain.name,
          chainSlug: chain.slug, tier: chain.tier,
          discount: `Up to ${discPct}% Off`, discountPct: discPct,
          description: sentence || `Save up to ${discPct}% at ${chain.name}.`,
          bookingUrl: chain.url, imageUrl: '', imageAlt: `${chain.name} hotel`,
          validFrom: '', validUntil, location: '', tags: extractTags(bodyText),
        });
      }
    }

    out.deals  = deals;
    out.status = deals.length ? 'ok' : 'no-deals';
  } catch (err) {
    const code  = err.response?.status;
    out.status  = code === 403 || code === 429 ? 'blocked' : 'error';
    out.error   = code ? `HTTP ${code}` : err.message.slice(0, 80);
  }
  return out;
}

// ── Batch scrape ──────────────────────────────────────────────────────────
module.exports.scrapeAll = async function(slugs, onProgress) {
  const targets = slugs ? CHAINS.filter(c => slugs.includes(c.slug)) : CHAINS;
  onProgress({ type: 'start', total: targets.length });
  for (let i = 0; i < targets.length; i += 4) {
    const batch   = targets.slice(i, i + 4);
    const results = await Promise.all(batch.map(scrapeChain));
    results.forEach(r => onProgress({ type: 'result', ...r }));
  }
  onProgress({ type: 'done' });
};

module.exports.scrapeOne = async function(slug, onProgress) {
  const chain = CHAINS.find(c => c.slug === slug);
  if (!chain) return;
  onProgress({ type: 'start', total: 1 });
  const result = await scrapeChain(chain);
  onProgress({ type: 'result', ...result });
  onProgress({ type: 'done' });
};
