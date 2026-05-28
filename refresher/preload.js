/**
 * preload.js — contextBridge between main process and renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  /** Fetch current deals from deals.md */
  getDeals: () => ipcRenderer.invoke('get-deals'),

  /** Fetch the CHAINS catalogue */
  getChains: () => ipcRenderer.invoke('get-chains'),

  /**
   * Start scraping.
   * @param {string[]|null} slugs — chain slugs to scrape, or null for all
   */
  startScrape: (slugs) => ipcRenderer.invoke('start-scrape', { slugs }),

  /**
   * Append accepted deals to deals.md.
   * @param {object[]} deals
   */
  appendDeals: (deals) => ipcRenderer.invoke('append-deals', deals),

  /**
   * Update a single existing deal by its original title.
   * @param {string} originalTitle
   * @param {object} deal
   */
  updateDeal: (originalTitle, deal) => ipcRenderer.invoke('update-deal', { originalTitle, deal }),

  /**
   * Remove a deal by title.
   * @param {string} title
   */
  removeDeal: (title) => ipcRenderer.invoke('remove-deal', title),

  /** Open deals.md in default text editor */
  openDealsMd: () => ipcRenderer.invoke('open-deals-md'),

  /** Show deals.md in Explorer */
  showDealsMd: () => ipcRenderer.invoke('show-deals-md'),

  /** Open URL in browser */
  openUrl: (url) => ipcRenderer.invoke('open-url', url),

  /**
   * Listen for scrape progress events.
   * Callback receives: { type, slug?, name?, tier?, status?, deals?, error?, total? }
   */
  onScrapeProgress: (callback) => {
    ipcRenderer.on('scrape-progress', (event, data) => callback(data));
  },

  /** Remove the scrape-progress listener (call on page teardown) */
  offScrapeProgress: () => {
    ipcRenderer.removeAllListeners('scrape-progress');
  },
});
