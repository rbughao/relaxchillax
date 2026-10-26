/**
 * scrape.js — run the scraper without the app window, for review before saving.
 *
 * Run from refresher/:   npx electron scrape.js [slug ...]     (no slugs = all chains)
 * Prints each chain's offers with their link-check status and writes
 * scrape-results.json next to deals.md. Nothing is added to deals.md —
 * review the results, then add the good ones (dealsFile.appendDeals or the app).
 */

const { app } = require('electron');
const fs   = require('fs');
const path = require('path');
const { scrapeAll } = require('./browserScraper');

const OUT = path.join(__dirname, '..', 'scrape-results.json');

// Keep running while the hidden per-chain windows open and close
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const slugs   = process.argv.slice(2).filter(a => !a.startsWith('-') && !a.endsWith('.js'));
  const results = [];

  await scrapeAll(slugs.length ? slugs : null, ev => {
    if (ev.type !== 'result') return;
    results.push(ev);
    console.log(`\n${ev.slug} — ${ev.status}${ev.error ? ' (' + ev.error + ')' : ''}`);
    for (const d of ev.deals) {
      console.log(`  ${(d.linkStatus || '').padEnd(9)} ${d.title.slice(0, 60).padEnd(60)} ${d.imageUrl ? 'img' : '---'}  ${d.linkNote || ''}`);
    }
  });

  fs.writeFileSync(OUT, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nResults → ${OUT}`);
  app.quit();
});
