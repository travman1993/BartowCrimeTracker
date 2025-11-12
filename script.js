// Tab Switching
const tabs = {
    map: { btn: document.getElementById('tab-map'), el: document.getElementById('map-section') },
    offenders: { btn: document.getElementById('tab-offenders'), el: document.getElementById('offender-selection') },
    tips: { btn: document.getElementById('tab-tips'), el: document.getElementById('tips-sections') }
};

function activateTab(key) {
    Object.values(tabs).forEach(t => {
        t.btn.classList.remove('active');
        t.btn.classList.add('hiddin');
    });
    tabs[key].btn.classList.add('active');
    tabs[key].el.classList.remove('hidden');
}
tabs.map.btn.addEventListener('click', () => activateTab('map'));
tabs.offenders.btn.addEventListener('click', () => activateTab('offenders'));
tabs.tips.btn.addEventListener('click', () => activateTab('tips'));

// Tips image preview
const fileInput = document.getElementById('tip-image');
if (fileInput) {
    let preview = document.querySelector('.tip-preview');
    if (!preview) {
        preview = document.createElement('div');
        prieview.className = 'tip-preview';
        const img = document.createElement('img');
        preview.appendChild(img);
        fileInput.insertAdjacentElement('afterend', preview);    
    }
    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) { preview.computedStyleMap.display = 'none'; return }
        const url = URL.createObjectURL(file);
        preview.querySelector('img').src = url;
        preview.computedStyleMap.display = 'block';
    });
}

// ----- Leaflet Map Setup -----
const map = L.map('map', {
    zoomControl: true,
    attributionControl: true
  });
  
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
  
  // Layer groups (so we can toggle categories)
  const layers = {
    Violent: L.layerGroup().addTo(map),
    Property: L.layerGroup().addTo(map),
    Other: L.layerGroup().addTo(map)
  };
  
  // Layer control UI
  L.control.layers(null, layers, { collapsed: false }).addTo(map);
  
  // ----- Example: add a few sample incidents (remove later) -----
  const samples = [
    { type: 'violent',  lat: 34.165, lng: -84.80, title: 'Aggravated Assault', time: '2025-11-10 22:15', addr: 'Near W Main St' },
    { type: 'property', lat: 34.210, lng: -84.78, title: 'Burglary',           time: '2025-11-10 03:40', addr: 'Old Mill Rd' },
    { type: 'other',    lat: 34.120, lng: -84.73, title: 'Vandalism',          time: '2025-11-09 19:05', addr: 'Hwy 41' }
  ];
  
  samples.forEach(ev => {
    const group = ev.type === 'violent' ? layers.Violent
                : ev.type === 'property' ? layers.Property
                : layers.Other;
  
    const marker = L.circleMarker([ev.lat, ev.lng], circle(
      ev.type === 'violent' ? COLORS.violent :
      ev.type === 'property' ? COLORS.property :
      COLORS.other
    )).bindPopup(`
      <strong>${ev.title}</strong><br/>
      <span>${ev.addr}</span><br/>
      <small>${ev.time}</small>
    `);
  
    marker.addTo(group);
  });
  
  // ----- Helper: plot incidents from your data later -----
  /**
   * plotIncidents([
   *   { lat, lng, type: 'violent'|'property'|'other', title, time, addr }
   * ])
   */
  function plotIncidents(list) {
    // clear existing
    Object.values(layers).forEach(g => g.clearLayers());
  
    list.forEach(ev => {
      const group = ev.type === 'violent' ? layers.Violent
                  : ev.type === 'property' ? layers.Property
                  : layers.Other;
  
      L.circleMarker([ev.lat, ev.lng], circle(
        ev.type === 'violent' ? COLORS.violent :
        ev.type === 'property' ? COLORS.property :
        COLORS.other
      )).bindPopup(`
        <strong>${ev.title}</strong><br/>
        <span>${ev.addr ?? ''}</span><br/>
        <small>${ev.time ?? ''}</small>
      `).addTo(group);
    });
  }
  