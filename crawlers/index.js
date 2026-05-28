const fs = require('fs');
const path = require('path');
const { applyScores } = require('../utils/scorer');
const { parseMarkdownDeals } = require('../utils/markdownParser');
const logger = require('../utils/logger');

const DEALS_FILE = path.join(__dirname, '..', 'deals.json');
const STATUS_FILE = path.join(__dirname, '..', 'crawl-status.json');
const MARKDOWN_FILE = path.join(__dirname, '..', 'deals.md');

const CHAINS = [
  { slug: 'marriott',     name: 'Marriott',              tier: 1, url: 'https://www.marriott.com/deals/hotel-deals.mi' },
  { slug: 'hilton',       name: 'Hilton',                tier: 1, url: 'https://www.hilton.com/en/hilton-honors/deals/' },
  { slug: 'ihg',          name: 'IHG',                   tier: 1, url: 'https://www.ihg.com/hotels/us/en/offers' },
  { slug: 'hyatt',        name: 'Hyatt',                 tier: 1, url: 'https://www.hyatt.com/offers' },
  { slug: 'accor',        name: 'Accor',                 tier: 1, url: 'https://all.accor.com/promotions/index.en.shtml' },
  { slug: 'banyantree',   name: 'Banyan Tree',           tier: 1, url: 'https://www.banyantree.com/en/offers' },
  { slug: 'wyndham',      name: 'Wyndham',               tier: 2, url: 'https://www.wyndhamhotels.com/offers' },
  { slug: 'bestwestern',  name: 'Best Western',          tier: 2, url: 'https://www.bestwestern.com/en_US/hotels/deals-and-offers.html' },
  { slug: 'choicehotels', name: 'Choice Hotels',         tier: 2, url: 'https://www.choicehotels.com/deals' },
  { slug: 'radisson',     name: 'Radisson',              tier: 2, url: 'https://www.radissonhotels.com/en-us/offers' },
  { slug: 'melia',        name: 'Melia Hotels',          tier: 2, url: 'https://www.melia.com/en/offers' },
  { slug: 'kimpton',      name: 'Kimpton Hotels',        tier: 3, url: 'https://www.ihg.com/kimptonhotels/hotels/us/en/offers' },
  { slug: 'autograph',    name: 'Autograph Collection',  tier: 3, url: 'https://www.marriott.com/autograph-collection/deals.mi' },
  { slug: 'curio',        name: 'Curio Collection',      tier: 3, url: 'https://www.hilton.com/en/curio-collection/deals/' },
  { slug: 'tribute',      name: 'Tribute Portfolio',     tier: 3, url: 'https://www.marriott.com/tribute-portfolio/deals.mi' },
  { slug: 'hardrock',     name: 'Hard Rock Hotels',      tier: 3, url: 'https://www.hardrock.com/hotels/special-offers' },
  { slug: 'motel6',       name: 'Motel 6',               tier: 4, url: 'https://www.motel6.com/en/deals.html' },
  { slug: 'extendedstay', name: 'Extended Stay America', tier: 4, url: 'https://www.extendedstayamerica.com/deals' },
  { slug: 'laquinta',     name: 'La Quinta',             tier: 4, url: 'https://www.laquinta.com/hotel-deals' },
  { slug: 'redroof',      name: 'Red Roof Inn',          tier: 4, url: 'https://www.redroof.com/deals' },
  { slug: 'studio6',      name: 'Studio 6',              tier: 4, url: 'https://www.staystudio6.com/en/deals.html' },
  { slug: 'aman',         name: 'Aman',                  tier: 1, url: 'https://www.aman.com/offers' },
  { slug: 'kempinski',    name: 'Kempinski',             tier: 1, url: 'https://www.kempinski.com/en/offers' },
  { slug: 'millennium',   name: 'Millennium Hotels',     tier: 2, url: 'https://www.millenniumhotels.com/en/offers/' },
  { slug: 'rosewood',     name: 'Rosewood Hotels',       tier: 1, url: 'https://www.rosewoodhotels.com/en/offers' },
];

let crawlInProgress = false;
let currentStatus = loadStatus();

function loadStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch {
    return { lastCrawl: null, totalDeals: 0, chains: {} };
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function crawlAll() {
  if (crawlInProgress) {
    logger.warn('Parse already in progress — skipping');
    return { ok: false, error: 'Parse already in progress' };
  }

  crawlInProgress = true;
  logger.info('Loading deals from deals.md');

  try {
    const deals = parseMarkdownDeals(MARKDOWN_FILE);
    logger.info(`Parsed ${deals.length} deals from markdown`);

    const scored = applyScores(deals);
    writeJson(DEALS_FILE, scored);

    const chainStatus = {};
    for (const chain of CHAINS) {
      const chainDeals = scored.filter(d => d.chainSlug === chain.slug);
      chainStatus[chain.slug] = {
        name: chain.name,
        tier: chain.tier,
        dealCount: chainDeals.length,
        usedMock: false,
        error: null,
        crawledAt: new Date().toISOString(),
      };
    }

    const onlineChains = Object.values(chainStatus).filter(c => c.dealCount > 0).length;
    currentStatus = {
      lastCrawl: new Date().toISOString(),
      totalDeals: scored.length,
      onlineChains,
      totalChains: CHAINS.length,
      chains: chainStatus,
    };
    writeJson(STATUS_FILE, currentStatus);

    logger.info(`Done: ${scored.length} deals, ${onlineChains}/${CHAINS.length} chains with content`);
    return { ok: true, totalDeals: scored.length, onlineChains, totalChains: CHAINS.length, chains: chainStatus };
  } catch (err) {
    logger.error(`Markdown parse failed: ${err.message}`);
    return { ok: false, error: err.message };
  } finally {
    crawlInProgress = false;
  }
}

function getStatus() {
  return currentStatus;
}

function getDeals() {
  try {
    return JSON.parse(fs.readFileSync(DEALS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function isCrawling() {
  return crawlInProgress;
}

module.exports = { crawlAll, getStatus, getDeals, isCrawling, CHAINS };
