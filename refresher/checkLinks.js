/**
 * checkLinks.js — verify that every bookingUrl in deals.md leads to its offer.
 *
 * Uses the same hidden-browser verification as a scrape (browserScraper.js
 * verifyLink): the page must load, must not be a homepage / sign-in / T&Cs /
 * "not found" page, and must mention the offer's title words.
 *
 * Run from refresher/:   npx electron checkLinks.js
 * Prints one line per deal and writes link-report.json next to deals.md.
 */

const { app } = require('electron');
const fs   = require('fs');
const path = require('path');
const { checkDealLinks } = require('./browserScraper');

const DEALS_MD = path.join(__dirname, '..', 'deals.md');
const REPORT   = path.join(__dirname, '..', 'link-report.json');

function parseDeals(md) {
  const deals = [];
  for (const block of md.split(/\n---\n/)) {
    const hm = block.match(/^##\s+(.+)$/m);
    if (!hm) continue;
    const props = {};
    for (const line of block.split('\n')) {
      const m = line.match(/^-\s+(\w+):[ \t]*(.*)/);
      if (m) props[m[1]] = m[2].trim();
    }
    const heading = hm[1].trim();
    const idx = heading.indexOf(' — ');
    deals.push({
      heading,
      title:      idx >= 0 ? heading.slice(idx + 3) : heading,
      chain:      props.chain || '',
      chainSlug:  props.chainSlug || '',
      bookingUrl: props.bookingUrl || '',
    });
  }
  return deals;
}

// Keep running while the hidden per-chain windows open and close
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const deals  = parseDeals(fs.readFileSync(DEALS_MD, 'utf8'));
  const report = [];
  console.log(`Checking ${deals.length} offer links…\n`);

  await checkDealLinks(deals, r => {
    report.push(r);
    console.log(`${r.status.padEnd(9)} ${r.chainSlug.padEnd(12)} ${r.title.slice(0, 44).padEnd(44)} ${r.note || ''}`);
  });

  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf8');
  const counts = report.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {});
  console.log('\n' + JSON.stringify(counts) + `\nReport → ${REPORT}`);
  app.quit();
});
