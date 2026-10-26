/**
 * browserScraper.js — Human-like Electron BrowserWindow scraper
 *
 * Technique (matches what we did manually in the chat):
 *   1. Persistent sessions — cookies & localStorage survive between app runs,
 *      so subsequent scrapes look like a returning human visitor.
 *   2. Homepage warm-up — heavily protected sites (Marriott, Hilton, etc.) see
 *      a "homepage → wait → deals page" flow, not a direct bot hit.
 *   3. Mouse simulation — sendInputEvent() generates real mouse-move and
 *      scroll events that bot-detection JS observes.
 *   4. Jittered delays — randomised pauses at every step mimic human timing.
 *   5. Lazy-load scroll — scroll halfway down then back, same technique used
 *      in the browser when we extracted live image URLs from hotel SPAs.
 *
 * URL fixes vs scraper.js:
 *   marriott:  offers.mi      (was wrong: deals/hotel-deals.mi → 404)
 *   accor:     all.accor.com/a/en.html  (was: promotions/index.en.shtml → 404)
 *   wyndham:   /hotel-deals   (was: /offers → 404)
 *   curio:     /en/p/curio-collection/  (was: /en/curio-collection/deals/ → 404)
 */

const { BrowserWindow } = require('electron');

// ── Config ─────────────────────────────────────────────────────────────────
const CONCURRENCY    = 2;      // parallel hidden windows
const RENDER_MS      = 4500;   // wait after did-finish-load for SPA render
const WARMUP_MS      = 2800;   // wait on homepage before navigating to deals
const NAV_TIMEOUT    = 45000;  // per-page timeout
const WARMUP_TIMEOUT = 25000;  // homepage timeout (less strict)
const DETAIL_TIMEOUT = 20000;  // offer page, visited to verify the link + find an image
const MAX_DETAIL_VISITS = 8;   // per chain — keeps a full scrape reasonably quick
const MIN_PHOTO_PX   = 320;    // narrower images are thumbnails, not card photos

// URLs that are icons/logos rather than photos (path segment or file name match)
const NOT_PHOTO_RE = /\.svg(\?|#|$)|(^|[\/_.-])(logo|icon|sprite|placeholder|spacer|blank)s?([\/_.-]|$)/i;

// Links that are never the offer itself: T&C popups and PDFs, account pages, etc.
const BAD_LINK_RE = /terms|conditions|legal|privacy|lightbox=|\.pdf(\?|#|$)|log-?in|sign-?in|sign-?up|register|create-?account|enrol|\/join(\.html?|\/|$)|careers|faq|contact-us/i;

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';

// ── Chain catalogue ────────────────────────────────────────────────────────
const CHAINS = [
  { slug:'marriott',     name:'Marriott',              tier:1, url:'https://www.marriott.com/offers.mi' },
  { slug:'hilton',       name:'Hilton',                tier:1, url:'https://www.hilton.com/en/offers/' },
  { slug:'ihg',          name:'IHG',                   tier:1, url:'https://www.ihg.com/hotels/us/en/offers' },
  { slug:'hyatt',        name:'Hyatt',                 tier:1, url:'https://www.hyatt.com/offers' },
  { slug:'accor',        name:'Accor',                 tier:1, url:'https://all.accor.com/a/en.html' },
  { slug:'banyantree',   name:'Banyan Tree',           tier:1, url:'https://www.banyantree.com/en/offers' },
  { slug:'aman',         name:'Aman',                  tier:1, url:'https://www.aman.com/offers' },
  { slug:'kempinski',    name:'Kempinski',             tier:1, url:'https://www.kempinski.com/en/offers' },
  { slug:'rosewood',     name:'Rosewood Hotels',       tier:1, url:'https://www.rosewoodhotels.com/en/offers' },
  { slug:'wyndham',      name:'Wyndham',               tier:2, url:'https://www.wyndhamhotels.com/hotel-deals' },
  { slug:'bestwestern',  name:'Best Western',          tier:2, url:'https://www.bestwestern.com/en_US/hotels/deals-and-offers.html' },
  { slug:'choicehotels', name:'Choice Hotels',         tier:2, url:'https://www.choicehotels.com/deals' },
  { slug:'radisson',     name:'Radisson',              tier:2, url:'https://www.radissonhotels.com/en-us/offers' },
  { slug:'melia',        name:'Melia Hotels',          tier:2, url:'https://www.melia.com/en/offers' },
  { slug:'millennium',   name:'Millennium Hotels',     tier:2, url:'https://www.millenniumhotels.com/en/offers/' },
  { slug:'kimpton',      name:'Kimpton Hotels',        tier:3, url:'https://www.ihg.com/kimptonhotels/hotels/us/en/offers' },
  { slug:'autograph',    name:'Autograph Collection',  tier:3, url:'https://autograph-hotels.marriott.com/offers/' },
  { slug:'curio',        name:'Curio Collection',      tier:3, url:'https://www.hilton.com/en/p/curio-collection/' },
  { slug:'tribute',      name:'Tribute Portfolio',     tier:3, url:'https://tribute-portfolio.marriott.com/' },
  { slug:'hardrock',     name:'Hard Rock Hotels',      tier:3, url:'https://hotel.hardrock.com/offers.aspx' },
  { slug:'motel6',       name:'Motel 6',               tier:4, url:'https://www.motel6.com/en/deals.html' },
  { slug:'extendedstay', name:'Extended Stay America', tier:4, url:'https://www.extendedstayamerica.com/deals' },
  { slug:'laquinta',     name:'La Quinta',             tier:4, url:'https://www.laquinta.com/hotel-deals' },
  { slug:'redroof',      name:'Red Roof Inn',          tier:4, url:'https://www.redroof.com/deals' },
  { slug:'studio6',      name:'Studio 6',              tier:4, url:'https://www.staystudio6.com/en/deals.html' },
];
module.exports.CHAINS = CHAINS;

// ── Sites that need a homepage visit first ─────────────────────────────────
// These use Akamai / Cloudflare / custom JS bot-detection.
// Visiting the homepage first acquires cookies + passes initial JS challenges,
// so the subsequent navigation to the deals URL looks like normal browsing.
const WARMUP_PAGES = {
  marriott:     'https://www.marriott.com/',
  hilton:       'https://www.hilton.com/',
  ihg:          'https://www.ihg.com/',
  hyatt:        'https://www.hyatt.com/',
  bestwestern:  'https://www.bestwestern.com/',
  radisson:     'https://www.radissonhotels.com/',
  melia:        'https://www.melia.com/',
  millennium:   'https://www.millenniumhotels.com/',
  extendedstay: 'https://www.extendedstayamerica.com/',
  choicehotels: 'https://www.choicehotels.com/',
  motel6:       'https://www.motel6.com/',
  studio6:      'https://www.staystudio6.com/',
  banyantree:   'https://www.banyantree.com/',
  kimpton:      'https://www.ihg.com/',
  autograph:    'https://autograph-hotels.marriott.com/',
  tribute:      'https://tribute-portfolio.marriott.com/',
};

// ── Helpers ────────────────────────────────────────────────────────────────
const sleep  = ms => new Promise(r => setTimeout(r, ms));
const jitter = ms => ms + Math.floor(Math.random() * ms * 0.5);  // +0..50%

function extractDiscount(text) {
  const pats = [
    /up\s*to\s*(\d+)\s*%/i, /save\s*(?:up\s*to\s*)?(\d+)\s*%/i,
    /(\d+)\s*%\s*off/i,      /(\d+)\s*%\s*savings?/i,
  ];
  for (const p of pats) {
    const m = text.match(p);
    if (m) { const v = parseInt(m[1]); if (v > 0 && v < 90) return v; }
  }
  return 0;
}

function extractValidUntil(text) {
  const now = new Date();
  const clean = text.replace(/(\d+)(st|nd|rd|th)/gi, '$1');
  const pats = [
    /(?:book|valid|offer|expires?|ends?|through|until|by)\s+(?:by\s+)?([A-Z][a-z]+ \d{1,2},? \d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
    /([A-Z][a-z]+ \d{1,2},? \d{4})/i,
  ];
  for (const p of pats) {
    const m = clean.match(p);
    if (m) {
      try { const d = new Date(m[1]); if (!isNaN(d) && d > now) return d.toISOString().slice(0,10); } catch {}
    }
  }
  return '';
}

function extractTags(text) {
  const map = {
    'member':        /member|loyalty|reward|bonvoy|honors/i,
    'advance':       /advance|early.bird|book.*ahead/i,
    'weekend':       /weekend/i,
    'breakfast':     /breakfast/i,
    'spa':           /spa|wellness/i,
    'suite':         /suite/i,
    'family':        /family|kid|children/i,
    'summer':        /summer/i,
    'extended stay': /extended.stay|long.stay|weekly/i,
    'all-inclusive': /all.inclusive/i,
    'last-minute':   /last.minute|flash.sale/i,
  };
  return Object.entries(map)
    .filter(([, re]) => re.test(text))
    .map(([tag]) => tag)
    .slice(0, 4);
}

// ── waitForLoad — properly handles main-frame vs sub-frame failures ─────────
function waitForLoad(win, timeout = NAV_TIMEOUT) {
  return new Promise(resolve => {
    let settled = false;
    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      win.webContents.removeListener('did-finish-load', onLoad);
      win.webContents.removeListener('did-fail-load',   onFail);
      resolve(result);
    }
    function onLoad() { finish('loaded'); }
    function onFail(e, code, desc, url, isMainFrame) { if (isMainFrame) finish('failed'); }
    const t = setTimeout(() => finish('timeout'), timeout);
    win.webContents.on('did-finish-load', onLoad);
    win.webContents.on('did-fail-load',   onFail);
  });
}

// ── simulateHuman — mouse moves + scroll — what bot-detection JS watches ───
async function simulateHuman(win) {
  // Natural mouse path across the viewport
  const moves = Array.from({ length: 8 }, () => ({
    x: Math.round(150 + Math.random() * 1000),
    y: Math.round(80  + Math.random() * 550),
  }));
  for (const { x, y } of moves) {
    try { win.webContents.sendInputEvent({ type: 'mouseMove', x, y }); } catch {}
    await sleep(jitter(70));
  }

  // Scroll down — reading pace
  await sleep(jitter(700));
  for (let i = 0; i < 4; i++) {
    try {
      win.webContents.sendInputEvent({
        type: 'mouseWheel', x: 500, y: 400,
        deltaX: 0, deltaY: -Math.round(180 + Math.random() * 140),
      });
    } catch {}
    await sleep(jitter(450));
  }

  // Pause like reading a section
  await sleep(jitter(1000));

  // Scroll back toward top
  try {
    win.webContents.sendInputEvent({ type: 'mouseWheel', x: 500, y: 400, deltaX: 0, deltaY: 800 });
  } catch {}
  await sleep(jitter(400));
}

// ── Deal extraction script — runs inside the loaded hotel page ─────────────
// Written as array-join to avoid any template-literal escape ambiguity.
const EXTRACT_SCRIPT = [
  '(function() {',
  '  var deals = [], seen = {};',
  '  function gt(el){ return (el ? el.textContent : "").replace(/\\s+/g," ").trim(); }',
  '  function res(h){',
  '    if(!h) return "";',
  '    if(h.indexOf("http")===0) return h;',
  '    try{ return new URL(h,location.href).href; }catch(e){ return h; }',
  '  }',
  '  function disc(t){',
  '    var ps=[/up\\s*to\\s*(\\d+)\\s*%/i,/save\\s*(?:up\\s*to\\s*)?(\\d+)\\s*%/i,/(\\d+)\\s*%\\s*off/i,/(\\d+)\\s*%\\s*savings?/i];',
  '    for(var i=0;i<ps.length;i++){var m=t.match(ps[i]);if(m){var v=+m[1];if(v>0&&v<90)return v;}}',
  '    return 0;',
  '  }',
  // Image picking: consider every <img>, <picture><source> and CSS background
  // in the card, take the largest srcset rendition of each (currentSrc is often
  // a lazy-load placeholder or a small rendition), skip icons/logos/SVGs, and
  // return the widest. Known-small images (< MIN_W) are rejected outright.
  '  var MIN_W=' + MIN_PHOTO_PX + ';',
  '  function bad(u){ return !u||u.indexOf("data:")===0||' + NOT_PHOTO_RE + '.test(u); }',
  '  function largest(ss){',
  '    var top="",tw=-1;',
  '    (ss||"").split(/,\\s+/).forEach(function(p){',
  '      var a=p.trim().split(/\\s+/), d=a[1]||"";',
  '      var w=/w$/.test(d)?parseInt(d,10):/x$/.test(d)?parseFloat(d):0;',
  '      if(a[0]&&w>tw){tw=w;top=a[0];}',
  '    });',
  '    return {u:top,w:/w$/.test(ss||"")?tw:0};',
  '  }',
  '  function img(el){',
  '    var best={u:"",w:-1};',
  '    function consider(u,w){ u=(u||"").trim(); if(!bad(u)&&w>best.w) best={u:u,w:w}; }',
  '    el.querySelectorAll("img,picture source").forEach(function(i){',
  '      var ss=largest(i.getAttribute("srcset")||i.getAttribute("data-srcset"));',
  '      var w=Math.max(ss.w,i.naturalWidth||0,parseInt(i.getAttribute("width"),10)||0);',
  '      consider(ss.u||i.getAttribute("data-src")||i.getAttribute("data-lazy-src")||i.getAttribute("data-original")||i.currentSrc||i.src,w);',
  '    });',
  '    [el].concat(Array.from(el.querySelectorAll("[style*=background]"))).forEach(function(b){',
  '      var m=(getComputedStyle(b).backgroundImage||"").match(/url\\(["\\x27]?([^"\\x27)]+)["\\x27]?\\)/);',
  '      if(m) consider(m[1],b.offsetWidth||0);',
  '    });',
  '    return best.u&&(best.w===0||best.w>=MIN_W) ? res(best.u) : "";',
  '  }',
  // Link picking: score every link in the card rather than taking the first
  // (often a T&Cs popup or a sign-up link). The title link and "Book / View
  // offer" buttons win; links back to this listing page lose. "" = no
  // usable link — the Node side then falls back to the chain's offers page.
  '  var BAD_LINK=' + BAD_LINK_RE + ';',
  '  function bare(u){ return u.split("#")[0].replace(/\\/$/,""); }',
  '  function link(el,te){',
  '    var as=Array.from(el.querySelectorAll("a[href],[data-href]")), up=el.closest("a[href]");',
  '    if(up) as.push(up);',
  '    var title=gt(te).toLowerCase(), best="", bs=-1;',
  '    as.forEach(function(a){',
  '      var h=a.getAttribute("href")||a.getAttribute("data-href")||"", u;',
  '      if(!h||/^(#|javascript:|mailto:|tel:)/i.test(h)) return;',
  '      try{ u=new URL(h,location.href); }catch(e){ return; }',
  '      if(BAD_LINK.test(u.pathname+u.search)) return;',
  '      var t=gt(a).toLowerCase(), s=0;',
  '      if(te&&(a.contains(te)||te.contains(a))) s+=4;',
  '      else if(title&&t.indexOf(title.slice(0,24))>=0) s+=3;',
  '      if(/\\b(book|view|see|explore|discover|details|learn more|more info|find out|reserve|claim|get (the )?offer)\\b/.test(t)) s+=3;',
  '      if(/offer|deal|package|promo|special|sale|discount|save|escape|getaway/i.test(u.pathname)) s+=2;',
  '      if(bare(u.href)===bare(location.href)) s-=5;',
  '      if(s>bs){ bs=s; best=u.href; }',
  '    });',
  '    return best;',
  '  }',
  '  var SELS=[',
  '    "[class*=\\"offer-card\\"]","[class*=\\"offerCard\\"]","[class*=\\"offer_card\\"]",',
  '    "[class*=\\"deal-card\\"]","[class*=\\"dealCard\\"]",',
  '    "[class*=\\"promo-card\\"]","[class*=\\"promoCard\\"]",',
  '    "[class*=\\"promotion-card\\"]","[class*=\\"promotionCard\\"]",',
  '    "[class*=\\"offer-item\\"]","[class*=\\"offerItem\\"]",',
  '    "[class*=\\"offer-tile\\"]","[class*=\\"offerTile\\"]",',
  '    "[class*=\\"deal-tile\\"]","[class*=\\"dealTile\\"]",',
  '    "[class*=\\"special-offer\\"]","[class*=\\"specialOffer\\"]",',
  '    "[class*=\\"hotel-offer\\"]","[class*=\\"hotelOffer\\"]",',
  '    "[class*=\\"package-card\\"]","[class*=\\"packageCard\\"]",',
  '    "[class*=\\"rate-card\\"]","[class*=\\"rateCard\\"]",',
  '    "[class*=\\"offer-block\\"]","[class*=\\"offerBlock\\"]",',
  '    "[data-testid*=\\"offer\\"]","[data-testid*=\\"deal\\"]","[data-testid*=\\"promo\\"]",',
  '    "[data-component*=\\"offer\\"]","[data-component*=\\"deal\\"]",',
  '    ".offer",".deal",".promo",".promotion",".package","article[class]"',
  '  ];',
  '  for(var s=0;s<SELS.length&&deals.length===0;s++){',
  '    var els; try{els=Array.from(document.querySelectorAll(SELS[s])).slice(0,8);}catch(e){continue;}',
  '    for(var e=0;e<els.length;e++){',
  '      var el=els[e], text=gt(el);',
  '      if(text.length<30) continue;',
  '      var te=el.querySelector("h1,h2,h3,h4,h5,[class*=title],[class*=heading],[class*=name],[class*=label]");',
  '      var title=gt(te).slice(0,80);',
  '      if(!title||title.length<3) continue;',
  '      var key=title.toLowerCase();',
  '      if(seen[key]) continue; seen[key]=1;',
  '      var de=el.querySelector("p,[class*=desc],[class*=body],[class*=copy],[class*=text],[class*=sub]");',
  '      var desc=gt(de)||text;',
  '      var pct=disc(text);',
  '      deals.push({title:title,description:desc.slice(0,280),discountPct:pct,',
  '        discount:pct?"Up to "+pct+"% Off":"Special Offer",',
  '        imageUrl:img(el),bookingUrl:link(el,te),rawText:text.slice(0,300)});',
  '      if(deals.length>=6) break;',
  '    }',
  '  }',
  '  if(!deals.length){',
  '    var scripts=document.querySelectorAll("script[type=\\"application/ld+json\\"]");',
  '    for(var i=0;i<scripts.length;i++){',
  '      try{',
  '        var d=JSON.parse(scripts[i].textContent);',
  '        var arr=Array.isArray(d)?d:[d];',
  '        for(var j=0;j<arr.length;j++){',
  '          var item=arr[j];',
  '          var offers=[].concat(item.specialOffers||[],item.offers||item.offer||[]);',
  '          for(var k=0;k<offers.length;k++){',
  '            var o=offers[k];',
  '            if(!o||typeof o!=="object") continue;',
  '            var t=o.name||o.headline||"";',
  '            if(!t||seen[t.toLowerCase()]) continue;',
  '            seen[t.toLowerCase()]=1;',
  '            deals.push({title:t,description:o.description||t,discountPct:0,discount:"Special Offer",',
  '              imageUrl:o.image||"",bookingUrl:o.url?res(o.url):"",rawText:""});',
  '          }',
  '        }',
  '      }catch(e){}',
  '    }',
  '  }',
  '  if(!deals.length){',
  '    var bt=document.body.innerText.replace(/\\s+/g," ");',
  '    var re=/up\\s*to\\s*(\\d+)\\s*%|save\\s*(\\d+)\\s*%|(\\d+)\\s*%\\s*off/gi;',
  '    var m,used={};',
  '    while((m=re.exec(bt))!==null&&deals.length<3){',
  '      var pct=parseInt(m[1]||m[2]||m[3],10);',
  '      if(pct>0&&pct<90&&!used[pct]){',
  '        used[pct]=1;',
  '        var sent=bt.slice(Math.max(0,m.index-60),m.index+120).trim();',
  '        deals.push({title:"Special Offer",description:sent.slice(0,280),discountPct:pct,',
  '          discount:"Up to "+pct+"% Off",imageUrl:"",bookingUrl:"",rawText:sent});',
  '      }',
  '    }',
  '  }',
  '  return deals;',
  '})();',
].join('\n');

// Page-level share image — used for offers whose card had no usable photo
const OG_IMAGE_SCRIPT = [
  '(function(){',
  '  var m=document.querySelector(\'meta[property="og:image"],meta[name="og:image"],meta[name="twitter:image"],meta[property="twitter:image"]\');',
  '  if(!m||!m.content) return "";',
  '  try{ return new URL(m.content,location.href).href; }catch(e){ return ""; }',
  '})();',
].join('\n');

const isPhotoUrl = u => !!u && /^https?:\/\//.test(u) && !NOT_PHOTO_RE.test(u);

// ── Browser window per chain ───────────────────────────────────────────────
// persist: session stores cookies/localStorage to disk between app runs —
// on the second scrape the site sees a returning visitor with cookies.
function openChainWindow(chain) {
  const win = new BrowserWindow({
    show: false,
    width: 1366,
    height: 768,
    webPreferences: {
      javascript:       true,
      nodeIntegration:  false,
      contextIsolation: true,
      partition:        'persist:scraper-' + chain.slug,
    },
  });
  win.webContents.setUserAgent(CHROME_UA);

  let httpStatus = 0;
  win.webContents.on('did-navigate', (e, url, code) => { if (code) httpStatus = code; });

  // Load a URL → { res: 'loaded'|'failed'|'timeout', status, url (after redirects) }
  win.go = async (url, timeout) => {
    httpStatus = 0;
    win.loadURL(url).catch(() => {});  // failures are reported by waitForLoad
    const res = await waitForLoad(win, timeout);
    return { res, status: httpStatus, url: win.webContents.getURL() };
  };
  return win;
}

// Homepage warm-up for bot-protected sites
async function warmUp(win, chain) {
  const warmupUrl = WARMUP_PAGES[chain.slug];
  if (!warmupUrl) return;
  const w = await win.go(warmupUrl, WARMUP_TIMEOUT);
  if (w.res === 'loaded' && w.status < 400) {
    await sleep(jitter(WARMUP_MS));   // let the homepage run its bot-detection JS
    await simulateHuman(win);         // read the homepage like a person
    await sleep(jitter(1000));        // pause before "clicking" elsewhere
  }
}

// ── Offer link verification ────────────────────────────────────────────────
// Generic words that don't identify a particular offer
const LINK_STOPWORDS = new Set((
  'the and for with your our from this that into offer offers deal deals special ' +
  'save saving savings stay stays hotel hotels resort resorts book booking night ' +
  'nights more member members rate rates exclusive package packages'
).split(' '));

// Distinctive words of an offer title, used to confirm a page is about it
function titleKeywords(title, chainName) {
  const chainWords = new Set(chainName.toLowerCase().split(/[^a-z0-9]+/));
  return [...new Set(title.toLowerCase().split(/[^a-z0-9]+/)
    .filter(w => w.length >= 4 && !LINK_STOPWORDS.has(w) && !chainWords.has(w)))];
}

const pageCheckScript = keywords => [
  '(function(){',
  '  var head=(document.title+" "+Array.from(document.querySelectorAll("h1,h2")).slice(0,8)',
  '    .map(function(h){ return h.textContent; }).join(" ")).toLowerCase();',
  '  var body=(document.body?document.body.innerText:"").toLowerCase();',
  '  var kw=' + JSON.stringify(keywords) + ';',
  '  return {',
  '    notFound: /not found|\\b404\\b|page (cannot|can.t) be found|no longer available|has expired|offer (has )?ended/.test(head),',
  '    hits: kw.filter(function(k){ return body.indexOf(k)>=0; }).length',
  '  };',
  '})();',
].join('\n');

// host + path, lower-cased, without trailing slash — for "same page" checks
function bareUrl(u) {
  try { const x = new URL(u); return (x.host.replace(/^www\./, '') + x.pathname).replace(/\/$/, '').toLowerCase(); }
  catch { return String(u); }
}

// True when u is the chain's own homepage: same host as the chain's offers
// page and a path of only locale/index segments (/, /en/, /a/en.html).
// Other subdomains' roots (e.g. groups.wyndhamhotels.com) are real destinations.
function isHomePage(u, chain) {
  try {
    const x = new URL(u), host = h => h.replace(/^www\./, '');
    if (chain && chain.url && host(x.host) !== host(new URL(chain.url).host)) return false;
    return x.pathname.split('/').filter(Boolean)
      .every(s => /^([a-z]{1,2}([-_][a-z]{2})?|home|index)(\.\w+)?$/i.test(s));
  } catch { return false; }
}

// Decide whether an offer link really leads to that offer.
//   verified   page loads and mentions the offer's title words
//   loads      page loads but the title is too generic to confirm it
//   listing    link is the chain's offers listing itself
//   replaced   broken / not an offer page — caller swaps in the listing URL
//   unchecked  couldn't tell (blocked, timed out, visit limit) — link kept
// Returns { status, note, visited, ogImage }.
async function verifyLink(win, url, title, chain, listingUrl, canVisit) {
  const same = u => bareUrl(u) === bareUrl(chain.url) || (!!listingUrl && bareUrl(u) === bareUrl(listingUrl));
  if (!url) return { status: 'replaced', note: 'offer card has no link' };
  if (!/^https?:\/\//.test(url)) return { status: 'replaced', note: 'not a web link' };
  if (BAD_LINK_RE.test(url)) return { status: 'replaced', note: 'link is a T&Cs / account page, not the offer' };
  if (same(url)) return { status: 'listing', note: 'offer has no page of its own' };
  if (isHomePage(url, chain)) return { status: 'replaced', note: 'link is the homepage' };
  if (!canVisit) return { status: 'unchecked', note: 'visit limit reached' };

  const nav = await win.go(url, DETAIL_TIMEOUT);
  const fail = note => ({ status: 'replaced', note, visited: true });
  if (nav.res === 'timeout') return { status: 'unchecked', note: 'page timed out', visited: true };
  if (nav.res === 'failed')  return fail('link failed to load');
  if (nav.status === 403 || nav.status === 429)
    return { status: 'unchecked', note: `site blocked the check (HTTP ${nav.status})`, visited: true };
  if (nav.status >= 400)     return fail(`link returns HTTP ${nav.status}`);
  if (same(nav.url))         return { status: 'listing', note: 'link redirects to the offers listing', visited: true };
  if (isHomePage(nav.url, chain)) return fail('link redirects to the homepage');
  if (BAD_LINK_RE.test(nav.url)) return fail('link redirects to a sign-in / T&Cs page');

  await sleep(jitter(1500));  // let SPA content render
  const kw = titleKeywords(title, chain.name);
  let page = { notFound: false, hits: 0 }, og = '';
  try { page = await win.webContents.executeJavaScript(pageCheckScript(kw)); } catch {}
  if (page.notFound) return fail('page says not found / expired');
  if (kw.length && page.hits < Math.ceil(kw.length / 2))
    return fail(`page doesn't mention the offer ("${kw.join(' ')}")`);
  try { og = await win.webContents.executeJavaScript(OG_IMAGE_SCRIPT); } catch {}
  return { status: kw.length ? 'verified' : 'loads', note: '', visited: true, ogImage: isPhotoUrl(og) ? og : '' };
}

// Verify each scraped offer's link — bad ones are swapped for the chain's
// offers page — and fill missing photos from the offer page's og:image,
// falling back to the listing page's og:image.
async function checkOffers(win, chain, deals) {
  const listingUrl = win.webContents.getURL();
  let listingImg = '';
  try { listingImg = await win.webContents.executeJavaScript(OG_IMAGE_SCRIPT); } catch {}
  if (!isPhotoUrl(listingImg)) listingImg = '';

  let visits = 0;
  for (const d of deals) {
    const check = await verifyLink(win, d.bookingUrl, d.title, chain, listingUrl, visits < MAX_DETAIL_VISITS);
    if (check.visited) visits++;
    d.linkStatus = check.status;
    d.linkNote   = check.note;
    if (check.status === 'replaced') {
      d.linkOriginal = d.bookingUrl;
      d.bookingUrl   = chain.url;
    }
    if (!d.imageUrl) d.imageUrl = check.ogImage || listingImg;
  }
}

// ── Single chain scraper ───────────────────────────────────────────────────
async function scrapeChain(chain) {
  const out = {
    slug: chain.slug, name: chain.name, tier: chain.tier,
    status: 'pending', deals: [], error: null, url: chain.url,
  };

  const win = openChainWindow(chain);

  try {
    // ── Step 1: Homepage warm-up for bot-protected sites ─────────────────
    await warmUp(win, chain);

    // ── Step 2: Navigate to the deals page ──────────────────────────────
    const nav = await win.go(chain.url, NAV_TIMEOUT);

    if (nav.res === 'timeout') {
      out.status = 'error'; out.error = 'Timeout'; return out;
    }
    if (nav.res === 'failed') {
      out.status = 'error'; out.error = 'Navigation failed'; return out;
    }
    if (nav.status === 403 || nav.status === 429) {
      out.status = 'blocked'; out.error = `HTTP ${nav.status}`; return out;
    }
    if (nav.status >= 400) {
      out.status = 'error'; out.error = `HTTP ${nav.status}`; return out;
    }

    // ── Step 3: Wait for SPA framework to render its components ─────────
    await sleep(RENDER_MS);

    // ── Step 4: Scroll to trigger lazy-loaded offer cards ────────────────
    // (Same technique used in the chat: scroll to reveal images/cards,
    //  then scroll back before running the extraction.)
    try {
      await win.webContents.executeJavaScript(
        'window.scrollTo(0, Math.min(1400, document.body.scrollHeight * 0.45)); true;'
      );
      await sleep(jitter(1300));
      await win.webContents.executeJavaScript('window.scrollTo(0, 0); true;');
      await sleep(400);
    } catch {}

    // ── Step 5: Run extraction script in live page context ───────────────
    const rawDeals = await win.webContents.executeJavaScript(EXTRACT_SCRIPT);

    // ── Step 6: Verify each offer link; find photos for cards without one ─
    await checkOffers(win, chain, rawDeals);

    out.deals = rawDeals.map(d => {
      const raw  = d.rawText || d.description || '';
      const pct  = d.discountPct || extractDiscount(raw);
      return {
        title:       d.title.startsWith(chain.name)
                       ? d.title
                       : `${chain.name} — ${d.title.slice(0, 60)}`,
        chain:       chain.name,
        chainSlug:   chain.slug,
        tier:        chain.tier,
        discount:    pct ? `Up to ${pct}% Off` : 'Special Offer',
        discountPct: pct,
        description: (d.description || d.title).slice(0, 280),
        bookingUrl:  d.bookingUrl || chain.url,
        linkStatus:  d.linkStatus,
        linkNote:    d.linkNote,
        linkOriginal: d.linkOriginal || '',
        imageUrl:    d.imageUrl || '',
        imageAlt:    `${chain.name} hotel offer`,
        validFrom:   '',
        validUntil:  extractValidUntil(raw),
        location:    '',
        tags:        extractTags(raw),
      };
    });
    out.status = out.deals.length ? 'ok' : 'no-deals';

  } catch (err) {
    out.status = 'error';
    out.error  = err.message.slice(0, 80);
  } finally {
    try { win.destroy(); } catch {}
  }

  return out;
}

// ── Concurrency limiter ────────────────────────────────────────────────────
async function runConcurrent(tasks, limit) {
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) { await tasks[idx++](); }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

// ── Public API (same interface as scraper.js) ──────────────────────────────
module.exports.scrapeAll = async function (slugs, onProgress) {
  const targets = slugs ? CHAINS.filter(c => slugs.includes(c.slug)) : CHAINS;
  onProgress({ type: 'start', total: targets.length });
  const tasks = targets.map(chain => async () => {
    const result = await scrapeChain(chain);
    onProgress({ type: 'result', ...result });
  });
  await runConcurrent(tasks, CONCURRENCY);
  onProgress({ type: 'done' });
};

// Check the links of deals already saved (deals.md). One window per chain,
// warmed up like a scrape so bot-protected sites let the checks through.
// Calls onResult({ ...deal, status, note }) for each deal.
module.exports.checkDealLinks = async function (deals, onResult) {
  const bySlug = {};
  for (const d of deals) (bySlug[d.chainSlug] = bySlug[d.chainSlug] || []).push(d);
  const tasks = Object.entries(bySlug).map(([slug, list]) => async () => {
    const chain = CHAINS.find(c => c.slug === slug) || { slug, name: list[0].chain || slug, url: '' };
    const win = openChainWindow(chain);
    try {
      await warmUp(win, chain);
      for (const d of list) {
        const { status, note } = await verifyLink(win, d.bookingUrl, d.title, chain, '', true);
        onResult({ ...d, status, note });
      }
    } finally {
      try { win.destroy(); } catch {}
    }
  });
  await runConcurrent(tasks, CONCURRENCY);
};

module.exports.scrapeOne = async function (slug, onProgress) {
  const chain = CHAINS.find(c => c.slug === slug);
  if (!chain) return;
  onProgress({ type: 'start', total: 1 });
  const result = await scrapeChain(chain);
  onProgress({ type: 'result', ...result });
  onProgress({ type: 'done' });
};
