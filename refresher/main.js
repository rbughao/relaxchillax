/**
 * main.js — Electron main process
 * Handles IPC for scraping, deal management, and file I/O.
 */

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path  = require('path');
const { scrapeAll, scrapeOne, CHAINS } = require('./browserScraper');
const { DEALS_MD, parseMdDeals, appendDeals, updateDeal, removeDeal } = require('./dealsFile');

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
