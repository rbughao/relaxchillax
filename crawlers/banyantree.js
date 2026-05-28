const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const { getRandom } = require('../utils/userAgents');
const { resolveImageUrl, resolveUrl } = require('../utils/imageUtils');

const BASE_URL = 'https://www.banyantree.com';
const DEALS_URL = 'https://www.banyantree.com/en/offers';

// SELECTORS — update these if the site redesigns
// Deal container : .offer-item, [class*="offer-card"], [class*="promotion"]
// Title          : [class*="offer-title"], h3, h2
// Description    : [class*="offer-desc"], p
// Discount       : [class*="discount"], [class*="savings"], [class*="badge"]
// Image          : img[src], img[data-src] (resolve to absolute URL)
// Valid dates    : [class*="date"], [class*="valid"], time
// Booking URL    : a[href] (resolve to absolute URL)

function parseDiscountPct(text) {
  if (!text) return 0;
  const m = text.match(/(\d+)\s*%/);
  return m ? parseInt(m[1], 10) : 0;
}

function buildTags(title, desc) {
  const text = `${title} ${desc}`.toLowerCase();
  const tags = [];
  if (text.includes('spa')) tags.push('spa');
  if (text.includes('breakfast')) tags.push('breakfast');
  if (text.includes('romance') || text.includes('couple')) tags.push('romance');
  if (text.includes('luxury')) tags.push('luxury');
  if (text.includes('resort')) tags.push('resort');
  if (text.includes('wellness')) tags.push('wellness');
  if (text.includes('family')) tags.push('family');
  if (text.includes('long stay') || text.includes('stay 4') || text.includes('stay longer')) tags.push('long stay');
  return tags;
}

async function crawl() {
  try {
    const { data } = await axios.get(DEALS_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': getRandom(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    const $ = cheerio.load(data);
    const deals = [];

    $('[class*="offer-item"], [class*="offer-card"], [class*="promo-card"], article').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h3, h2, [class*="title"]').first().text().trim();
        if (!title) return;

        const description = $el.find('p, [class*="desc"]').first().text().trim();
        const discountText = $el.find('[class*="discount"], [class*="saving"], [class*="badge"]').first().text().trim();
        const discountPct = parseDiscountPct(discountText) || 20;
        const imgEl = $el.find('img').first();
        const imageUrl = resolveImageUrl(imgEl, BASE_URL);
        const linkEl = $el.find('a[href]').first();
        const bookingUrl = resolveUrl(linkEl.attr('href'), BASE_URL) || DEALS_URL;

        deals.push({
          id: uuidv4(),
          chain: 'Banyan Tree',
          chainSlug: 'banyantree',
          tier: 1,
          title,
          description: description || title,
          discount: discountText || `Up to ${discountPct}% Off`,
          discountPct,
          validFrom: null,
          validUntil: null,
          imageUrl,
          imageAlt: imgEl.attr('alt') || title,
          bookingUrl,
          location: null,
          tags: buildTags(title, description),
          scrapedAt: new Date().toISOString(),
          isRecommended: false,
          isMock: false,
        });
      } catch (_err) {}
    });

    return deals;
  } catch (_err) {
    return [];
  }
}

module.exports = { crawl };
