// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
  apiKey: "AIzaSyB3TraVfg-Cia6YXN6B9puIZX3r43ISQ5o",
  authDomain: "bartow-crime-tracker.firebaseapp.com",
  databaseURL: "https://bartow-crime-tracker-default-rtdb.firebaseio.com",
  projectId: "bartow-crime-tracker",
  storageBucket: "bartow-crime-tracker.firebasestorage.app",
  messagingSenderId: "786363581700",
  appId: "1:786363581700:web:3eb8fbed970a2b34bd7c51"
};

let firebase_initialized = false;
let db = null;

try {
  if (typeof firebase !== 'undefined') {
      firebase.initializeApp(firebaseConfig);
      db = firebase.database();
      firebase_initialized = true;
  }
} catch (e) {
  console.log('Firebase not available, tips will be local only');
}

// ==================== GLOBAL STATE ====================
const state = {
  offenders: [],
  filteredOffenders: [],
  tips: [],
  crimes: [],
  currentWindow: 60,
  map: null,
  crimeLayers: {},
  geoCache: {},
  mapInitialized: false,
  tipsLoaded: false
};

// ==================== UTILITIES ====================
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function nowISO() { return new Date().toISOString(); }
function fmt(iso) { return new Date(iso).toLocaleString(); }
function safeText(s = '') {
  const div = document.createElement('div');
  div.textContent = s;
  return div.textContent;
}

// ==================== TAB SWITCHING ====================
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
  });
});

function switchTab(tab) {
  // Hide all tabs
  document.querySelectorAll('.tab').forEach(el => {
      el.classList.remove('active');
  });
  
  // Deactivate all buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
  });
  
  // Show selected tab
  if (tab === 'map') {
      document.getElementById('map').classList.add('active');
      document.getElementById('tab-map').classList.add('active');
      setTimeout(() => {
          if (!state.mapInitialized) {
              initMap();
              state.mapInitialized = true;
          } else if (state.map) {
              state.map.invalidateSize();
          }
      }, 100);
  } else if (tab === 'offenders') {
      document.getElementById('offenders-tab').classList.add('active');
      document.getElementById('tab-offenders').classList.add('active');
      loadOffendersIfNeeded();
  } else if (tab === 'tips') {
      document.getElementById('tips-tab').classList.add('active');
      document.getElementById('tab-tips').classList.add('active');
  }
}

// ==================== A2HS ====================
(function setupA2HS() {
  const bar = document.getElementById('a2hs-tip');
  const closeBtn = document.getElementById('a2hs-close');
  const msg = document.getElementById('a2hs-instructions');
  
  if (!bar || !closeBtn || !msg) return;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) return;

  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);

  if (isIOS) {
      msg.innerHTML = 'On iPhone: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.';
  } else if (isAndroid) {
      msg.innerHTML = 'On Android: open menu <strong>⋮</strong> → <strong>Add to Home screen</strong>.';
  }

  bar.classList.remove('hidden');

  closeBtn.addEventListener('click', () => {
      bar.classList.add('hidden');
  });
})();

// ==================== TIMESTAMP ====================
document.addEventListener('DOMContentLoaded', () => {
  const stampTime = document.getElementById('stamp-time');
  if (stampTime) {
      stampTime.textContent = new Date().toLocaleString();
  }
});

// ==================== MAP ====================
const BARTOW_BOUNDS = L.latLngBounds(
  [34.050, -85.050],
  [34.350, -84.600]
);

const COLORS = {
  violent: '#e34a4a',
  property: '#f5b301',
  other: '#18b2a5'
};

function initMap() {
  if (state.mapInitialized && state.map) return;

  state.map = L.map('map-container', {
      zoomControl: true,
      attributionControl: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(state.map);

  state.map.fitBounds(BARTOW_BOUNDS);

  // Recenter control
  const RecenterControl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: function() {
          const div = L.DomUtil.create('div', 'leaflet-control custom');
          const btn = L.DomUtil.create('button', '', div);
          btn.textContent = 'Recenter';
          btn.title = 'Recenter to Bartow County';
          L.DomEvent.on(btn, 'click', (e) => {
              L.DomEvent.stopPropagation(e);
              state.map.fitBounds(BARTOW_BOUNDS);
          });
          return div;
      }
  });
  state.map.addControl(new RecenterControl());

  // Legend control
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
  state.map.addControl(new LegendControl());

  // Crime layer groups
  state.crimeLayers = {
      Violent: L.layerGroup().addTo(state.map),
      Property: L.layerGroup().addTo(state.map),
      Other: L.layerGroup().addTo(state.map)
  };

  L.control.layers(null, state.crimeLayers, { collapsed: false }).addTo(state.map);

  // Load sample crimes
  loadSampleCrimes();
}

function loadSampleCrimes() {
  // Generate sample crime data
  state.crimes = generateSampleCrimes();
  plotCrimes(state.crimes);
}

function generateSampleCrimes() {
  const locations = [
      { lat: 34.155, lng: -84.797, name: 'Downtown Cartersville' },
      { lat: 34.120, lng: -84.830, name: 'Bartow Commons' },
      { lat: 34.180, lng: -84.770, name: 'North Bartow' },
      { lat: 34.100, lng: -84.750, name: 'South Bartow' }
  ];

  const crimes = [
      { title: 'Assault', category: 'violent' },
      { title: 'Robbery', category: 'violent' },
      { title: 'Burglary', category: 'property' },
      { title: 'Theft', category: 'property' },
      { title: 'Vandalism', category: 'property' },
      { title: 'Disorderly Conduct', category: 'other' },
      { title: 'Traffic Violation', category: 'other' }
  ];

  const samples = [];
  for (let i = 0; i < 12; i++) {
      const loc = locations[i % locations.length];
      const crime = crimes[i % crimes.length];
      const daysAgo = Math.floor(Math.random() * 60);
      const when = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      samples.push({
          id: uid(),
          title: crime.title,
          category: crime.category,
          when,
          lat: loc.lat + (Math.random() - 0.5) * 0.05,
          lng: loc.lng + (Math.random() - 0.5) * 0.05,
          address: `${Math.floor(Math.random() * 9000) + 1000} Main St, ${loc.name}`,
          officer: `Officer ${Math.floor(Math.random() * 100)}`,
          narrative: `Incident reported at ${loc.name}. Case under investigation.`
      });
  }
  return samples;
}

function classifyCategory(title = '') {
  const s = title.toLowerCase();
  if (/(assault|robbery|battery|homicide|weapon)/.test(s)) return 'violent';
  if (/(burglary|theft|larceny|shoplift|vandal)/.test(s)) return 'property';
  return 'other';
}

function circleByCat(cat) {
  const color = COLORS[cat] || COLORS.other;
  return {
      radius: 8,
      fillColor: color,
      color: '#0a0f1a',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.9
  };
}

function popupHTML(crime) {
  const dt = crime.when.toLocaleString();
  return `
      <div class="crime-card">
          <h4>${safeText(crime.title)}</h4>
          <div class="row"><strong>When:</strong> ${dt}</div>
          <div class="row"><strong>Where:</strong> ${safeText(crime.address)}</div>
          ${crime.officer ? `<div class="row"><strong>Officer:</strong> ${safeText(crime.officer)}</div>` : ''}
          ${crime.narrative ? `<div class="row"><strong>Report:</strong> ${safeText(crime.narrative)}</div>` : ''}
      </div>
  `;
}

function plotCrimes(crimes) {
  if (!state.map) return;

  Object.values(state.crimeLayers).forEach(g => g.clearLayers());

  if (!crimes.length) {
      document.getElementById('crime-count').textContent = 'No incidents in window.';
      return;
  }

  const bounds = [];
  crimes.forEach(crime => {
      const layer =
          crime.category === 'violent' ? state.crimeLayers.Violent :
          crime.category === 'property' ? state.crimeLayers.Property :
          state.crimeLayers.Other;

      const m = L.circleMarker(
          [crime.lat, crime.lng],
          circleByCat(crime.category)
      ).bindPopup(popupHTML(crime));

      m.addTo(layer);
      bounds.push([crime.lat, crime.lng]);
  });

  document.getElementById('crime-count').textContent = `${crimes.length.toLocaleString()} incidents`;
  if (bounds.length) state.map.fitBounds(bounds, { maxZoom: 15, padding: [20, 20] });
}

document.getElementById('time-window').addEventListener('change', (e) => {
  state.currentWindow = parseInt(e.target.value, 10);
  const filtered = filterByDays(state.crimes, state.currentWindow);
  plotCrimes(filtered);
});

function filterByDays(crimes, days) {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  return crimes.filter(c => c.when.getTime() >= cutoff);
}

// ==================== OFFENDERS ====================
let offendersLoadedOnce = false;

function loadOffendersIfNeeded() {
  if (offendersLoadedOnce) return;
  offendersLoadedOnce = true;
  loadOffenders();
}

async function loadOffenders() {
  const loading = document.getElementById('offender-loading');
  loading.classList.remove('hidden');

  try {
      const response = await fetch('data/sor_latest.csv');
      if (!response.ok) throw new Error('CSV not found');
      
      const csvText = await response.text();
      
      Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
              state.offenders = results.data
                  .map(row => normalizeSorRow(row))
                  .filter(o => o && o.county.toUpperCase().includes('BARTOW'));
              
              state.filteredOffenders = [...state.offenders];
              renderOffenders(state.filteredOffenders);
              setupOffenderFilters();
              loading.classList.add('hidden');
          },
          error: (error) => {
              console.error('Parse error:', error);
              fallbackOffenders();
          }
      });
  } catch (err) {
      console.error('Load error:', err);
      fallbackOffenders();
  }
}

function normalizeSorRow(row) {
  if (!row.Name || !row.County) return null;
  
  const jailedValue = (row.Jailed || '').trim().toUpperCase();
  
  return {
      name: (row.Name || '').toUpperCase(),
      type: (row.Type2 || row.Type || '').toUpperCase(),
      offense: (row.Type || row.Type2 || '').toUpperCase(),
      city: (row.City || '').toUpperCase(),
      county: (row.County || '').toUpperCase(),
      address: [row.Number, row.Address, row.City, row.State, row.Zip]
          .filter(Boolean)
          .join(' '),
      risk: (row['Risk Level'] || 'UNKNOWN').toUpperCase(),
      jailed: jailedValue === 'INCARCERATED' ? 'INCARCERATED' : jailedValue === 'JAILED' ? 'JAILED' : '',
      predator: (row.Type2 || '').toUpperCase().includes('PREDATOR') ? 'PREDATOR' : '',
      absconder: (row.Blank || '').toUpperCase().includes('ABSCONDER') ? 'ABSCONDER' : ''
  };
}

function fallbackOffenders() {
  state.offenders = generateSampleOffenders();
  state.filteredOffenders = [...state.offenders];
  renderOffenders(state.filteredOffenders);
  setupOffenderFilters();
  
  const loading = document.getElementById('offender-loading');
  loading.classList.add('hidden');
}

function generateSampleOffenders() {
  const cities = ['Cartersville', 'Adairsville', 'White', 'Emerson', 'Euharlee'];
  const types = ['Resident', 'Work', 'Transient'];
  const risks = ['Level 1', 'Level 2', 'Level 3'];

  const offenders = [];
  for (let i = 0; i < 15; i++) {
      offenders.push({
          name: `${['John', 'James', 'Michael', 'David'][i % 4]} ${['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'][i % 5]}`,
          type: types[i % 3],
          offense: ['Theft', 'Assault', 'Burglary', 'Sexual Offense'][i % 4],
          city: cities[i % 5],
          county: 'Bartow',
          address: `${1000 + i * 100} Main Street, ${cities[i % 5]}, GA 30120`,
          risk: risks[i % 3],
          jailed: i % 4 === 0 ? 'JAILED' : ''
      });
  }
  return offenders;
}

function renderOffenders(list) {
  const mount = document.getElementById('offender-list');
  mount.innerHTML = '';

  if (!list || !list.length) {
      mount.innerHTML = '<div class="offender-card"><strong>No offenders found.</strong></div>';
      return;
  }

  list.forEach(o => {
      const card = document.createElement('div');
      card.className = 'offender-card';
      
      let statusBadges = '';
      if (o.jailed === 'INCARCERATED') {
          statusBadges += '<span class="badge badge--alert">INCARCERATED</span>';
      }
      if (o.predator) {
          statusBadges += '<span class="badge badge--alert">PREDATOR</span>';
      }
      if (o.absconder) {
          statusBadges += '<span class="badge badge--danger">ABSCONDER</span>';
      }
      
      card.innerHTML = `
          <div class="title">${safeText(o.name || '')}</div>
          <div class="badges">
              ${o.offense ? `<span class="badge badge--warn">${safeText(o.offense.substring(0, 30))}</span>` : ''}
              ${statusBadges}
              <span class="badge ${riskClass(o.risk)}">${safeText(o.risk || 'Unknown')}</span>
          </div>
          <div class="addr">${safeText(o.address || '')}</div>
          <div class="meta">
              City: ${safeText(o.city || '—')}
          </div>
      `;
      mount.appendChild(card);
  });
}

function riskClass(risk = '') {
  const r = risk.toLowerCase();
  if (r.includes('level 3')) return 'badge--alert';
  if (r.includes('level 2')) return 'badge--warn';
  if (r.includes('level 1')) return 'badge--info';
  return 'badge--warn';
}

function setupOffenderFilters() {
  const searchInput = document.querySelector('#off-q');
  const typeSelect = document.querySelector('#off-type');
  const resetBtn = document.querySelector('#off-reset');

  function applyFilters() {
      const q = searchInput.value.trim().toLowerCase();
      const t = typeSelect.value.trim().toLowerCase();

      state.filteredOffenders = state.offenders.filter(o => {
          const matchText = `${o.name} ${o.city} ${o.address} ${o.offense || ''}`.toLowerCase();
          const typeMatch = !t || (o.type || '').toLowerCase() === t;
          return matchText.includes(q) && typeMatch;
      });

      renderOffenders(state.filteredOffenders);
  }

  searchInput.addEventListener('input', applyFilters);
  typeSelect.addEventListener('change', applyFilters);
  resetBtn.addEventListener('click', () => {
      searchInput.value = '';
      typeSelect.value = '';
      state.filteredOffenders = [...state.offenders];
      renderOffenders(state.filteredOffenders);
  });
}

// ==================== COMMUNITY TIPS ====================
async function loadTips() {
  if (state.tipsLoaded) return;
  state.tipsLoaded = true;

  if (firebase_initialized && db) {
      try {
          const ref = firebase.database().ref('tips');
          ref.orderByChild('createdAt').limitToLast(100).on('value', (snapshot) => {
              const data = snapshot.val();
              if (data) {
                  state.tips = Object.values(data).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              } else {
                  state.tips = [];
              }
              renderTips();
          });
      } catch (err) {
          console.log('Firebase load failed, using local storage');
          loadTipsLocal();
      }
  } else {
      loadTipsLocal();
  }
}

function loadTipsLocal() {
  try {
      state.tips = JSON.parse(localStorage.getItem('bct_tips_v3') || '[]');
  } catch {
      state.tips = [];
  }
  renderTips();
}

function renderTips() {
  const feed = document.getElementById('tip-feed');
  feed.innerHTML = '';

  if (!state.tips.length) {
      const li = document.createElement('li');
      li.textContent = 'No tips yet. Be the first to share.';
      feed.appendChild(li);
      return;
  }

  state.tips.forEach(t => {
      const li = document.createElement('li');
      li.dataset.id = t.id;

      const p = document.createElement('p');
      p.textContent = t.text;
      li.appendChild(p);

      if (t.imageDataUrl) {
          const imgWrap = document.createElement('div');
          imgWrap.className = 'tip-preview';
          const img = document.createElement('img');
          img.src = t.imageDataUrl;
          img.alt = 'Attachment';
          imgWrap.appendChild(img);
          li.appendChild(imgWrap);
      }

      const meta = document.createElement('div');
      meta.className = 'tip-meta';
      meta.textContent = `Posted: ${fmt(t.createdAt)} • Reports: ${t.reports} / 5`;
      li.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'tip-actions';
      const reportBtn = document.createElement('button');
      reportBtn.textContent = 'Report';
      reportBtn.className = 'btn-report';
      actions.appendChild(reportBtn);
      li.appendChild(actions);

      const commentsWrap = document.createElement('div');
      commentsWrap.className = 'tip-comments';
      const h4 = document.createElement('h4');
      h4.textContent = 'Comments';
      commentsWrap.appendChild(h4);

      const commentList = document.createElement('div');
      commentList.className = 'comment-list';
      (t.comments || []).forEach(c => {
          const cDiv = document.createElement('div');
          cDiv.className = 'comment';
          cDiv.innerHTML = `
              <div>${safeText(c.text)}</div>
              <time>${fmt(c.createdAt)}</time>
          `;
          commentList.appendChild(cDiv);
      });
      commentsWrap.appendChild(commentList);

      const form = document.createElement('form');
      form.className = 'comment-form';
      form.innerHTML = `
          <input type="text" name="comment" placeholder="Write a comment…" maxlength="500" />
          <button type="submit">Post</button>
      `;
      commentsWrap.appendChild(form);
      li.appendChild(commentsWrap);

      feed.appendChild(li);
  });
}

const tipForm = document.getElementById('tip-form');
const tipTextEl = document.getElementById('tip-text');
const tipImgEl = document.getElementById('tip-image');
const tipPreview = document.querySelector('.tip-preview');

tipImgEl.addEventListener('change', () => {
  const file = tipImgEl.files?.[0];
  if (!file) {
      tipPreview.classList.add('hidden');
      document.getElementById('tip-preview-img').src = '';
      return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
      document.getElementById('tip-preview-img').src = e.target.result;
      tipPreview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

tipForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const text = tipTextEl.value.trim();
  if (!text) {
      alert('Please enter a tip.');
      return;
  }

  let imageDataUrl = '';
  const file = tipImgEl.files?.[0];
  if (file) {
      if (file.size > 2.5 * 1024 * 1024) {
          alert('Image too large (max 2.5MB).');
          return;
      }
      imageDataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onerror = () => reject(new Error('File read error'));
          r.onload = () => resolve(r.result);
          r.readAsDataURL(file);
      });
  }

  const tip = {
      id: uid(),
      text,
      imageDataUrl,
      createdAt: nowISO(),
      reports: 0,
      comments: []
  };

  // Save to Firebase if available
  if (firebase_initialized && db) {
      try {
          await firebase.database().ref('tips/' + tip.id).set(tip);
      } catch (err) {
          console.log('Firebase save failed, saving locally');
          saveTipsLocal([tip, ...state.tips]);
      }
  } else {
      saveTipsLocal([tip, ...state.tips]);
  }

  // Clear form
  tipTextEl.value = '';
  tipImgEl.value = '';
  tipPreview.classList.add('hidden');
  document.getElementById('tip-preview-img').src = '';
});

function saveTipsLocal(tips) {
  state.tips = tips;
  try {
      localStorage.setItem('bct_tips_v3', JSON.stringify(tips));
  } catch (e) {
      console.error('Local save failed:', e);
  }
  renderTips();
}

document.getElementById('tip-feed').addEventListener('click', (e) => {
  const reportBtn = e.target.closest('.btn-report');
  if (!reportBtn) return;

  const li = reportBtn.closest('li');
  const id = li.dataset.id;
  const idx = state.tips.findIndex(t => t.id === id);

  if (idx !== -1) {
      state.tips[idx].reports++;
      if (state.tips[idx].reports >= 5) {
          // Delete from Firebase if available
          if (firebase_initialized && db) {
              firebase.database().ref('tips/' + id).remove().catch(() => {
                  state.tips.splice(idx, 1);
                  saveTipsLocal(state.tips);
              });
          } else {
              state.tips.splice(idx, 1);
              saveTipsLocal(state.tips);
          }
      } else {
          // Update reports in Firebase
          if (firebase_initialized && db) {
              firebase.database().ref('tips/' + id + '/reports').set(state.tips[idx].reports);
          } else {
              saveTipsLocal(state.tips);
          }
      }
      renderTips();
  }
});

document.getElementById('tip-feed').addEventListener('submit', (e) => {
  const form = e.target.closest('.comment-form');
  if (!form) return;
  e.preventDefault();

  const li = form.closest('li');
  const id = li.dataset.id;
  const input = form.querySelector('input[name="comment"]');
  const text = (input.value || '').trim();

  if (!text) return;

  const idx = state.tips.findIndex(t => t.id === id);
  if (idx !== -1) {
      if (!Array.isArray(state.tips[idx].comments)) {
          state.tips[idx].comments = [];
      }
      const newComment = {
          id: uid(),
          text: safeText(text),
          createdAt: nowISO()
      };
      state.tips[idx].comments.push(newComment);
      input.value = '';
      
      // Update in Firebase
      if (firebase_initialized && db) {
          firebase.database().ref('tips/' + id + '/comments').set(state.tips[idx].comments);
      } else {
          saveTipsLocal(state.tips);
      }
      renderTips();
  }
});

// Initialize tips on first load
loadTipsLocal();
switchTab('map');