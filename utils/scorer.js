function daysUntilExpiry(validUntil) {
  if (!validUntil) return 999;
  const diff = new Date(validUntil) - new Date();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function tierBonus(tier) {
  if (tier === 1) return 15;
  if (tier === 2) return 10;
  if (tier === 3) return 7;
  return 3;
}

function applyScores(deals) {
  const scored = deals.map(deal => {
    const days = daysUntilExpiry(deal.validUntil);
    const score = (deal.discountPct * 0.6) + (days < 7 ? 20 : 0) + tierBonus(deal.tier);
    return { ...deal, _score: score, isRecommended: false };
  });

  scored.sort((a, b) => b._score - a._score);

  const topN = Math.min(5, scored.length);
  for (let i = 0; i < topN; i++) {
    scored[i].isRecommended = true;
  }

  return scored.map(({ _score, ...deal }) => deal);
}

module.exports = { applyScores };
