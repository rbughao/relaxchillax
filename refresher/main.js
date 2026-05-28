/**
 * main.js — Electron main process
 * Handles IPC for scraping, deal management, and file I/O.
 */

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path  = require('path');
const fs    = require('fs');
const { scrapeAll, scrapeOne, CHAINS } = require('./browserScraper');

// ── Paths ──────────────────────────────────────────────────────────────────
const DEALS_MD = path.join(__dirname, '..', 'deals.md');

// ── Window ─────────────────────────────────────────────────────────────────
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width:  1100,
    height: 780,
    minWidth: 860,
    minHeight: 600,
    title: 'Relax Chillax — Deal Refresher',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ── Helpers ────────────────────────────────────────────────────────────────
function readDealsMd() {
  try { return fs.readFileSync(DEALS_MD, 'utf8'); } catch { return ''; }
}

/** Parse deals.md → array of plain objects (title + meta only, for display) */
function parseMdDeals() {
  const raw = readDealsMd();
  const blocks = raw.split(/\n---\n/);
  const deals = [];
  for (const block of blocks) {
    const hm = block.match(/^##\s+(.+)$/m);
    if (!hm) continue;
    const title = hm[1].trim();
    const props = {};
    for (const line of block.split('\n')) {
      const m = line.match(/^-\s+(\w+):\s*(.*)/);
      if (m) props[m[1]] = m[2].trim();
    }
    deals.push({ title, ...props });
  }
  return deals;
}

/** Convert a scraped deal object → markdown block string */
function dealToMarkdown(deal) {
  const tags = Array.isArray(deal.tags) ? deal.tags.join(', ') : (deal.tags || '');
  return [
    `## ${deal.title}`,
    `- chain: ${deal.chain || ''}`,
    `- chainSlug: ${deal.chainSlug || ''}`,
    `- tier: ${deal.tier || 1}`,
    `- discount: ${deal.discount || ''}`,
    `- discountPct: ${deal.discountPct || 0}`,
    `- validFrom: ${deal.validFrom || ''}`,
    `- validUntil: ${deal.validUntil || ''}`,
    `- imageUrl: ${deal.imageUrl || ''}`,
    `- imageAlt: ${deal.imageAlt || ''}`,
    `- bookingUrl: ${deal.bookingUrl || ''}`,
    `- location: ${deal.location || ''}`,
    `- tags: ${tags}`,
    '',
    deal.description || deal.title,
  ].join('\n');
}

/** Append deal blocks to deals.md, deduplicating by title */
function appendDeals(newDeals) {
  const current = readDealsMd();
  const existingTitles = new Set();
  for (const block of current.split(/\n---\n/)) {
    const hm = block.match(/^##\s+(.+)$/m);
    if (hm) existingTitles.add(hm[1].trim().toLowerCase());
  }

  const toAdd = newDeals.filter(d => !existingTitles.has(d.title.toLowerCase()));
  if (!toAdd.length) return { added: 0, skipped: newDeals.length };

  const blocks = toAdd.map(dealToMarkdown).join('\n\n---\n\n');
  const suffix = current.endsWith('\n') ? '' : '\n';
  fs.appendFileSync(DEALS_MD, `${suffix}\n---\n\n${blocks}\n`, 'utf8');
  return { added: toAdd.length, skipped: newDeals.length - toAdd.length };
}

/** Replace a deal block in deals.md by matching its ## title */
function updateDeal(originalTitle, updatedDeal) {
  let content = readDealsMd();
  const blocks = content.split(/\n---\n/);
  let replaced = false;
  const newBlocks = blocks.map(block => {
    const hm = block.match(/^##\s+(.+)$/m);
    if (hm && hm[1].trim().toLowerCase() === originalTitle.toLowerCase()) {
      replaced = true;
      return '\n' + dealToMarkdown(updatedDeal);
    }
    return block;
  });
  if (replaced) {
    fs.writeFileSync(DEALS_MD, newBlocks.join('\n---\n'), 'utf8');
  }
  return replaced;
}

/** Remove a deal block from deals.md by title */
function removeDeal(title) {
  let content = readDealsMd();
  const blocks = content.split(/\n---\n/);
  const filtered = blocks.filter(block => {
    const hm = block.match(/^##\s+(.+)$/m);
    return !(hm && hm[1].trim().toLowerCase() === title.toLowerCase());
  });
  if (filtered.length < blocks.length) {
    fs.writeFileSync(DEALS_MD, filtered.join('\n---\n'), 'utf8');
    return true;
  }
  return false;
}

// ── IPC Handlers ───────────────────────────────────────────────────────────

/** Return current deals from deals.md */
ipcMain.handle('get-deals', () => parseMdDeals());

/** Return the CHAINS catalogue */
ipcMain.handle('get-chains', () => CHAINS);

/** Scrape all or selected chains; stream progress to renderer */
ipcMain.handle('start-scrape', async (event, { slugs } = {}) => {
  const onProgress = data => {
    if (!win?.isDestroyed()) win.webContents.send('scrape-progress', data);
  };
  if (slugs && slugs.length === 1) {
    await scrapeOne(slugs[0], onProgress);
  } else {
    await scrapeAll(slugs || null, onProgress);
  }
  return { ok: true };
});

/** Append accepted deals to deals.md */
ipcMain.handle('append-deals', (event, deals) => appendDeals(deals));

/** Update a single deal in deals.md */
ipcMain.handle('update-deal', (event, { originalTitle, deal }) => updateDeal(originalTitle, deal));

/** Remove a single deal from deals.md */
ipcMain.handle('remove-deal', (event, title) => removeDeal(title));

/** Open deals.md in the system default editor */
ipcMain.handle('open-deals-md', () => shell.openPath(DEALS_MD));

/** Open an external URL in default browser */
ipcMain.handle('open-url', (event, url) => shell.openExternal(url));

/** Show the deals.md file in Explorer */
ipcMain.handle('show-deals-md', () => shell.showItemInFolder(DEALS_MD));
