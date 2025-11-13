// Tab Switching
const tabs = {
    map: { btn: document.getElementById('tab-map'), el: document.getElementById('map-section') },
    offenders: { btn: document.getElementById('tab-offenders'), el: document.getElementById('offender-section') },
    tips: { btn: document.getElementById('tab-tips'), el: document.getElementById('tips-section') }
};

function activateTab(key) {
    Object.values(tabs).forEach(tab => {
        if (!tab.btn || !tab.el) return;
        tab.btn.classList.remove('active');
        tab.el.classList.add('hidden');
        tab.el.classList.remove('active');
    });
    const activeTab = tabs[key];
    if (!activeTab?.btn || !activeTab?.el) return;

    activeTab.btn.classList.add('active');
    activeTab.el.classList.remove('hidden');
    activeTab.el.classList.add('active');
}
if (tabs.map.btn) tabs.map.btn.addEventListener('click', () => activateTab('map'));
if (tabs.offenders.btn) tabs.offenders.btn.addEventListener('click', () => activateTab('offenders'));
if (tabs.tips.btn) tabs.tips.btn.addEventListener('click', () => activateTab('tips'));

// Ensure the correct tab is visible on initial load
activateTab('map');

const DEBUG_ON = true;          // so console logs don't crash
let OFF_ALL = [];               // global holder for offenders

// Simple no-op filter for now (so fallback path doesn’t crash)
function applyOffenderFilters() {
  renderOffenders(OFF_ALL);
}


// Load offenders once (first time the tab is opened)
let offendersLoaded = false;
function ensureOffendersLoaded() {
  if (offendersLoaded) return;
  offendersLoaded = true;
  loadOffenders();
}
if (tabs.offenders?.btn) {
  tabs.offenders.btn.addEventListener('click', ensureOffendersLoaded);
}
// (Optional) auto-load if you want it ready without a click:
// document.addEventListener('DOMContentLoaded', ensureOffendersLoaded);


(function setupA2HS() {
  const bar = document.getElementById('a2hs-tip');
  const closeBtn = document.getElementById('a2hs-close');
  const msg = document.getElementById('a2hs-instructions');
  if (!bar || !closeBtn || !msg) return;

  const DISMISS_KEY = 'bct_a2hs_dismissed';
  if (localStorage.getItem(DISMISS_KEY) === '1') return;

  // Already installed?
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone) return;

  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);

  if (isIOS) {
    msg.innerHTML = `On iPhone: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.`;
  } else if (isAndroid) {
    msg.innerHTML = `On Android (Chrome): open menu <strong>⋮</strong> → <strong>Add to Home screen</strong>.`;
  } else {
    msg.textContent = 'Add this site to your home screen for app-like access.';
  }

  // Show the bar
  bar.classList.remove('hidden');

  closeBtn.addEventListener('click', () => {
    bar.classList.add('hidden');
    localStorage.setItem(DISMISS_KEY, '1');
  });
})();


// Tips image preview
const fileInput = document.getElementById('tip-image');
if (fileInput) {
    let preview = document.querySelector('.tip-preview');
    if (!preview) {
        preview = document.createElement('div');
        preview.className = 'tip-preview';
        const img = document.createElement('img');
        preview.appendChild(img);
        fileInput.insertAdjacentElement('afterend', preview);
    }

    const img = preview.querySelector('img');

    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) {
            preview.style.display = 'none';
            if (img) img.removeAttribute('src');
            return;
        }
        const url = URL.createObjectURL(file);
        if (img) img.src = url;
        preview.style.display = 'block';
    });
}

// ----- Leaflet Map Setup -----
const map = L.map('map', {
    zoomControl: true,
    attributionControl: true
  });

  // Data timestamp
  const stampTime = document.getElementById('stamp-time');
  if (stampTime) {
    const now = new Date();
    stampTime.textContent = now.toLocaleString();
  }


  // Recenter control (bottom right)
  const RecenterControl = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function() {
      const div = L.DomUtil.create('div', 'leaflet-control custom');
      const btn = L.DomUtil.create('button', '', div);
      btn.textContent = 'Recenter';
      btn.title = 'Recenter to Bartow County';
     L.DomEvent.on(btn, 'click', (e) => {
      L.DomEvent.stopPropagation(e);
      map.fitBounds(bartowBounds);
      });
      return div;
    }
  });
  map.addControl(new RecenterControl());

  
  // Base layer (OpenStreetMap)
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  
  // Fit to Bartow County bounds (approx)
  const bartowBounds = L.latLngBounds(
    [34.050, -85.050], // SW
    [34.350, -84.600]  // NE
  );
  map.fitBounds(bartowBounds);

  window.addEventListener('load', () => setTimeout(() => map.invalidateSize(), 0));
  
  // Optional: scale bar
  L.control.scale({ metric: false }).addTo(map);
  
  // ----- Category Marker Icons (simple color dots) -----
  function circle(color) {
    return {
      radius: 8,
      fillColor: color,
      color: '#0a0f1a',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.9
    };
  }
  
  const COLORS = {
    violent: '#e34a4a',   // red
    property: '#f5b301',  // amber
    other: '#18b2a5'      // teal
  };

  // Legend (bottom left)
  const LegendControl = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd: function() {
      const div = L.DomUtil.create('div', 'leaflet-control custom legend');
      div.innerHTML = `
        <div class="legend-row"><span class="legend-dot" style="background:${COLORS.violent}"></span><span>Violent</span></div>
        <div class="legend-row"><span class="legend-dot" style="background:${COLORS.property}"></span><span>Property</span></div>
        <div class="legend-row"><span class="legend-dot" style="background:${COLORS.other}"></span><span>Other</span></div>
      `;
      return div;
    }
  });
  map.addControl(new LegendControl());

  
  // Layer groups (so we can toggle categories)
  
  
  // Layer control UI

  
  


  /******** Streaming load from /data/sor_latest.csv (Bartow only) ********/
  const REQUIRED_HEADERS = ['Name','Number','Address','City','State','Zip','County','Type','Jailed','Risk Level'];
  const DEBUG_OFF = true;
  
  async function fetchSorCsv() {
    for (const path of ['data/sor_latest.csv', 'sor_latest.csv']) {
      try {
        const r = await fetch(path, { cache: 'no-store' });
        if (r.ok) return await r.text();
      } catch {}
    }
    throw new Error('sor_latest.csv not found in /data or project root');
  }

async function fetchSorCsv() {
  for (const path of ['data/sor_latest.csv', 'sor_latest.csv']) {
    try {
      const r = await fetch(path, { cache: 'no-store' });
      if (r.ok) return await r.text();
    } catch {}
  }
  throw new Error('sor_latest.csv not found in /data or project root');
}


async function fetchSorCsv() {
  for (const path of ['data/sor_latest.csv', 'sor_latest.csv']) {
    try {
      const r = await fetch(path, { cache: 'no-store' });
      if (r.ok) return await r.text();
    } catch {}
  }
  throw new Error('sor_latest.csv not found in /data or project root');
}

async function loadOffenders() {
  const loader = document.getElementById('offender-loading');
  const list   = document.getElementById('offender-list');

  loader?.classList.remove('hidden');
  list?.classList.add('hidden');

  OFF_ALL = [];
  let totalRows = 0;
  let bartowRows = 0;
  let loggedHeader = false;

  try {
    const csvText = await fetchSorCsv();
    if (DEBUG_ON) console.log('[SOR] first 200 chars:', csvText.slice(0, 200));

    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: 'greedy',
      worker: false, // easier debugging
      step: (row) => {
        totalRows++;
        const obj = row.data;

        if (DEBUG_ON && !loggedHeader) {
          const keys = Object.keys(obj);
          console.log('[SOR] header keys:', keys);
          const missing = REQUIRED_HEADERS.filter(h => !keys.includes(h));
          if (missing.length) console.warn('[SOR] Missing headers:', missing);
          loggedHeader = true;
        }

        const mapped = normalizeSorRow(obj);
        if (!mapped) return;

        if ((mapped.county || '').toLowerCase().includes('bartow')) {
          OFF_ALL.push({
            name: mapped.name,
            offense: mapped.type,
            typoff: mapped.type,
            city: mapped.city,
            county: mapped.county,
            address: mapped.address,
            risk: mapped.risk,
            jailed: mapped.jailed,
            lastVerified: mapped.lastVerified
          });          
          bartowRows++;
        }

        updateOffenderCount(bartowRows, totalRows);
      },
      complete: () => {
        if (DEBUG_ON) console.log('[SOR] complete.', { totalRows, bartowRows });
        applyOffenderFilters();      // now defined
        renderOffenders(OFF_ALL);

        if (!OFF_ALL.length && list) {
          list.innerHTML = `
            <div class="offender-card">
              <strong>No Bartow rows found.</strong>
              <div class="tip-meta">
                Check CSV headers exactly: ${REQUIRED_HEADERS.join(', ')}<br/>
                And that County column contains “BARTOW”.
              </div>
            </div>`;
        }

        loader?.classList.add('hidden');
        list?.classList.remove('hidden');
      },
      error: (err) => { throw err || new Error('Papa.parse error'); }
    });

  } catch (err) {
    console.error('[SOR] load error → fallback:', err);
    try {
      const res = await fetch('data/offenders.sample.json', { cache: 'no-store' });
      OFF_ALL = await res.json();
      applyOffenderFilters();
      renderOffenders(OFF_ALL);
    } catch (e2) {
      console.error('[SOR] fallback failed:', e2);
      if (list) {
        list.innerHTML = `
          <div class="offender-card">
            <strong>Could not load offender data.</strong>
            <div class="tip-meta">Verify <code>data/sor_latest.csv</code> exists and you’re running a local server.</div>
          </div>`;
      }
    } finally {
      loader?.classList.add('hidden');
      list?.classList.remove('hidden');
    }
  }
}


  
function riskClass(risk = '') {
  const r = risk.toLowerCase();
  if (r.includes('level 3') || r.includes('dangerous')) return 'badge--alert';
  if (r.includes('level 2')) return 'badge--warn';
  if (r.includes('level 1')) return 'badge--info';
  return 'badge--warn';
}

function toTitle(s = '') {
  return s.replace(/\s+/g,' ').trim()
          .toLowerCase()
          .replace(/\b\w/g, c => c.toUpperCase());
}

function offenderCard(o) {
  const div = document.createElement('div');
  div.className = 'offender-card';

  const riskText = o.risk ? `Level : ${o.risk}` : 'Level : Unknown';

  div.innerHTML = `
    <div class="title">${o.name ?? ''}</div>
    <div class="badges">
      ${ (o.offense || o.type) ? `<span class="badge badge--warn">${toTitle(o.offense || o.type)}</span>` : '' }
      ${ o.jailed ? `<span class="badge badge--alert">${o.jailed}</span>` : '' }
      <span class="badge ${riskClass(o.risk)}">${riskText}</span>
    </div>
    <div class="addr">${o.address ?? ''}</div>
    <div class="meta">
      County: ${o.county ?? '—'}
      ${o.city ? ` • City: ${o.city}` : ''}
    </div>
  `;
  return div;
}


  
  function renderOffenders(list) {
    const mount = document.getElementById('offender-list');
    if (!mount) return;
    mount.innerHTML = '';
    if (!list || !list.length) return;
    list.forEach(o => mount.appendChild(offenderCard(o)));

    // --- Search Filter Hook ---
  const searchInput = document.querySelector('#offender-section input[type="search"]');
  const typeSelect  = document.querySelector('#offender-section select');
  const resetBtn    = document.querySelector('#offender-section button[type="reset"]');

  if (searchInput && typeSelect) {
    function applyOffenderFilters() {
      const q = searchInput.value.trim().toLowerCase();
      const t = typeSelect.value.trim().toLowerCase();
      const filtered = OFF_ALL.filter(o => {
        const matchText = `${o.name} ${o.city} ${o.county} ${o.address} ${o.offense || ''} ${o.type || ''}`.toLowerCase();
        const typeMatch = !t || t === 'all' || (o.risk || '').toLowerCase().includes(t);
        return matchText.includes(q) && typeMatch;
      });
      renderOffenders(filtered);
    }

    searchInput.addEventListener('input', applyOffenderFilters);
    typeSelect.addEventListener('change', applyOffenderFilters);
    resetBtn?.addEventListener('click', () => {
      searchInput.value = '';
      typeSelect.value = '';
      renderOffenders(OFF_ALL);
    });
  }
}
  
  
// Map CSV headers → fields
function normalizeSorRow(r) {
  const g = k => (r[k] ?? '').toString().trim();

  // core fields
  const name   = g('Name');
  const county = g('County');
  if (!name || !county) return null;

  // header typos / variants
  const state  = g('State') || g('Sate');
  const zip    = g('Zip') || g('Zip ');
  const type   = g('Type2') || g('Type') || g('Charge');   // <-- crime text
  const risk   = g('Risk Level') || g('RiskLevel') || '';
  const jailed = (g('Jailed') || '').toUpperCase();

  // address
  const num    = g('Number');
  const street = g('Address');
  const city   = g('City');
  const line1  = [num, street].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  const cityStateZip = [city, state, zip].filter(Boolean).join(', ').replace(/,\s*,/g, ', ');
  const fullAddress  = [line1, cityStateZip].filter(Boolean).join(', ');

  return {
    name: name.toUpperCase(),
    // expose both keys so either renderer style works
    offense: type,
    type,                                  // <-- alias for renderer expecting row.type
    city: (city || '').toUpperCase(),
    county: county.toUpperCase(),
    address: fullAddress,
    jailed,
    risk
  };
}

// (Optional) counter display — call this from loadOffenders()
function updateOffenderCount(bartow, total) {
  const el = document.getElementById('off-page'); // or add a dedicated span
  if (el) el.textContent = `Bartow: ${bartow.toLocaleString()} (of ${total.toLocaleString()} GA rows)`;
}

  

  /*
 * Community Tips (Local)
 * - Persist to localStorage
 * - Optional image (base64)
 * - Auto-expire tips after 7 days
 * - Auto-delete after N reports
 * - Per-tip comments (persist with tip; no separate TTL)
 */
const TIP_STORAGE_KEY = 'bct_tips_v2'; // bump key (v2) so we start fresh
const TIP_TTL_DAYS = 7;               // tips expire after 7 days
const REPORT_THRESHOLD = 5;           // change to 10 if you prefer

const tipForm   = document.getElementById('tip-form');
const tipTextEl = document.getElementById('tip-text') || document.querySelector('#tip-form textarea');
const tipImgEl  = document.getElementById('tip-image');
const tipFeed   = document.getElementById('tip-feed');

// ----- Utilities -----
function nowISO() { return new Date().toISOString(); }
function daysToMs(d) { return d * 24 * 60 * 60 * 1000; }
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function loadTips() {
  try { return JSON.parse(localStorage.getItem(TIP_STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveTips(tips) {
  localStorage.setItem(TIP_STORAGE_KEY, JSON.stringify(tips));
}
function pruneExpired(tips) {
  const cutoff = Date.now() - daysToMs(TIP_TTL_DAYS);
  return tips.filter(t => new Date(t.createdAt).getTime() >= cutoff);
}
function safeText(s = '') {
  const div = document.createElement('div');
  div.textContent = s;
  return div.textContent;
}
function fmt(iso) { return new Date(iso).toLocaleString(); }

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('File read error'));
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}

// ----- Render -----
function renderTips(tips) {
  tipFeed.innerHTML = '';
  if (!tips.length) {
    const li = document.createElement('li');
    li.textContent = 'No tips yet. Be the first to share useful info for the community.';
    tipFeed.appendChild(li);
    return;
  }

  tips
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach(t => {
      const li = document.createElement('li');
      li.dataset.id = t.id;

      // Text
      const p = document.createElement('p');
      p.textContent = t.text;
      li.appendChild(p);

      // Optional image
      if (t.imageDataUrl) {
        const imgWrap = document.createElement('div');
        imgWrap.className = 'tip-preview';
        imgWrap.style.display = 'block';
        const img = document.createElement('img');
        img.src = t.imageDataUrl;
        img.alt = 'Attachment';
        imgWrap.appendChild(img);
        li.appendChild(imgWrap);
      }

      // Meta
      const meta = document.createElement('div');
      meta.className = 'tip-meta';
      meta.innerHTML = `
        Posted: ${safeText(fmt(t.createdAt))} 
        • Reports: <span class="report-count">${t.reports}</span> / ${REPORT_THRESHOLD}
      `;
      li.appendChild(meta);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'tip-actions';
      const reportBtn = document.createElement('button');
      reportBtn.type = 'button';
      reportBtn.className = 'btn-report';
      reportBtn.textContent = 'Report';
      actions.appendChild(reportBtn);
      li.appendChild(actions);

      // Comments block
      const commentsWrap = document.createElement('div');
      commentsWrap.className = 'tip-comments';

      const h4 = document.createElement('h4');
      h4.textContent = 'Comments';
      commentsWrap.appendChild(h4);

      const list = document.createElement('div');
      list.className = 'comment-list';
      (t.comments || []).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt))
        .forEach(c => list.appendChild(renderComment(c)));
      commentsWrap.appendChild(list);

      // Comment form
      const form = document.createElement('form');
      form.className = 'comment-form';
      form.innerHTML = `
        <input type="text" name="comment" placeholder="Write a comment…" required maxlength="500" />
        <button type="submit">Post</button>
      `;
      commentsWrap.appendChild(form);

      li.appendChild(commentsWrap);
      tipFeed.appendChild(li);
    });
}

function renderComment(c) {
  const wrap = document.createElement('div');
  wrap.className = 'comment';
  const text = document.createElement('div');
  text.textContent = c.text;
  const time = document.createElement('time');
  time.dateTime = c.createdAt;
  time.textContent = fmt(c.createdAt);
  wrap.appendChild(text);
  wrap.appendChild(time);
  return wrap;
}

// ----- Load + initial prune + render -----
let TIPS = pruneExpired(loadTips());
if (TIPS.length !== loadTips().length) saveTips(TIPS);
renderTips(TIPS);

// Hourly prune
setInterval(() => {
  const pruned = pruneExpired(TIPS);
  if (pruned.length !== TIPS.length) {
    TIPS = pruned;
    saveTips(TIPS);
    renderTips(TIPS);
  }
}, 60 * 60 * 1000);

// ----- Submit new tip -----
if (tipForm) {
  tipForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = (tipTextEl?.value || '').trim();
    if (!text) { alert('Please enter a tip or report.'); return; }

    let imageDataUrl = '';
    const file = tipImgEl?.files?.[0];
    if (file) {
      if (file.size > 2.5 * 1024 * 1024) { alert('Image too large (max ~2.5MB).'); return; }
      try { imageDataUrl = await fileToDataURL(file); }
      catch { alert('Could not read the image.'); return; }
    }

    const tip = {
      id: uid(),
      text,
      imageDataUrl,
      createdAt: nowISO(),
      reports: 0,
      comments: []  // new
    };

    TIPS.unshift(tip);
    saveTips(TIPS);
    renderTips(TIPS);

    // reset form + inline preview
    tipTextEl.value = '';
    if (tipImgEl) tipImgEl.value = '';
    const inlinePrev = document.querySelector('.tip-preview');
    if (inlinePrev) { inlinePrev.style.display = 'none'; const img = inlinePrev.querySelector('img'); if (img) img.removeAttribute('src'); }
  });
}

// ----- Click handlers: report & add comment (event delegation) -----
if (tipFeed) {
  tipFeed.addEventListener('click', (e) => {
    const reportBtn = e.target.closest('.btn-report');
    if (!reportBtn) return;

    const li = reportBtn.closest('li');
    const id = li?.dataset?.id;
    if (!id) return;

    const idx = TIPS.findIndex(t => t.id === id);
    if (idx === -1) return;

    TIPS[idx].reports = (TIPS[idx].reports || 0) + 1;
    if (TIPS[idx].reports >= REPORT_THRESHOLD) {
      TIPS.splice(idx, 1); // auto-delete
    }
    saveTips(TIPS);
    renderTips(TIPS);
  });

  tipFeed.addEventListener('submit', (e) => {
    const form = e.target.closest('.comment-form');
    if (!form) return;
    e.preventDefault();

    const li = form.closest('li');
    const id = li?.dataset?.id;
    if (!id) return;

    const input = form.querySelector('input[name="comment"]');
    const text = (input?.value || '').trim();
    if (!text) return;

    const idx = TIPS.findIndex(t => t.id === id);
    if (idx === -1) return;

    const comment = { id: uid(), text: safeText(text), createdAt: nowISO() };
    if (!Array.isArray(TIPS[idx].comments)) TIPS[idx].comments = [];
    TIPS[idx].comments.push(comment);

    saveTips(TIPS);
    renderTips(TIPS);
  });
}


/***** Crime Map: fetch, filter, geocode, plot *****/

const CRIME_SOURCE_URL = 'data/crime_last_60d.json'; 
// ^ Replace with your borough endpoint or CSV parser.
// If CSV, fetch text and parse with Papa like you do for SOR.

const TIME_WINDOWS = { '60': 60, '30': 30, '7': 7, '1': 1 };
let CRIME_ALL = [];        // all (<=60d) normalized
let CRIME_VISIBLE = [];    // filtered by window
let CURRENT_WINDOW = 60;

const timeSelect = document.getElementById('time-window');
const crimeCountEl = document.getElementById('crime-count');

// Category color/icon map
const CAT = {
  violent:   { color: '#e34a4a', label: 'Violent',  icon: '⚠️' },
  property:  { color: '#f5b301', label: 'Property', icon: '🏚️' },
  other:     { color: '#18b2a5', label: 'Other',    icon: '🛈'  }
};

// helper: choose category from your raw type/title
function classifyCategory(raw='') {
  const s = raw.toLowerCase();
  if (/(assault|robbery|battery|homicide|weapon)/.test(s)) return 'violent';
  if (/(burglary|theft|larceny|shoplift|vandal)/.test(s))  return 'property';
  return 'other';
}

// marker style
function circleByCat(cat) {
  const color = (CAT[cat]?.color) || CAT.other.color;
  return { radius: 8, fillColor: color, color: '#0a0f1a', weight: 1, opacity: 1, fillOpacity: .9 };
}

// hold markers per category
const crimeLayers = {
  Violent: L.layerGroup().addTo(map),
  Property: L.layerGroup().addTo(map),
  Other: L.layerGroup().addTo(map)
};

// swap the previous control (you already added one for samples) or keep:
L.control.layers(null, crimeLayers, { collapsed: false }).addTo(map);

// ---- Data fetch & normalize ----
async function fetchCrimeJSON() {
  const r = await fetch(CRIME_SOURCE_URL, { cache: 'no-store' });
  if (!r.ok) throw new Error('Crime feed fetch failed');
  return await r.json();
}

// If you instead have CSV, do like:
// const txt = await (await fetch(CRIME_SOURCE_URL)).text();
// Papa.parse(txt, { header:true, ... step: (row)=>items.push(row.data) })

function normalizeCrimeRow(r) {
  // Expecting fields; provide aliases/tolerant picks:
  const id        = String(r.id ?? r.ID ?? '');
  const when      = new Date(r.occurred_at ?? r.datetime ?? r.date ?? r.time ?? '');
  if (!id || isNaN(+when)) return null;

  const address   = [r.address, r.addr].find(Boolean) || '';
  const city      = (r.city || 'Cartersville').toString();
  const title     = r.title || r.offense || r.type || '';
  const officer   = r.officer || r.arresting_officer || '';
  const narrative = r.narrative || r.report || '';
  const suspect   = r.name || r.suspect || '';
  const imageUrl  = r.image_url || r.image || '';

  const cat       = classifyCategory(`${title}`);

  // lat/lng optional; may be empty → we’ll geocode
  const lat = parseFloat(r.lat ?? r.latitude);
  const lng = parseFloat(r.lng ?? r.longitude);

  return {
    id, when, address, city, title, officer, narrative, suspect, imageUrl,
    category: cat,
    lat: isFinite(lat) ? lat : null,
    lng: isFinite(lng) ? lng : null,
    fullAddress: [address, city, 'GA'].filter(Boolean).join(', ')
  };
}

// ---- Geocoding (client-side with cache) ----
// For production use server-side geocoding + cache. This client cache
// helps dev/test and small volumes. It’s rate-limited and best-effort.
const GEO_CACHE_KEY = 'bct_geocache_v1';
let GEO_CACHE = {};
try { GEO_CACHE = JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}'); } catch {}

function saveGeoCache() {
  localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(GEO_CACHE));
}

// You can swap this for your own proxy endpoint.
// Nominatim works but please respect usage policies and add your server-side proxy later.
async function geocodeAddress(addr) {
  if (!addr) return null;
  const key = addr.toLowerCase();
  if (GEO_CACHE[key]) return GEO_CACHE[key];

  // Small delay to be polite (also to avoid rate-limit bursts)
  await new Promise(r => setTimeout(r, 150));

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}`;
  const resp = await fetch(url, { headers: { 'Accept': 'application/json' }});
  if (!resp.ok) return null;
  const js = await resp.json();
  const hit = js?.[0];
  if (!hit) return null;

  const ll = { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) };
  if (isFinite(ll.lat) && isFinite(ll.lng)) {
    GEO_CACHE[key] = ll;
    saveGeoCache();
    return ll;
  }
  return null;
}

// batch geocode any missing coordinates (lightweight queue)
async function ensureCoordinates(items) {
  for (const rec of items) {
    if (rec.lat != null && rec.lng != null) continue;
    const ll = await geocodeAddress(rec.fullAddress);
    if (ll) { rec.lat = ll.lat; rec.lng = ll.lng; }
  }
  return items;
}

// ---- Plotting ----
function clearCrimeLayers() {
  Object.values(crimeLayers).forEach(g => g.clearLayers());
}

function popupHTML(rec) {
  const dt = rec.when.toLocaleString();
  const officer = rec.officer ? `<div class="row"><strong>Officer:</strong> ${rec.officer}</div>` : '';
  const who = rec.suspect ? `<div class="row"><strong>Name:</strong> ${rec.suspect}</div>` : '';
  const img = rec.imageUrl ? `<img src="${rec.imageUrl}" alt="Incident photo"/>` : '';
  const report = rec.narrative ? `<div class="row"><strong>Report:</strong> ${sanitize(rec.narrative)}</div>` : '';

  return `
    <div class="crime-card">
      <h4>${sanitize(rec.title) || 'Incident'}</h4>
      ${who}
      <div class="row"><strong>When:</strong> ${dt}</div>
      <div class="row"><strong>Where:</strong> ${sanitize(rec.fullAddress)}</div>
      ${officer}
      ${report}
      ${img}
    </div>
  `;
}
function sanitize(s=''){ const d=document.createElement('div'); d.textContent=s; return d.textContent; }

function plotCrimes(items) {
  clearCrimeLayers();
  if (!items.length) {
    crimeCountEl && (crimeCountEl.textContent = 'No incidents in window.');
    return;
  }

  const bounds = [];
  items.forEach(rec => {
    const layer =
      rec.category === 'violent'  ? crimeLayers.Violent :
      rec.category === 'property' ? crimeLayers.Property : crimeLayers.Other;

    const m = L.circleMarker([rec.lat, rec.lng], circleByCat(rec.category))
      .bindPopup(popupHTML(rec));

    m.addTo(layer);
    bounds.push([rec.lat, rec.lng]);
  });

  crimeCountEl && (crimeCountEl.textContent = `${items.length.toLocaleString()} incidents`);
  if (bounds.length) map.fitBounds(bounds, { maxZoom: 15, padding: [20,20] });
}

// ---- Filtering by time window ----
function filterByDays(days) {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  return CRIME_ALL.filter(rec => rec.when.getTime() >= cutoff && rec.lat != null && rec.lng != null);
}

async function refreshCrimeData() {
  // Fetch and normalize only if empty (first load) or you want hard refresh.
  const raw = await fetchCrimeJSON();
  const rows = Array.isArray(raw) ? raw : (raw.items || []);
  CRIME_ALL = rows.map(normalizeCrimeRow).filter(Boolean);

  // Only keep <= 60d
  const cutoff60 = Date.now() - (60 * 24 * 60 * 60 * 1000);
  CRIME_ALL = CRIME_ALL.filter(r => r.when.getTime() >= cutoff60);

  // Fill in coordinates where missing
  await ensureCoordinates(CRIME_ALL);

  // Initial draw
  CURRENT_WINDOW = parseInt(timeSelect?.value || '60', 10);
  CRIME_VISIBLE = filterByDays(CURRENT_WINDOW);
  plotCrimes(CRIME_VISIBLE);
}

// UI events
if (timeSelect) {
  timeSelect.addEventListener('change', () => {
    CURRENT_WINDOW = parseInt(timeSelect.value, 10);
    CRIME_VISIBLE = filterByDays(CURRENT_WINDOW);
    plotCrimes(CRIME_VISIBLE);
  });
}

// Kick it off on load
refreshCrimeData().catch(e => console.error('Crime data load failed:', e));

// ---- Scheduled refresh: twice a day (morning & evening) ----
// (1) Safety net every 12h
setInterval(() => refreshCrimeData().catch(()=>{}), 12 * 60 * 60 * 1000);

// (2) Targeted runs at specific local hours (e.g., 6:05 and 20:05)
scheduleDailyRefresh([ {h:6,m:5}, {h:20,m:5} ], () => refreshCrimeData().catch(()=>{}));

function scheduleDailyRefresh(times, fn) {
  // Schedule next occurrence for each requested time
  times.forEach(({h,m}) => {
    function plan() {
      const now = new Date();
      const next = new Date();
      next.setHours(h, m, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      const delay = next.getTime() - now.getTime();
      setTimeout(() => { fn(); plan(); }, delay);
    }
    plan();
  });
}
