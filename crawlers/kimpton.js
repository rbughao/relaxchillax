const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const { getRandom } = require('../utils/userAgents');
const { resolveImageUrl, resolveUrl } = require('../utils/imageUtils');

const BASE_URL = 'https://www.ihg.com';
const DEALS_URL = 'https://www.ihg.com/kimptonhotels/hotels/us/en/offers';

// SELECTORS — update these if the site redesigns
// Deal container : [class*="offer-card"], [class*="offer-tile"], [class*="promo-item"]
// Title          : [class*="offer-title"], h3, h2
// Description    : [class*="offer-desc"], p
// Discount       : [class*="savings"], [class*="discount"]
// Image          : img[src], img[data-src] (resolve to absolute URL)
// Valid dates    : [class*="date"], [class*="valid"]
// Booking URL    : a[href] (resolve to absolute URL)

function parseDiscountPct(text) {
  if (!text) return 0;
  const m = text.match(/(\d+)\s*%/);
  return m ? parseInt(m[1], 10) : 0;
}

function buildTags(title, desc) {
  const text = `${title} ${desc}`.toLowerCase();
  const tags = [];
  if (text.includes('member') || text.includes('inner circle')) tags.push('member');
  if (text.includes('weekend')) tags.push('weekend');
  if (text.includes('boutique')) tags.push('boutique');
  if (text.includes('pet')) tags.push('pet-friendly');
  if (text.includes('extended') || text.includes('longer')) tags.push('extended stay');
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

    $('[class*="offer-card"], [class*="offer-tile"], [class*="promo-item"]').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h3, h2, [class*="title"]').first().text().trim();
        if (!title) return;

        const description = $el.find('p, [class*="desc"]').first().text().trim();
        const discountText = $el.find('[class*="savings"], [class*="discount"]').first().text().trim();
        const discountPct = parseDiscountPct(discountText) || 15;
        const imgEl = $el.find('img').first();
        const imageUrl = resolveImageUrl(imgEl, BASE_URL);
        const linkEl = $el.find('a[href]').first();
        const bookingUrl = resolveUrl(linkEl.attr('href'), BASE_URL) || DEALS_URL;

        deals.push({
          id: uuidv4(),
          chain: 'Kimpton Hotels',
          chainSlug: 'kimpton',
          tier: 3,
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
