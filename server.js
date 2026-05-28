require('dotenv').config();

const express = require('express');
const path = require('path');
const cron = require('node-cron');
const { crawlAll, getStatus, getDeals, isCrawling, CHAINS } = require('./crawlers/index');
const logger = require('./utils/logger');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const CRAWL_HOURS = parseInt(process.env.CRAWL_INTERVAL_HOURS || '6', 10);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET /api/deals
app.get('/api/deals', (req, res) => {
  let deals = getDeals();
  const { chain, tier, sort, recommended } = req.query;

  // Filter expired
  const now = new Date();
  deals = deals.filter(d => !d.validUntil || new Date(d.validUntil) >= now);

  if (chain) {
    const slug = chain.toLowerCase();
    deals = deals.filter(d => d.chainSlug === slug);
  }

  if (tier) {
    const tierNum = parseInt(tier, 10);
    deals = deals.filter(d => d.tier === tierNum);
  }

  if (recommended === 'true') {
    deals = deals.filter(d => d.isRecommended);
  }

  if (sort === 'discount') {
    deals = deals.slice().sort((a, b) => b.discountPct - a.discountPct);
  } else if (sort === 'expiring') {
    deals = deals.slice().sort((a, b) => {
      const aDate = a.validUntil ? new Date(a.validUntil) : new Date('9999-12-31');
      const bDate = b.validUntil ? new Date(b.validUntil) : new Date('9999-12-31');
      return aDate - bDate;
    });
  }

  res.json({ count: deals.length, deals });
});

// POST /api/crawl
app.post('/api/crawl', async (req, res) => {
  if (isCrawling()) {
    return res.status(429).json({ ok: false, error: 'Crawl already in progress' });
  }
  try {
    const result = await crawlAll();
    res.json(result);
  } catch (err) {
    logger.error(`Manual crawl failed: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/status
app.get('/api/status', (req, res) => {
  const status = getStatus();
  const chainList = CHAINS.map(c => ({
    slug: c.slug,
    name: c.name,
    tier: c.tier,
    ...(status.chains && status.chains[c.slug] ? status.chains[c.slug] : { dealCount: 0, usedMock: null, error: null, crawledAt: null }),
  }));
  res.json({ ...status, chainList });
});

// Fallback to SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  logger.info(`HotelDeals Scout listening on http://localhost:${PORT}`);

  // Schedule recurring crawl
  const cronExpr = `0 */${CRAWL_HOURS} * * *`;
  cron.schedule(cronExpr, () => {
    logger.info(`Scheduled crawl triggered (every ${CRAWL_HOURS}h)`);
    crawlAll().catch(err => logger.error(`Scheduled crawl error: ${err.message}`));
  });
  logger.info(`Crawl scheduled: ${cronExpr}`);

  // Auto-crawl on startup
  crawlAll().catch(err => logger.error(`Startup crawl error: ${err.message}`));
});
