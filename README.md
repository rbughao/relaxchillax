# HotelDeals Scout

A Node.js + Express hotel deals aggregator that crawls 21 hotel chain websites and serves a live single-page dashboard.

## Prerequisites

- Node.js 18 or higher
- npm

## Quick Start

```bash
npm install
npm start
```

Then open http://localhost:3000 in your browser.

## Manual Crawl

```bash
# Trigger a crawl via the API
curl -X POST http://localhost:3000/api/crawl

# Or run the crawl script directly
npm run crawl
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deals` | All cached deals |
| GET | `/api/deals?chain=marriott` | Filter by chain slug |
| GET | `/api/deals?tier=1` | Filter by tier (1–4) |
| GET | `/api/deals?sort=discount` | Sort by highest discount |
| GET | `/api/deals?recommended=true` | Recommended deals only (top 5) |
| POST | `/api/crawl` | Trigger manual crawl |
| GET | `/api/status` | Last crawl time + per-chain log |

## How Crawlers Work

Each crawler file in `crawlers/` exports an `async function crawl(): Promise<Deal[]>`.

Hotel chain websites are often React/Vue SPAs — Cheerio can only parse server-rendered HTML. When a site returns 0 deals (as most will), the orchestrator automatically falls back to 3 realistic mock deals for that chain (marked `isMock: true`). This is **expected behavior**, not an error.

### Updating a Scraper

1. Open the relevant file in `crawlers/` (e.g. `crawlers/marriott.js`)
2. Open the hotel's deals page in your browser and inspect the DOM
3. Find the deal container, title, description, image, and discount selectors
4. Update the `// SELECTORS` comment block and the `.each()` logic accordingly

The `// SELECTORS` comment at the top of each file documents what to look for:

```js
// SELECTORS — update these if the site redesigns
// Deal container : .selector-here
// Title          : .selector-here
// ...
```

## Image Hotlinking

Deal images link directly to each hotel chain's own CDN (e.g. `cache.marriott.com`). Some CDNs block images from external origins via CORS or hotlink protection. The `onerror` handler in the frontend automatically replaces blocked images with a per-chain branded gradient placeholder — no broken image icons.

## Upgrading Past Bot Protection

If a hotel chain blocks automated HTTP requests, replace the `axios.get()` call in that crawler with a ScraperAPI or Firecrawl request:

```js
// ScraperAPI drop-in replacement:
const url = `http://api.scraperapi.com?api_key=${process.env.SCRAPER_API_KEY}&url=${encodeURIComponent(DEALS_URL)}`;
const { data } = await axios.get(url, { timeout: 30000 });
```

## Recommendation Score

After every crawl, each deal is scored and the top 5 are marked `isRecommended: true`:

```
score = (discountPct × 0.6)
      + (daysUntilExpiry < 7 ? 20 : 0)
      + tierBonus
```

| Tier | Bonus |
|------|-------|
| 1 (Global Giants) | +15 |
| 2 (Major Regional) | +10 |
| 3 (Lifestyle/Boutique) | +7 |
| 4 (Budget/Extended) | +3 |

Scores are recomputed after every crawl and saved to `deals.json`.

## Environment Variables

Create a `.env` file in the project root (one already exists with defaults):

```
PORT=3000
CRAWL_INTERVAL_HOURS=6
```

## Dev Mode (auto-restart)

```bash
npm run dev
```

Requires nodemon (installed as devDependency).
