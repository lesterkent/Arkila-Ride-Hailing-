/* Tailwind config */
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        }
      },
      animation: {
        'radar-pulse': 'radar 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'bounce-gentle': 'bounceGentle 2s infinite',
      },
      keyframes: {
        radar: {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.4)', opacity: '0' }
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(-5%)' },
          '50%': { transform: 'translateY(0)' }
        }
      }
    }
  }
};

/* CONSTANTS & DATA */
const MAP_CENTER = { lat: 15.9277, lng: 120.3478 };

const LOCAL_LOCATIONS = [
  { id: 'loc-market',   name: 'San Carlos City Public Market',        lat: 15.9296,  lng: 120.3468,  desc: 'Poblacion, San Carlos City' },
  { id: 'loc-hall',     name: 'San Carlos City Hall',                 lat: 15.9271,  lng: 120.3489,  desc: 'Poblacion, San Carlos City' },
  { id: 'loc-church',   name: 'St. Dominic de Guzman Parish Church',  lat: 15.92634, lng: 120.34705, desc: 'Poblacion, San Carlos City' },
  { id: 'loc-plaza',    name: 'San Carlos City Plaza',                lat: 15.9277,  lng: 120.3478,  desc: 'City Center' },
  { id: 'loc-calasiao', name: 'Calasiao Town Proper',                 lat: 16.0119,  lng: 120.3542,  desc: 'Calasiao, Pangasinan' },
  { id: 'loc-dagupan',  name: 'Dagupan City Center',                  lat: 16.0433,  lng: 120.3339,  desc: 'Dagupan City, Pangasinan' }
];

const DRIVER_PROFILES = [
  { id: 'drv-1', name: 'Juan Dela Cruz', rating: 4.9, trips: '1,240', vehicle: 'Honda Click 125i', plate: 'ABC 1234', phone: '09171234567', photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80' },
  { id: 'drv-2', name: 'Mark Anthony Santos', rating: 4.85, trips: '890', vehicle: 'Yamaha Mio i125', plate: 'XYZ 9876', phone: '09189876543', photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80' },
  { id: 'drv-3', name: 'Rodrigo Perez', rating: 4.95, trips: '2,100', vehicle: 'Tricycle Bajaj RE', plate: 'TR-5542', phone: '09223334444', photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80' }
];

const AppState = {
  currentUserRole: 'passenger',
  currentTab: 'tab-home',
  pickupLocation: LOCAL_LOCATIONS[0],
  destinationLocation: LOCAL_LOCATIONS[1],
  selectedVehicle: 'motorcycle',
  selectedPaymentMethod: 'GCash',
  appliedPromo: null,
  currentCalculatedDistance: 1.8,
  currentCalculatedFare: 49,
  activeBooking: null,
  driverOnlineStatus: false,
  driverTodayEarnings: 845.00,
  driverCompletedTripsCount: 12,
  mapPickerActive: false,

  map: null,
  mapReady: false,
  darkMap: true,
  satelliteOn: false,
  mapMarkers: {},
  nearbyDriverMarkers: [],
  driverMarker: null,
  routeCoords: [],
  routeRequestId: 0,

  driverMovementTimer: null,
  searchTimer: null,
  simulatedTip: 0,
  userRating: 5
};

/* STORAGE HELPERS */
const Storage = {
  get(key, fallback = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage set failed', e);
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('Storage remove failed', e);
    }
  }
};

/* DOM HELPERS */
const DOM = {
  setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
  },
  setClass(id, className) {
    const el = document.getElementById(id);
    if (el) el.className = className;
  },
  toggleHidden(id, force) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', force);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMap();
  populateLocationDropdowns();
  renderPopularDestinations();
  loadTripHistoryFromStorage();
  calculateRouteAndFares();
  showToast("Arkila 2.0 Platform Ready", "success");
});

/* THEME INITIALIZATION & TOGGLE FUNCTIONS */
function initTheme() {
  const savedTheme = Storage.get('arkila_theme');
  AppState.darkMap = savedTheme ? savedTheme === 'dark' : true;
  applyThemeUI();
}

function applyThemeUI() {
  const htmlEl = document.documentElement;
  const toggleCheckbox = document.getElementById('dark-map-toggle');

  if (AppState.darkMap) {
    htmlEl.classList.add('dark');
    if (toggleCheckbox) toggleCheckbox.checked = true;
  } else {
    htmlEl.classList.remove('dark');
    if (toggleCheckbox) toggleCheckbox.checked = false;
  }

  applyBaseLayer();
}

function toggleTheme() {
  AppState.darkMap = !AppState.darkMap;
  Storage.set('arkila_theme', AppState.darkMap ? 'dark' : 'light');
  applyThemeUI();
  showToast(`Switched to ${AppState.darkMap ? 'Dark' : 'Light'} Mode`, "info");
}

let resizeDebounce;
window.addEventListener('resize', () => {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(() => {
    AppState.map?.resize();
  }, 100);
});

/* 1. MAP INTEGRATION & ROUTING FUNCTIONS */
function buildMapStyle() {
  const active = getActiveBaseLayer();
  const vis = id => (id === active ? 'visible' : 'none');

  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '&copy; OpenStreetMap'
      },
      dark: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '&copy; OpenStreetMap &copy; CARTO'
      },
      satellite: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '&copy; Esri'
      }
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0f172a' } },
      { id: 'base-osm', type: 'raster', source: 'osm', layout: { visibility: vis('osm') } },
      { id: 'base-dark', type: 'raster', source: 'dark', layout: { visibility: vis('dark') } },
      { id: 'base-satellite', type: 'raster', source: 'satellite', layout: { visibility: vis('satellite') } }
    ]
  };
}

function getActiveBaseLayer() {
  if (AppState.satelliteOn) return 'satellite';
  return AppState.darkMap ? 'dark' : 'osm';
}

function applyBaseLayer() {
  const map = AppState.map;
  if (!map || !AppState.mapReady) return;
  const active = getActiveBaseLayer();
  ['osm', 'dark', 'satellite'].forEach(id => {
    if (map.getLayer(`base-${id}`)) {
      map.setLayoutProperty(`base-${id}`, 'visibility', id === active ? 'visible' : 'none');
    }
  });
}

function initMap() {
  if (typeof maplibregl === 'undefined') {
    showToast("Map library failed to load.", "error");
    return;
  }

  AppState.map = new maplibregl.Map({
    container: 'map',
    style: buildMapStyle(),
    center: [MAP_CENTER.lng, MAP_CENTER.lat],
    zoom: 14,
    attributionControl: false
  });

  const map = AppState.map;
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

  map.on('load', () => {
    AppState.mapReady = true;

    map.addSource('route', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }
    });
    map.addLayer({
      id: 'route-casing',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#022c22', 'line-width': 8, 'line-opacity': 0.55 }
    });
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#10b981', 'line-width': 4.5, 'line-opacity': 0.95 }
    });

    setRouteLine(AppState.routeCoords);
    renderNearbyDriverRadarMarkers();
    applyBaseLayer();
  });

  map.on('click', (e) => {
    if (!AppState.mapPickerActive) return;
    const clickedLat = e.lngLat.lat;
    const clickedLng = e.lngLat.lng;

    AppState.destinationLocation = {
      id: 'loc-custom',
      name: `Custom Pin (${clickedLat.toFixed(3)}, ${clickedLng.toFixed(3)})`,
      lat: clickedLat,
      lng: clickedLng,
      desc: 'Selected Location'
    };

    disableMapPicker();
    calculateRouteAndFares();
    showToast("Custom destination set!", "success");
  });
}

function createMarkerElement(type) {
  const el = document.createElement('div');
  el.className = 'custom-marker';

  const icons = {
    pickup: `<div class="w-7 h-7 rounded-full bg-brand-500 border-2 border-white flex items-center justify-center text-white font-bold text-xs shadow-lg"><i class="fa-solid fa-circle text-[8px]"></i></div>`,
    destination: `<div class="w-7 h-7 rounded-full bg-rose-500 border-2 border-white flex items-center justify-center text-white font-bold text-xs shadow-lg"><i class="fa-solid fa-location-dot text-[10px]"></i></div>`,
    'driver-moto': `<div class="w-9 h-9 rounded-full bg-slate-900 border-2 border-brand-400 text-brand-400 flex items-center justify-center text-xs shadow-xl"><i class="fa-solid fa-motorcycle"></i></div>`,
    'driver-trike': `<div class="w-9 h-9 rounded-full bg-slate-900 border-2 border-amber-400 text-amber-400 flex items-center justify-center text-xs shadow-xl"><i class="fa-solid fa-taxi"></i></div>`
  };

  el.innerHTML = icons[type] || icons['driver-trike'];
  return el;
}

function addMarker(type, lat, lng) {
  if (!AppState.map) return null;
  return new maplibregl.Marker({ element: createMarkerElement(type), anchor: 'center' })
    .setLngLat([lng, lat])
    .addTo(AppState.map);
}

function renderNearbyDriverRadarMarkers() {
  if (!AppState.map) return;

  AppState.nearbyDriverMarkers.forEach(m => m.remove());
  AppState.nearbyDriverMarkers = [];

  const { lat: centerLat, lng: centerLng } = AppState.pickupLocation;

  const offsets = [
    { lat: 0.005, lng: 0.004 },
    { lat: -0.004, lng: 0.006 },
    { lat: 0.003, lng: -0.005 }
  ];

  offsets.forEach((offset, idx) => {
    const marker = addMarker(idx % 2 === 0 ? 'driver-moto' : 'driver-trike', centerLat + offset.lat, centerLng + offset.lng);
    if (marker) {
      marker.setPopup(new maplibregl.Popup({ offset: 20, closeButton: false }).setText(`Driver #${idx + 1}`));
      AppState.nearbyDriverMarkers.push(marker);
    }
  });
}

function setRouteLine(coords) {
  AppState.routeCoords = coords;
  const map = AppState.map;
  if (!map || !AppState.mapReady) return;
  const src = map.getSource('route');
  src?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
}

function fitMapToCoords(coords) {
  const map = AppState.map;
  if (!map || !coords || coords.length === 0) return;
  const bounds = new maplibregl.LngLatBounds();
  coords.forEach(c => bounds.extend(c));
  map.fitBounds(bounds, { padding: 45, maxZoom: 16, duration: 600 });
}

function drawEndpointMarkers(p, d) {
  if (!AppState.map) return;
  AppState.mapMarkers.pickup?.remove();
  AppState.mapMarkers.destination?.remove();

  AppState.mapMarkers.pickup = addMarker('pickup', p.lat, p.lng);
  AppState.mapMarkers.destination = addMarker('destination', d.lat, d.lng);
}

async function fetchRoadRoute(p, d) {
  const url = `https://router.project-osrm.org/route/v1/driving/${p.lng},${p.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route found');

    const route = data.routes[0];
    return {
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      coords: route.geometry.coordinates
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildRouteMeasure(coords) {
  const cumulative = [0];
  for (let i = 1; i < coords.length; i++) {
    const seg = haversineKm(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
    cumulative.push(cumulative[i - 1] + seg);
  }
  return { coords, cumulative, total: cumulative[cumulative.length - 1] };
}

function pointAlongRoute(measure, fraction) {
  const { coords, cumulative, total } = measure;
  if (coords.length === 0) return null;
  if (coords.length === 1 || total === 0) return coords[0];

  const target = total * Math.min(Math.max(fraction, 0), 1);
  for (let i = 1; i < cumulative.length; i++) {
    if (cumulative[i] >= target) {
      const segLen = cumulative[i] - cumulative[i - 1] || 1;
      const t = (target - cumulative[i - 1]) / segLen;
      return [
        coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
        coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t
      ];
    }
  }
  return coords[coords.length - 1];
}

/* 2. HAVERSINE DISTANCE & FARE CALCULATION ENGINE */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const d = haversineKm(lat1, lon1, lat2, lon2);
  return Math.max(0.8, parseFloat(d.toFixed(1)));
}

function applyRouteMetrics(distance, etaMins) {
  AppState.currentCalculatedDistance = distance;

  const motoFare = Math.round(35 + (distance * 8));
  const trikeFare = Math.round(50 + (distance * 12));

  DOM.setText('route-distance-text', `${distance} km`);
  DOM.setText('route-eta-text', `${etaMins} mins`);
  
  const summaryBar = document.getElementById('route-summary-bar');
  if (summaryBar) {
    summaryBar.classList.remove('hidden');
    summaryBar.classList.add('grid');
  }

  DOM.setText('fare-motorcycle', `₱${motoFare}.00`);
  DOM.setText('fare-tricycle', `₱${trikeFare}.00`);

  AppState.currentCalculatedFare = AppState.selectedVehicle === 'motorcycle' ? motoFare : trikeFare;
}

function calculateRouteAndFares() {
  const pSelect = document.getElementById('pickup-select');
  const dSelect = document.getElementById('destination-select');

  if (pSelect?.value) {
    const foundP = LOCAL_LOCATIONS.find(l => l.id === pSelect.value);
    if (foundP) AppState.pickupLocation = foundP;
  }
  if (dSelect?.value) {
    const foundD = LOCAL_LOCATIONS.find(l => l.id === dSelect.value);
    if (foundD) AppState.destinationLocation = foundD;
  }

  const p = AppState.pickupLocation;
  const d = AppState.destinationLocation;
  const requestId = ++AppState.routeRequestId;

  const straightKm = calculateHaversineDistance(p.lat, p.lng, d.lat, d.lng);
  const straightEta = Math.max(2, Math.round((straightKm / 30) * 60) + 2);
  applyRouteMetrics(straightKm, straightEta);

  drawEndpointMarkers(p, d);
  setRouteLine([]);
  fitMapToCoords([[p.lng, p.lat], [d.lng, d.lat]]);

  fetchRoadRoute(p, d)
    .then(route => {
      if (requestId !== AppState.routeRequestId) return;
      const roadKm = Math.max(0.8, parseFloat(route.distanceKm.toFixed(1)));
      const roadEta = Math.max(2, Math.round(route.durationMin * 1.2) + 2);
      applyRouteMetrics(roadKm, roadEta);
      setRouteLine(route.coords);
      fitMapToCoords(route.coords);
    })
    .catch(() => {
      if (requestId !== AppState.routeRequestId) return;
      setRouteLine([[p.lng, p.lat], [d.lng, d.lat]]);
    });
}

/* 3. UI TAB SWITCHING & DROPDOWN MANAGEMENT */
function populateLocationDropdowns() {
  const pSelect = document.getElementById('pickup-select');
  const dSelect = document.getElementById('destination-select');
  if (!pSelect || !dSelect) return;

  pSelect.innerHTML = '';
  dSelect.innerHTML = '';

  LOCAL_LOCATIONS.forEach((loc, idx) => {
    pSelect.add(new Option(`${loc.name} (${loc.desc})`, loc.id, idx === 0, idx === 0));
    dSelect.add(new Option(`${loc.name} (${loc.desc})`, loc.id, idx === 1, idx === 1));
  });
}

function renderPopularDestinations() {
  const container = document.getElementById('popular-destinations-list');
  if (!container) return;
  container.innerHTML = '';

  LOCAL_LOCATIONS.slice(2, 6).forEach(loc => {
    const item = document.createElement('div');
    item.className = 'glass-card p-2.5 sm:p-3 rounded-xl border border-slate-800 hover:border-brand-500/40 flex items-center justify-between cursor-pointer transition duration-150 group active:scale-[0.99]';
    item.onclick = () => quickSetDestination(loc.name);
    item.innerHTML = `
      <div class="flex items-center space-x-2.5 min-w-0 pr-2">
        <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center text-xs shrink-0">
          <i class="fa-solid fa-location-dot"></i>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-bold text-slate-200 group-hover:text-brand-300 transition truncate">${loc.name}</p>
          <p class="text-[10px] text-slate-400 truncate">${loc.desc}</p>
        </div>
      </div>
      <i class="fa-solid fa-chevron-right text-xs text-slate-600 group-hover:text-brand-400 transition shrink-0"></i>
    `;
    container.appendChild(item);
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.view-tab').forEach(tab => tab.classList.add('hidden'));
  document.getElementById(tabId)?.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('text-brand-400', 'active');
    item.classList.add('text-slate-400');
  });

  const navBtn = document.getElementById(`nav-${tabId}`);
  if (navBtn) {
    navBtn.classList.remove('text-slate-400');
    navBtn.classList.add('text-brand-400', 'active');
  }

  AppState.currentTab = tabId;
}

function switchUserRole(role) {
  AppState.currentUserRole = role;
  const isPassenger = role === 'passenger';

  DOM.setClass(
    'mode-passenger-btn',
    isPassenger
      ? 'px-2.5 sm:px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center space-x-1.5 bg-brand-600 text-white shadow-sm font-semibold'
      : 'px-2.5 sm:px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center space-x-1.5 text-slate-400 hover:text-slate-200'
  );

  DOM.setClass(
    'mode-driver-btn',
    !isPassenger
      ? 'px-2.5 sm:px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center space-x-1.5 bg-brand-600 text-white shadow-sm font-semibold'
      : 'px-2.5 sm:px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center space-x-1.5 text-slate-400 hover:text-slate-200'
  );

  switchTab(isPassenger ? 'tab-home' : 'tab-driver-dashboard');
  showToast(isPassenger ? "Passenger Mode" : "Driver Mode", "info");
}

function quickSetDestination(locationName) {
  const found = LOCAL_LOCATIONS.find(l => l.name.includes(locationName));
  if (found) {
    AppState.destinationLocation = found;
    const dSelect = document.getElementById('destination-select');
    if (dSelect) dSelect.value = found.id;
  }
  switchTab('tab-booking');
  calculateRouteAndFares();
}

function openRouteSelector() {
  switchTab('tab-booking');
  calculateRouteAndFares();
}

function swapLocations() {
  const temp = AppState.pickupLocation;
  AppState.pickupLocation = AppState.destinationLocation;
  AppState.destinationLocation = temp;

  const pSelect = document.getElementById('pickup-select');
  const dSelect = document.getElementById('destination-select');

  if (pSelect) pSelect.value = AppState.pickupLocation.id;
  if (dSelect) dSelect.value = AppState.destinationLocation.id;

  calculateRouteAndFares();
  showToast("Locations swapped", "info");
}

function selectVehicle(type) {
  AppState.selectedVehicle = type;
  const isMoto = type === 'motorcycle';

  DOM.setClass(
    'vehicle-option-motorcycle',
    isMoto
      ? 'vehicle-card p-3 rounded-2xl glass-card border-2 border-brand-500 bg-brand-950/20 cursor-pointer transition flex items-center justify-between active:scale-[0.99]'
      : 'vehicle-card p-3 rounded-2xl glass-card border border-slate-800 hover:border-slate-700 cursor-pointer transition flex items-center justify-between active:scale-[0.99]'
  );

  DOM.setClass(
    'vehicle-option-tricycle',
    !isMoto
      ? 'vehicle-card p-3 rounded-2xl glass-card border-2 border-amber-500 bg-amber-950/20 cursor-pointer transition flex items-center justify-between active:scale-[0.99]'
      : 'vehicle-card p-3 rounded-2xl glass-card border border-slate-800 hover:border-slate-700 cursor-pointer transition flex items-center justify-between active:scale-[0.99]'
  );

  calculateRouteAndFares();
}

function enableMapPicker() {
  AppState.mapPickerActive = true;
  DOM.toggleHidden('map-tap-picker-banner', false);
}

function disableMapPicker() {
  AppState.mapPickerActive = false;
  DOM.toggleHidden('map-tap-picker-banner', true);
}

/* 4. PAYMENT & PROMO CODE DISCOUNTS */
function openPaymentModal() {
  const baseFare = AppState.currentCalculatedFare;
  const discount = AppState.appliedPromo ? 20 : 0;
  const total = Math.max(10, baseFare + 5 - discount);

  DOM.setText('modal-vehicle-type-label', AppState.selectedVehicle === 'motorcycle' ? 'Motorcycle' : 'Tricycle');
  DOM.setText('modal-base-fare-val', `₱${baseFare}.00`);
  DOM.setText('modal-total-fare-val', `₱${total}.00`);

  if (AppState.appliedPromo) {
    DOM.toggleHidden('modal-discount-row', false);
    DOM.setText('modal-discount-val', `-₱${discount}.00`);
  } else {
    DOM.toggleHidden('modal-discount-row', true);
  }

  DOM.toggleHidden('payment-modal', false);
}

function closePaymentModal() {
  DOM.toggleHidden('payment-modal', true);
}

function applyPromoCode() {
  const input = document.getElementById('promo-input');
  const code = input?.value.trim().toUpperCase();
  if (code === 'ARKILA2026' || code === 'FREERIDE') {
    AppState.appliedPromo = code;
    showToast(`Promo ${code} applied! ₱20 OFF`, "success");
    openPaymentModal();
  } else {
    showToast("Invalid code. Try 'ARKILA2026'", "error");
  }
}

function updatePaymentSelection(radio) {
  AppState.selectedPaymentMethod = radio.value;
}

/* 5. DRIVER MATCHING RADAR & REAL-TIME SIMULATION */
function confirmBookingAndFindDriver() {
  closePaymentModal();
  switchTab('tab-tracking');

  DOM.toggleHidden('searching-state-view', false);
  DOM.toggleHidden('tracking-state-view', true);

  if (AppState.driverOnlineStatus) {
    triggerDriverIncomingRequest();
  }

  if (AppState.searchTimer) clearTimeout(AppState.searchTimer);
  AppState.searchTimer = setTimeout(() => {
    assignDriverToBooking();
  }, 3000);
}

function assignDriverToBooking() {
  const randomDriver = DRIVER_PROFILES[Math.floor(Math.random() * DRIVER_PROFILES.length)];
  AppState.activeBooking = {
    driver: randomDriver,
    pickup: AppState.pickupLocation,
    destination: AppState.destinationLocation,
    fare: AppState.currentCalculatedFare + 5 - (AppState.appliedPromo ? 20 : 0),
    paymentMethod: AppState.selectedPaymentMethod,
    progress: 0
  };

  const photoEl = document.getElementById('assigned-driver-photo');
  if (photoEl) photoEl.src = randomDriver.photo;

  DOM.setText('assigned-driver-name', randomDriver.name);
  DOM.setText('assigned-driver-rating', randomDriver.rating);
  DOM.setText('assigned-driver-trips', `${randomDriver.trips} trips`);
  DOM.setText('assigned-vehicle-name', randomDriver.vehicle);
  DOM.setText('assigned-plate-number', randomDriver.plate);

  DOM.toggleHidden('searching-state-view', true);
  DOM.toggleHidden('tracking-state-view', false);

  showToast(`Driver ${randomDriver.name} Assigned!`, "success");
  startDriverLiveMovementSimulation();
}

function removeDriverMarker() {
  if (AppState.driverMarker) {
    AppState.driverMarker.remove();
    AppState.driverMarker = null;
  }
}

function startDriverLiveMovementSimulation() {
  if (AppState.driverMovementTimer) clearInterval(AppState.driverMovementTimer);
  removeDriverMarker();

  let progressPct = 0;
  const progressBar = document.getElementById('simulation-progress-bar');
  const p = AppState.pickupLocation;
  const d = AppState.destinationLocation;

  const routeCoords = AppState.routeCoords.length > 1
    ? AppState.routeCoords
    : [[p.lng, p.lat], [d.lng, d.lat]];
  const measure = buildRouteMeasure(routeCoords);

  AppState.driverMarker = addMarker(
    AppState.selectedVehicle === 'motorcycle' ? 'driver-moto' : 'driver-trike',
    p.lat,
    p.lng
  );

  AppState.driverMovementTimer = setInterval(() => {
    progressPct = Math.min(100, progressPct + 5);

    if (progressBar) progressBar.style.width = `${progressPct}%`;
    DOM.setText('simulation-progress-pct', `${progressPct}% Progress`);

    const pos = pointAlongRoute(measure, progressPct / 100);
    if (pos && AppState.driverMarker) AppState.driverMarker.setLngLat(pos);

    const remDistance = (AppState.currentCalculatedDistance * (1 - progressPct / 100)).toFixed(1);
    const remEta = Math.max(1, Math.ceil(remDistance * 2));

    DOM.setText('live-distance-rem', `${remDistance} km`);
    DOM.setText('live-eta-countdown', `${remEta} mins`);

    if (progressPct >= 100) {
      clearInterval(AppState.driverMovementTimer);
      removeDriverMarker();
      setTimeout(completeTripAndOpenReceipt, 800);
    }
  }, 600);
}

function cancelBookingProcess() {
  if (AppState.driverMovementTimer) clearInterval(AppState.driverMovementTimer);
  if (AppState.searchTimer) clearTimeout(AppState.searchTimer);
  removeDriverMarker();
  AppState.activeBooking = null;
  switchTab('tab-home');
  showToast("Booking cancelled", "info");
}

/* 6. DRIVER MODE SIMULATION */
function toggleDriverOnlineStatus() {
  const toggle = document.getElementById('driver-status-toggle');
  AppState.driverOnlineStatus = !!toggle?.checked;

  if (AppState.driverOnlineStatus) {
    DOM.setClass('driver-online-indicator', 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0');
    DOM.setText('driver-online-text', 'YOU ARE ONLINE');
    DOM.setClass('driver-online-text', 'font-bold text-xs sm:text-sm text-emerald-400 uppercase tracking-wide truncate');
    DOM.setClass('driver-badge-indicator', 'w-2 h-2 rounded-full bg-emerald-500 inline-block');
    showToast("Driver Mode: Online", "success");
  } else {
    DOM.setClass('driver-online-indicator', 'w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0');
    DOM.setText('driver-online-text', 'YOU ARE OFFLINE');
    DOM.setClass('driver-online-text', 'font-bold text-xs sm:text-sm text-slate-300 uppercase tracking-wide truncate');
    DOM.setClass('driver-badge-indicator', 'w-2 h-2 rounded-full bg-slate-500 inline-block');
    showToast("Driver Mode: Offline", "info");
  }
}

function triggerDriverIncomingRequest() {
  DOM.setText('incoming-fare-badge', `₱${AppState.currentCalculatedFare}.00`);
  DOM.setText('incoming-pickup-text', AppState.pickupLocation.name);
  DOM.setText('incoming-dest-text', AppState.destinationLocation.name);
  DOM.toggleHidden('driver-incoming-card', false);
}

function acceptDriverRequest() {
  DOM.toggleHidden('driver-incoming-card', true);
  DOM.toggleHidden('driver-active-trip-panel', false);
  showToast("Request accepted!", "success");
}

function declineDriverRequest() {
  DOM.toggleHidden('driver-incoming-card', true);
  showToast("Request declined", "info");
}

function advanceDriverTripStage() {
  const actionBtn = document.getElementById('driver-action-btn');
  if (!actionBtn) return;

  if (actionBtn.innerText.includes('Start Trip')) {
    DOM.setText('driver-job-status', 'IN PROGRESS');
    DOM.setClass('driver-job-status', 'text-[9px] font-bold bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded-full');
    actionBtn.innerText = 'Complete Trip & Collect Fare';
    showToast("Trip started!", "info");
  } else {
    DOM.toggleHidden('driver-active-trip-panel', true);
    AppState.driverTodayEarnings += AppState.currentCalculatedFare;
    AppState.driverCompletedTripsCount += 1;

    DOM.setText('driver-earnings-val', `₱${AppState.driverTodayEarnings.toFixed(2)}`);
    DOM.setText('driver-trips-count', `${AppState.driverCompletedTripsCount} Trips`);

    showToast("Trip completed!", "success");
  }
}

/* 7. TRIP COMPLETION & STORAGE */
function completeTripAndOpenReceipt() {
  const booking = AppState.activeBooking || {
    driver: DRIVER_PROFILES[0],
    pickup: AppState.pickupLocation,
    destination: AppState.destinationLocation,
    fare: AppState.currentCalculatedFare,
    paymentMethod: AppState.selectedPaymentMethod
  };

  const receiptId = `ARK-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

  DOM.setText('receipt-driver-name', booking.driver.name);
  DOM.setText('receipt-id-tag', `#${receiptId}`);
  DOM.setText('receipt-date-stamp', now);
  DOM.setText('receipt-route-text', `${booking.pickup.name} → ${booking.destination.name}`);
  DOM.setText('receipt-fare-val', `₱${booking.fare}.00`);
  DOM.setText('receipt-tip-val', `₱${AppState.simulatedTip}.00`);
  DOM.setText('receipt-total-val', `₱${booking.fare + AppState.simulatedTip}.00`);

  saveTripToLocalStorage({
    id: receiptId,
    date: now,
    pickup: booking.pickup.name,
    destination: booking.destination.name,
    vehicle: AppState.selectedVehicle,
    driver: booking.driver.name,
    fare: booking.fare + AppState.simulatedTip,
    paymentMethod: booking.paymentMethod
  });

  DOM.toggleHidden('printable-receipt-modal', false);
}

function setStarRating(stars) {
  AppState.userRating = stars;
  const starBox = document.getElementById('star-rating-box');
  const icons = starBox?.querySelectorAll('i');

  icons?.forEach((icon, idx) => {
    icon.className = idx < stars 
      ? 'fa-solid fa-star text-amber-400 cursor-pointer transition'
      : 'fa-solid fa-star text-slate-600 cursor-pointer transition';
  });
  showToast(`Rated ${stars} Stars!`, "success");
}

function selectTipAmount(amount, btn) {
  AppState.simulatedTip = amount;
  document.querySelectorAll('.tip-btn').forEach(b => {
    b.className = 'tip-btn px-2 py-1 rounded-lg bg-slate-800 text-[11px] font-bold text-slate-300';
  });
  if (btn) {
    btn.className = 'tip-btn px-2 py-1 rounded-lg bg-slate-700 text-[11px] font-bold text-white border border-brand-500';
  }

  const baseFare = AppState.activeBooking ? AppState.activeBooking.fare : AppState.currentCalculatedFare;
  DOM.setText('receipt-tip-val', `₱${amount}.00`);
  DOM.setText('receipt-total-val', `₱${baseFare + amount}.00`);
}

function finishTripAndReset() {
  DOM.toggleHidden('printable-receipt-modal', true);
  switchTab('tab-home');
  loadTripHistoryFromStorage();
}

function saveTripToLocalStorage(tripObj) {
  const history = Storage.get('arkila_trip_history', []);
  history.unshift(tripObj);
  Storage.set('arkila_trip_history', history);
}

function loadTripHistoryFromStorage() {
  const container = document.getElementById('history-items-container');
  if (!container) return;
  const history = Storage.get('arkila_trip_history', []);

  if (history.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-500 text-xs">
        <i class="fa-solid fa-clock-rotate-left text-2xl mb-2 block"></i>
        No previous trips logged yet.
      </div>
    `;
    return;
  }

  container.innerHTML = history.map(trip => `
    <div class="glass-card p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
      <div class="flex justify-between items-center font-bold text-white">
        <span class="text-brand-400">${trip.id}</span>
        <span class="text-slate-400 text-[9px]">${trip.date}</span>
      </div>
      <div class="text-slate-300 space-y-0.5">
        <p class="truncate"><i class="fa-solid fa-circle text-brand-400 text-[8px] mr-1"></i> ${trip.pickup}</p>
        <p class="truncate"><i class="fa-solid fa-location-dot text-rose-500 text-[8px] mr-1"></i> ${trip.destination}</p>
      </div>
      <div class="flex justify-between items-center pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
        <span class="truncate pr-2">Driver: ${trip.driver} (${trip.paymentMethod})</span>
        <strong class="text-xs sm:text-sm font-extrabold text-white shrink-0">₱${trip.fare}.00</strong>
      </div>
    </div>
  `).join('');
}

function clearTripHistory() {
  Storage.remove('arkila_trip_history');
  loadTripHistoryFromStorage();
  showToast("Trip history cleared", "info");
}

/* 8. UTILITY NOTIFICATIONS & SIMULATOR */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClasses = {
    success: 'bg-brand-900 border-brand-500 text-brand-200',
    error: 'bg-rose-950 border-rose-600 text-rose-200',
    info: 'bg-slate-800 border-slate-700 text-slate-200'
  };

  const bg = bgClasses[type] || bgClasses.info;

  toast.className = `${bg} border px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold shadow-2xl flex items-center space-x-2 transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto max-w-[90vw]`;
  toast.innerHTML = `<span class="truncate">${message}</span>`;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

function recenterMapOnUser() {
  if (AppState.map) {
    AppState.map.flyTo({
      center: [AppState.pickupLocation.lng, AppState.pickupLocation.lat],
      zoom: 15,
      duration: 600
    });
    showToast("Recentered map", "info");
  }
}

function toggleMapStyleLayer() {
  AppState.satelliteOn = !AppState.satelliteOn;
  applyBaseLayer();
  showToast(AppState.satelliteOn ? "Satellite view" : "Street view", "info");
}

function toggleDarkMapStyle() {
  toggleTheme();
}

function toggleDeviceSimulator() {
  const panel = document.getElementById('interactive-panel');
  if (panel) {
    panel.classList.toggle('md:w-[440px]');
    panel.classList.toggle('md:w-full');
  }

  setTimeout(() => {
    AppState.map?.resize();
  }, 320);
}