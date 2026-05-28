const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'source', 'campaign',
];

function resolveImageUrl(el, baseDomain) {
  const rawSrc = el.attr('data-src')
    || el.attr('data-lazy-src')
    || el.attr('data-original')
    || el.attr('src')
    || '';

  if (!rawSrc || rawSrc.startsWith('data:')) return null;

  // srcset fallback: take first entry
  const srcset = el.attr('srcset');
  const candidate = rawSrc || (srcset ? srcset.split(',')[0].trim().split(' ')[0] : '');
  if (!candidate) return null;

  return resolveUrl(candidate, baseDomain);
}

function resolveUrl(href, baseDomain) {
  if (!href) return null;
  href = href.trim();
  if (!href || href.startsWith('data:')) return null;

  let resolved;
  if (href.startsWith('//')) {
    resolved = 'https:' + href;
  } else if (href.startsWith('http://') || href.startsWith('https://')) {
    resolved = href;
  } else {
    try {
      resolved = new URL(href, baseDomain).toString();
    } catch {
      return null;
    }
  }

  try {
    const url = new URL(resolved);
    TRACKING_PARAMS.forEach(p => url.searchParams.delete(p));
    return url.toString();
  } catch {
    return resolved;
  }
}

module.exports = { resolveImageUrl, resolveUrl };
