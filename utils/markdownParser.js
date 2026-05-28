const fs = require('fs');
const crypto = require('crypto');

function makeId(slug, title) {
  return crypto.createHash('sha256').update(slug + '|' + title).digest('hex').slice(0, 16);
}

// Extract the deal title from a heading like "Marriott — Member Rate: Up to 35% Off"
// Splits only on the FIRST " — " so titles like "Stay 4 Pay 3 — Banyan Tree" work correctly.
function extractTitle(heading) {
  const idx = heading.indexOf(' — ');
  return idx >= 0 ? heading.slice(idx + 3).trim() : heading.trim();
}

function parseMarkdownDeals(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  // Split on horizontal rules (--- on its own line)
  const blocks = raw.split(/\n---\n/);
  const deals = [];
  const now = new Date().toISOString();

  for (const block of blocks) {
    const headingMatch = block.match(/^##\s+(.+)$/m);
    if (!headingMatch) continue;

    const title = extractTitle(headingMatch[1]);
    const props = {};
    const propLines = [];

    for (const line of block.split('\n')) {
      // Match "- key: value" lines (key must be a word, value may be empty)
      const m = line.match(/^-\s+(\w+):\s*(.*)/);
      if (m) {
        const val = m[2].trim();
        props[m[1]] = val === '' ? null : val;
        propLines.push(line);
      }
    }

    // Description = non-blank lines that come after the last property line
    const lastProp = propLines[propLines.length - 1];
    const afterProps = lastProp
      ? block.slice(block.lastIndexOf(lastProp) + lastProp.length)
      : block;
    const description = afterProps
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('-'))
      .join(' ');

    const chainSlug = props.chainSlug || '';
    deals.push({
      id:            makeId(chainSlug, title),
      chain:         props.chain  || '',
      chainSlug,
      tier:          parseInt(props.tier, 10) || 1,
      title,
      description:   description || title,
      discount:      props.discount  || '',
      discountPct:   parseInt(props.discountPct, 10) || 0,
      validFrom:     props.validFrom  || null,
      validUntil:    props.validUntil || null,
      imageUrl:      props.imageUrl   || null,
      imageAlt:      props.imageAlt   || title,
      bookingUrl:    props.bookingUrl || '',
      location:      props.location   || null,
      tags:          props.tags
                       ? props.tags.split(',').map(t => t.trim()).filter(Boolean)
                       : [],
      scrapedAt:     now,
      isRecommended: false,
      isMock:        false,
    });
  }

  return deals;
}

module.exports = { parseMarkdownDeals };
