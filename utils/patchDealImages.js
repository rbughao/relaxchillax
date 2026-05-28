/**
 * Reads offer-images.json (bookingUrl → imageUrl map) and deals.json,
 * then rewrites each imageUrl: line in deals.md with the real offer image.
 *
 * Run:  node utils/patchDealImages.js
 */

const fs   = require('fs');
const path = require('path');

const DEALS_FILE  = path.join(__dirname, '..', 'deals.json');
const IMAGES_FILE = path.join(__dirname, '..', 'offer-images.json');
const MD_FILE     = path.join(__dirname, '..', 'deals.md');

const deals     = JSON.parse(fs.readFileSync(DEALS_FILE, 'utf8'));
const imageMap  = JSON.parse(fs.readFileSync(IMAGES_FILE, 'utf8'));

// Build "chainSlug|title" → imageUrl (avoids collision when two chains share a title)
const keyToImage = {};
for (const deal of deals) {
  const img = imageMap[deal.bookingUrl];
  if (img) keyToImage[`${deal.chainSlug}|${deal.title}`] = img;
}

let md = fs.readFileSync(MD_FILE, 'utf8');
let patched = 0;
let skipped = 0;

// Split into deal blocks, patch each individually, then rejoin
const blocks = md.split(/\n---\n/);
const patchedBlocks = blocks.map(block => {
  const headingMatch = block.match(/^## (.+)$/m);
  if (!headingMatch) return block;

  const heading = headingMatch[1];
  const dashIdx = heading.indexOf(' — ');
  const title = dashIdx >= 0 ? heading.slice(dashIdx + 3).trim() : heading.trim();

  // Extract chainSlug from the block's "- chainSlug: xxx" line
  const slugMatch = block.match(/^-\s+chainSlug:\s*(.+)$/m);
  const chainSlug = slugMatch ? slugMatch[1].trim() : '';

  const img = keyToImage[`${chainSlug}|${title}`];
  if (!img) { skipped++; return block; }

  patched++;
  return block.replace(/^(- imageUrl:).*$/m, `$1 ${img}`);
});

fs.writeFileSync(MD_FILE, patchedBlocks.join('\n---\n'), 'utf8');
console.log(`Patched ${patched} deals, skipped ${skipped} (no image found).`);
