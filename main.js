// ============================================
// TREEWATCH — main.js
// Baumkataster Münster via WFS / GeoJSON
// ============================================

const WFS_URL =
  'https://www.stadt-muenster.de/ows/mapserv706/odgruenserv?' +
  'REQUEST=GetFeature&SERVICE=WFS&VERSION=2.0.0&TYPENAME=ms:Baeume' +
  '&OUTPUTFORMAT=GEOJSON&EXCEPTIONS=XML&MAXFEATURES=100000&SRSNAME=EPSG:4326';

// Latin → German translations (most common genera)
const TRANSLATIONS = {
  'Acer':          'Ahorn',
  'Tilia':         'Linde',
  'Quercus':       'Eiche',
  'Fraxinus':      'Esche',
  'Betula':        'Birke',
  'Prunus':        'Kirsche / Pflaume',
  'Pinus':         'Kiefer',
  'Populus':       'Pappel',
  'Robinia':       'Robinie',
  'Platanus':      'Platane',
  'Sorbus':        'Vogelbeere / Eberesche',
  'Picea':         'Fichte',
  'Abies':         'Tanne',
  'Carpinus':      'Hainbuche',
  'Fagus':         'Buche',
  'Ulmus':         'Ulme',
  'Salix':         'Weide',
  'Alnus':         'Erle',
  'Gleditsia':     'Gleditschie',
  'Liriodendron':  'Tulpenbaum',
  'Ginkgo':        'Ginkgo',
  'Liquidambar':   'Amberbaum',
  'Catalpa':       'Trompetenbaum',
  'Magnolia':      'Magnolie',
  'Taxus':         'Eibe',
  'Thuja':         'Lebensbaum',
  'Larix':         'Lärche',
  'Pseudotsuga':   'Douglasie',
  'Juglans':       'Walnuss',
  'Castanea':      'Kastanie',
  'Aesculus':      'Kastanie',
  'Malus':         'Apfelbaum',
  'Pyrus':         'Birnbaum',
  'Crataegus':     'Weißdorn',
  'Corylus':       'Hasel',
  'Cornus':        'Hartriegel',
  'Cercis':        'Judasbaum',
  'Koelreuteria':  'Blasenesche',
  'Paulownia':     'Paulownie',
  'Celtis':        'Zürgelbaum',
};

function getGermanName(latinName) {
  if (!latinName) return 'Unbekannt';
  const genus = latinName.split(' ')[0];
  return TRANSLATIONS[genus] || latinName;
}

// ============================================
// STATE
// ============================================
let allFeatures = [];
let activeSpecies = null;
let clusterGroup = null;
let map = null;

// ============================================
// INIT MAP
// ============================================
function initMap() {
  map = L.map('map', {
    center: [51.9607, 7.6261],
    zoom: 13,
    zoomControl: false,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);
}

// ============================================
// LOADING STATE
// ============================================
function setLoadingProgress(pct, text) {
  document.getElementById('loading-bar').style.width = pct + '%';
  if (text) document.getElementById('loading-sub').textContent = text;
}

function hideLoading() {
  const el = document.getElementById('loading');
  el.classList.add('fade-out');
  setTimeout(() => el.remove(), 700);
}

// ============================================
// CREATE CUSTOM TREE MARKER
// ============================================
function createTreeIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 8px; height: 8px;
      background: #52a66e;
      border-radius: 50%;
      border: 1.5px solid #7bc896;
      box-shadow: 0 0 4px rgba(82,166,110,0.6);
    "></div>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });
}

// ============================================
// BUILD MARKERS
// ============================================
function buildMarkers(features) {
  if (clusterGroup) map.removeLayer(clusterGroup);

  clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction(cluster) {
      const count = cluster.getChildCount();
      let size = 'small';
      if (count > 500) size = 'large';
      else if (count > 100) size = 'medium';
      return L.divIcon({
        html: `<div style="
          width: ${size === 'large' ? 44 : size === 'medium' ? 36 : 28}px;
          height: ${size === 'large' ? 44 : size === 'medium' ? 36 : 28}px;
          background: rgba(45,90,61,0.85);
          border: 1.5px solid rgba(123,200,150,0.6);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-family: 'JetBrains Mono', monospace;
          font-size: ${size === 'large' ? '0.7rem' : '0.65rem'};
          color: #a8e0bc;
          box-shadow: 0 0 12px rgba(82,166,110,0.3);
        ">${count > 999 ? (count/1000).toFixed(1)+'k' : count}</div>`,
        className: '',
        iconSize: [size === 'large' ? 44 : size === 'medium' ? 36 : 28, size === 'large' ? 44 : size === 'medium' ? 36 : 28],
      });
    },
  });

  features.forEach(feature => {
    const coords = feature.geometry?.coordinates;
    if (!coords) return;
    const [lng, lat] = coords;
    const latin = feature.properties?.baumgruppe || feature.properties?.baumgruppe || '';
    const german = getGermanName(latin);

    const marker = L.marker([lat, lng], { icon: createTreeIcon() });

    marker.on('click', () => showTreeDetail(german, latin, lat, lng));

    clusterGroup.addLayer(marker);
  });

  map.addLayer(clusterGroup);
}

// ============================================
// SHOW TREE DETAIL
// ============================================
function showTreeDetail(german, latin, lat, lng) {
  document.getElementById('detail-name').textContent = german;
  document.getElementById('detail-latin').textContent = latin || '—';
  document.getElementById('detail-coords').textContent =
    `${lat.toFixed(5)}°N  ${lng.toFixed(5)}°E`;
  document.getElementById('tree-detail').classList.remove('hidden');
}

// ============================================
// BUILD SPECIES LIST
// ============================================
function buildSpeciesList(features) {
  const counts = {};
  features.forEach(f => {
    const s = f.properties?.baumgruppe || f.properties?.baumgruppe || 'Unbekannt';
    counts[s] = (counts[s] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const container = document.getElementById('species-list');
  container.innerHTML = '';

  // Stats
  document.getElementById('stat-total').textContent = features.length.toLocaleString('de-DE');
  document.getElementById('stat-species').textContent = sorted.length;

  sorted.forEach(([name, count]) => {
    const el = document.createElement('div');
    el.className = 'species-item';
    el.dataset.species = name;
    el.innerHTML = `
      <span class="species-name">${name}</span>
      <span class="species-count">${count}</span>
    `;
    el.addEventListener('click', () => filterBySpecies(name, el));
    container.appendChild(el);
  });
}

// ============================================
// FILTER
// ============================================
function filterBySpecies(name, el) {
  if (activeSpecies === name) {
    activeSpecies = null;
    document.querySelectorAll('.species-item').forEach(i => i.classList.remove('active'));
    buildMarkers(allFeatures);
    updateCount(allFeatures.length);
  } else {
    activeSpecies = name;
    document.querySelectorAll('.species-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    const filtered = allFeatures.filter(f => {
      const s = f.properties?.baumgruppe || f.properties?.baumgruppe || 'Unbekannt';
      return s === name;
    });
    buildMarkers(filtered);
    updateCount(filtered.length);
  }
}

function updateCount(n) {
  document.getElementById('count-num').textContent = n.toLocaleString('de-DE');
}

// Species search
document.getElementById('species-search').addEventListener('input', function() {
  const q = this.value.toLowerCase();
  document.querySelectorAll('.species-item').forEach(el => {
    const name = el.dataset.species.toLowerCase();
    el.style.display = name.includes(q) ? '' : 'none';
  });
});

document.getElementById('clear-filter').addEventListener('click', () => {
  activeSpecies = null;
  document.querySelectorAll('.species-item').forEach(i => i.classList.remove('active'));
  buildMarkers(allFeatures);
  updateCount(allFeatures.length);
});

// ============================================
// PANEL TOGGLES
// ============================================
const filterPanel = document.getElementById('filter-panel');
const infoPanel   = document.getElementById('info-panel');
const filterBtn   = document.getElementById('filter-toggle');
const infoBtn     = document.getElementById('info-toggle');

filterBtn.addEventListener('click', () => {
  const open = !filterPanel.classList.contains('hidden');
  filterPanel.classList.toggle('hidden', open);
  infoPanel.classList.add('hidden');
  filterBtn.classList.toggle('active', !open);
  infoBtn.classList.remove('active');
});

infoBtn.addEventListener('click', () => {
  const open = !infoPanel.classList.contains('hidden');
  infoPanel.classList.toggle('hidden', open);
  filterPanel.classList.add('hidden');
  infoBtn.classList.toggle('active', !open);
  filterBtn.classList.remove('active');
});

document.getElementById('filter-close').addEventListener('click', () => {
  filterPanel.classList.add('hidden');
  filterBtn.classList.remove('active');
});

document.getElementById('info-close').addEventListener('click', () => {
  infoPanel.classList.add('hidden');
  infoBtn.classList.remove('active');
});

document.getElementById('detail-close').addEventListener('click', () => {
  document.getElementById('tree-detail').classList.add('hidden');
});

// ============================================
// FETCH DATA
// ============================================
async function loadTreeData() {
  try {
    setLoadingProgress(20, 'Verbinde mit Open Data Münster...');

    const res = await fetch(WFS_URL);
    setLoadingProgress(60, 'Verarbeite Baumkataster...');

    if (!res.ok) throw new Error('Fetch failed: ' + res.status);

    const data = await res.json();
    setLoadingProgress(85, 'Render Karte...');

    allFeatures = data.features || [];
    console.log('Eigenschaften:', JSON.stringify(allFeatures[0]?.properties));
    buildMarkers(allFeatures);
    buildSpeciesList(allFeatures);
    updateCount(allFeatures.length);

    setLoadingProgress(100, 'Fertig.');
    setTimeout(hideLoading, 400);

  } catch (err) {
    console.error('Fehler beim Laden:', err);

    // Fallback: CORS-Fehler erklären
    document.getElementById('loading-sub').textContent = 'CORS-Fehler — lokale GeoJSON wird benötigt';
    document.getElementById('loading-tree').textContent = '⚠️';
    document.querySelector('.loading-text').textContent = 'Daten konnten nicht geladen werden.';
    setLoadingProgress(100);

    // Map trotzdem zeigen
    setTimeout(hideLoading, 1500);
  }
}

// ============================================
// START
// ============================================
initMap();
loadTreeData();
