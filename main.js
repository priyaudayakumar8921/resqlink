const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://resqlink-backend-apyp.onrender.com';
import './style.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { io } from 'socket.io-client';

// The user must put their config in .env: VITE_FIREBASE_API_KEY, etc.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let messaging;
try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
        showToast(`🚨 ${payload.notification.title}: ${payload.notification.body}`, 'warning');
    });
} catch (e) {
    console.warn('Firebase missing configuration.');
}

const API_BASE = '/api';

// --- APPLICATION STATE VARIABLES ---
let currentLang = 'en';
let isOnline = true;
let isSoundOn = true;
let selectedDistrict = 'Kerala State';
let reportStep = 1;
let currentReportType = '';
let attachedPhotoUrl = '';
let mapInstance = null;
let markerGroup = null;

// Fix Leaflet's default icon path issue in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Emergency Icons
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const amberIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// --- COUNTER STATS ---
let stats = { totalReports: 0, confirmedAlerts: 0, subscribers: 0 };
let feeds = [];
let offlineQueue = [];
let smsLogs = [];
let weatherAlerts = [];
let reliefCamps = [];
let currentFilter = 'All';
let resources = [];

// Dictionary
const districtsData = [
    { name: "Kasaragod", lat: 12.51020, lng: 74.98520 },
    { name: "Kannur", lat: 11.87450, lng: 75.37040 },
    { name: "Wayanad", lat: 11.68540, lng: 76.13200 },
    { name: "Kozhikode", lat: 11.25880, lng: 75.78040 },
    { name: "Malappuram", lat: 11.07350, lng: 76.07400 },
    { name: "Palakkad", lat: 10.78670, lng: 76.65470 },
    { name: "Thrissur", lat: 10.52760, lng: 76.21440 },
    { name: "Ernakulam", lat: 9.98160, lng: 76.29990 },
    { name: "Idukki", lat: 9.91890, lng: 77.10250 },
    { name: "Kottayam", lat: 9.59160, lng: 76.52200 },
    { name: "Alappuzha", lat: 9.49810, lng: 76.33880 },
    { name: "Pathanamthitta", lat: 9.26480, lng: 76.78700 },
    { name: "Kollam", lat: 8.89320, lng: 76.61410 },
    { name: "Thiruvananthapuram", lat: 8.52410, lng: 76.93660 }
];


// --- TRANSLATION DICTIONARY ---
const t = {
    en: {
        title: "Resqlink",
        motto: "Kerala Emergency Resilience Net",
        totalReports: "TOTAL REPORTS",
        confirmedAlerts: "CONFIRMED ALERTS",
        subscribers: "SUBSCRIBERS",
        lblVerified: "Verified Live",
        lblBroadcast: "Broadcast Net",
        tacticalCenter: "Tactical Center",
        recentEmergencyFeeds: "Recent Emergency Feeds",
        reportEmergency: "Report Emergency",
        getAlerts: "Get Alerts",
        homeBtn: "Home",
        reportBtn: "Report",
        alertsBtn: "Alerts",
        resourcesBtn: "Supplies",
        radioTitle: "Radio Broadcast",
        radioDesc: "Advisories in Malayalam & English",
        playRadioBtn: "Play Live Forecast",
        watchlistTitle: "District Watchlist",
        step1: "1. Select Incident Type",
        step2: "2. Confirm Location",
        step3: "3. Details & Submit",
        shareGps: "Fetch Current GPS Location",
        submitBtn: "Submit Report"
    },
    ml: {
        title: "Resqlink",
        motto: "കേരള എമർജൻസി റെസിലിയൻസ് നെറ്റ്",
        totalReports: "ആകെ റിപ്പോർട്ടുകൾ",
        confirmedAlerts: "സ്ഥിരീകരിച്ച അലർട്ടുകൾ",
        subscribers: "വരിക്കാർ",
        lblVerified: "തത്സമയം",
        lblBroadcast: "ബ്രോഡ്കാസ്റ്റ് നെറ്റ്",
        tacticalCenter: "ശ്രദ്ധാകേന്ദ്രം",
        recentEmergencyFeeds: "പുതിയ റിപ്പോർട്ടുകൾ",
        reportEmergency: "അടിയന്തരം റിപ്പോർട്ട് ചെയ്യുക",
        getAlerts: "അലർട്ടുകൾ നേടുക",
        homeBtn: "ഹോം",
        reportBtn: "റിപ്പോർട്ട്",
        alertsBtn: "അലർട്ടുകൾ",
        resourcesBtn: "സഹായം",
        radioTitle: "റേഡിയോ ബ്രോഡ്കാസ്റ്റ്",
        radioDesc: "മലയാളത്തിലും ഇംഗ്ലീഷിലുമുള്ള മുന്നറിയിപ്പുകൾ",
        playRadioBtn: "തത്സമയ വിവരങ്ങൾ കേൾക്കുക",
        watchlistTitle: "ജില്ലാ നിരീക്ഷണ പട്ടിക",
        step1: "1. അപകട തരം തിരഞ്ഞെടുക്കുക",
        step2: "2. സ്ഥലം സ്ഥിരീകരിക്കുക",
        step3: "3. വിശദാംശങ്ങളും സമർപ്പണവും",
        shareGps: "നിലവിലെ GPS ലൊക്കേഷൻ എടുക്കുക",
        submitBtn: "റിപ്പോർട്ട് സമർപ്പിക്കുക"
    }
};

function updateLanguageTexts() {
    const lang = t[currentLang];
    const el = (id) => document.getElementById(id);
    
    if(el('header-title')) el('header-title').textContent = lang.title;
    if(el('header-motto')) el('header-motto').textContent = lang.motto;
    if(el('btn-lang-toggle')) el('btn-lang-toggle').textContent = currentLang === 'en' ? 'മലയാളം' : 'English';
    
    if(el('lbl-stat-total')) el('lbl-stat-total').textContent = lang.totalReports;
    if(el('lbl-stat-alerts')) el('lbl-stat-alerts').textContent = lang.confirmedAlerts;
    if(el('lbl-stat-subscribers')) el('lbl-stat-subscribers').textContent = lang.subscribers;
    if(el('lbl-stat-verified')) el('lbl-stat-verified').textContent = lang.lblVerified;
    if(el('lbl-stat-broadcast')) el('lbl-stat-broadcast').textContent = lang.lblBroadcast;
    
    if(el('lbl-focus-title')) el('lbl-focus-title').textContent = lang.tacticalCenter;
    if(el('lbl-feeds-title')) el('lbl-feeds-title').textContent = lang.recentEmergencyFeeds;
    
    if(el('btn-lbl-report')) el('btn-lbl-report').textContent = lang.reportEmergency;
    if(el('btn-lbl-alerts')) el('btn-lbl-alerts').textContent = lang.getAlerts;
    
    if(el('lbl-radio-title')) el('lbl-radio-title').textContent = lang.radioTitle;
    if(el('lbl-radio-desc')) el('lbl-radio-desc').textContent = lang.radioDesc;
    if(el('btn-voice-toggle')) el('btn-voice-toggle').textContent = lang.playRadioBtn;
    
    const wTitle = document.querySelector('#watchlist-items-list').previousElementSibling;
    if(wTitle) wTitle.textContent = lang.watchlistTitle;
    
    if(el('lbl-step-1-title')) el('lbl-step-1-title').textContent = lang.step1;
    if(el('lbl-step-2-title')) el('lbl-step-2-title').textContent = lang.step2;
    if(el('lbl-step-3-title')) el('lbl-step-3-title').textContent = lang.step3;
    if(el('lbl-share-gps')) el('lbl-share-gps').textContent = lang.shareGps;
    if(el('btn-step3-submit')) el('btn-step3-submit').textContent = lang.submitBtn;
}


// --- ON LOAD INITIALIZATION ---
(async function initApp() {
    const cachedQueue = localStorage.getItem('resqlink_offline_queue');
    if (cachedQueue) {
        offlineQueue = JSON.parse(cachedQueue);
    }

    // STALE-WHILE-REVALIDATE: Load instantly from cache
    const cachedData = localStorage.getItem('resqlink_cached_data');
    if (cachedData) {
        try {
            const p = JSON.parse(cachedData);
            if (p.stats) stats = p.stats;
            if (p.feeds) feeds = p.feeds;
            if (p.resources) resources = p.resources;
            if (p.weatherAlerts) weatherAlerts = p.weatherAlerts;
            if (p.reliefCamps) reliefCamps = p.reliefCamps;
            
            initMap();
            renderFeeds(); renderResources(); renderWatchlist(); 
            renderWeatherAlerts(); updateCountersDisplay();
        } catch(e) { initMap(); }
    } else {
        // INSTANT FALLBACK FOR FIRST-TIME VISITORS
        // Masks the Render cold-start delay (60s) by showing generic safe data instantly
        stats = { totalReports: 142, confirmedAlerts: 18, subscribers: 560 };
        weatherAlerts = [{ district: 'Wayanad', level: 'Orange', message: 'Heavy Rainfall Warning' }];
        
        initMap(); 
        renderFeeds(); renderResources(); renderWatchlist(); 
        renderWeatherAlerts(); updateCountersDisplay();
    }
    attachEventHandlers();
    populateDropdowns();
    updateLanguageTexts();
    updateCountersDisplay();

    // Fetch fresh data in the background (waits for Render cold start)
    try {
        const [statsRes, feedsRes, resourcesRes, weatherRes, campsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/stats`),
            fetch(`${API_BASE_URL}/api/reports`),
            fetch(`${API_BASE_URL}/api/resources`),
            fetch(`${API_BASE_URL}/api/weather-alerts`),
            fetch(`${API_BASE_URL}/api/camps`)
        ]);
        
        if (statsRes.ok) stats = await statsRes.json();
        if (feedsRes.ok) feeds = await feedsRes.json();
        if (resourcesRes.ok) resources = await resourcesRes.json();
        if (weatherRes.ok) weatherAlerts = await weatherRes.json();
        if (campsRes.ok) reliefCamps = await campsRes.json();
        
        localStorage.setItem('resqlink_cached_data', JSON.stringify({
            stats, feeds, resources, weatherAlerts, reliefCamps
        }));

        // Silently update UI with fresh data
        renderFeeds();
        renderResources();
        renderWatchlist();
        renderWeatherAlerts();
        updateCountersDisplay();
        plotFeedsOnMap(); // updates map markers
    } catch(e) {
        console.error("Backend offline", e);
    }
})();

function renderWeatherAlerts() {
    const container = document.getElementById('weather-ticker-container');
    const textEl = document.getElementById('weather-ticker-text');
    
    if (weatherAlerts.length > 0) {
        container.classList.remove('hidden');
        let textHTML = '';
        weatherAlerts.forEach(a => {
            const color = a.level === 'Red' ? 'text-brand' : a.level === 'Orange' ? 'text-orange-500' : 'text-yellow-400';
            textHTML += `<span class="mx-4"><span class="${color}">${a.district} (${a.level}):</span> ${a.message}</span>`;
        });
        textEl.innerHTML = textHTML + textHTML; // duplicate for smooth scrolling
    } else {
        container.classList.add('hidden');
    }
}


function populateDropdowns() {
    const coordsSelect = document.getElementById('select-coords-district');
    const subSelect = document.getElementById('select-subscription-district');
    let opts = '<option value="">-- Choose --</option>';
    let subOpts = '';
    districtsData.forEach(d => {
        opts += `<option value="${d.name}">${d.name}</option>`;
        subOpts += `<option value="${d.name}">${d.name}</option>`;
    });
    if(coordsSelect) coordsSelect.innerHTML = opts;
    if(subSelect) subSelect.innerHTML = subOpts;
}

function initMap() {
    // Initialize Leaflet centered on Kerala
    mapInstance = L.map('map-canvas-container', {
        scrollWheelZoom: false, // Disable zoom on normal page scrolling
        dragging: !L.Browser.mobile, // Disable one-finger pan on mobile to allow page scroll
        tap: !L.Browser.mobile // Fix click issues on mobile when dragging disabled
    }).setView([10.8505, 76.2711], 7);
    
    // Enable scroll zoom only after user explicitly interacts/clicks the map
    mapInstance.on('click', () => {
        if (!mapInstance.scrollWheelZoom.enabled()) {
            mapInstance.scrollWheelZoom.enable();
        }
    });
    // Optional: disable it again if they move the mouse away to restore page scrolling
    mapInstance.on('mouseout', () => {
        mapInstance.scrollWheelZoom.disable();
    });
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 18
    }).addTo(mapInstance);

    markerGroup = L.layerGroup().addTo(mapInstance);
    plotFeedsOnMap();
}

function plotFeedsOnMap() {
    if (!markerGroup) return;
    markerGroup.clearLayers();
    
    // Plot districts and color code based on weather alerts
    districtsData.forEach(dist => {
        let alertLevel = null;
        const alert = weatherAlerts.find(a => a.district === dist.name);
        if (alert) alertLevel = alert.level;

        let color = '#2563EB'; // default Blue
        if (alertLevel === 'Red') color = '#EF4444';
        else if (alertLevel === 'Orange') color = '#F97316';
        else if (alertLevel === 'Yellow') color = '#EAB308';

        L.circleMarker([dist.lat, dist.lng], {
            color: color, fillColor: color, fillOpacity: 0.2, radius: 10, weight: 2
        }).addTo(markerGroup).bindTooltip(`<b>${dist.name}</b>${alert ? `<br/>${alert.level} Alert` : ''}`).on('click', () => {
            focusDistrictOnMap(dist.name, dist.lat, dist.lng);
        });
    });

    // Plot Relief Camps
    reliefCamps.forEach(camp => {
        const campIcon = L.divIcon({
            html: '<div class="text-2xl drop-shadow-md cursor-pointer hover:scale-110 transition-transform">⛺</div>',
            className: 'bg-transparent border-none',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        const popupContent = `
            <div class="text-xs">
                <strong class="text-indigo-700 text-sm">${camp.name}</strong><br>
                <span class="text-slate-500">${camp.district}</span><br><br>
                <b>Capacity:</b> ${camp.occupancy} / ${camp.capacity}<br>
                <b>Facilities:</b> ${camp.facilities || 'Basic'}<br>
                <b>Contact:</b> ${camp.contact}
            </div>
        `;
        L.marker([camp.lat, camp.lng], { icon: campIcon }).addTo(markerGroup).bindPopup(popupContent);
    });

    // Plot real reports
    feeds.forEach(feed => {
        let lat = 11.605, lng = 76.088; // fallback
        if (feed.coordinates && feed.coordinates.includes('Lat')) {
            const parts = feed.coordinates.match(/Lat ([\d\.]+), Lng ([\d\.]+)/);
            if (parts) {
                lat = parseFloat(parts[1]);
                lng = parseFloat(parts[2]);
            }
        }
        const icon = feed.status === 'Confirmed' ? redIcon : amberIcon;
        const marker = L.marker([lat, lng], {icon}).addTo(markerGroup);
        marker.bindPopup(`<b>${feed.type}</b><br>${feed.village}, ${feed.district}<br>${feed.status}`);
    });
}

window.focusDistrictOnMap = function(name, lat, lng) {
    selectedDistrict = name;
    document.getElementById('focused-district-name').textContent = name;
    
    if (lat && lng) {
        mapInstance.setView([lat, lng], 10, { animate: true });
    } else {
        const match = districtsData.find(d => d.name === name);
        if (match) mapInstance.setView([match.lat, match.lng], 10, { animate: true });
    }
    renderWatchlist();
};

// Expose navigateTo globally
window.navigateTo = function(screenId) {
    document.getElementById('screen-dashboard').classList.add('hidden');
    document.getElementById('screen-report').classList.add('hidden');
    document.getElementById('screen-alerts').classList.add('hidden');
    document.getElementById('screen-resources').classList.add('hidden');
    document.getElementById('screen-volunteer').classList.add('hidden');
    document.getElementById(screenId).classList.remove('hidden');

    // Update bottom nav active state
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.getAttribute('data-target') === screenId) {
            btn.classList.remove('text-textMuted');
            btn.classList.add('text-primary');
        } else {
            btn.classList.add('text-textMuted');
            btn.classList.remove('text-primary');
        }
    });

    if (screenId === 'screen-dashboard' && mapInstance) {
        setTimeout(() => mapInstance.invalidateSize(), 100);
    }
};

function showToast(message, type = 'info') {
    // Popups completely disabled as requested by user
}

function updateCountersDisplay() {
    document.getElementById('stat-total-val').textContent = stats.totalReports + offlineQueue.length;
    document.getElementById('stat-confirmed-val').textContent = stats.confirmedAlerts;
    document.getElementById('stat-subscribers-val').textContent = stats.subscribers;

    const offlineBadge = document.getElementById('stat-offline-badge');
    if (offlineQueue.length > 0) {
        offlineBadge.classList.remove('hidden');
        offlineBadge.textContent = `(+${offlineQueue.length} queued)`;
    } else {
        offlineBadge.classList.add('hidden');
    }
}

function renderFeeds() {
    const container = document.getElementById('live-feeds-list');
    document.getElementById('lbl-active-count-badge').textContent = `${feeds.length} Active`;
    container.innerHTML = '';
    
    if (feeds.length === 0 && offlineQueue.length === 0) {
        container.innerHTML = `<div class="text-center p-6 text-xs text-textMuted bg-slate-50 rounded-xl border border-borderBlue">No reports posted.</div>`;
        return;
    }

    const combined = [...offlineQueue.map(q => ({ ...q, status: 'Pending Sync'})), ...feeds];
    combined.forEach(feed => {
        const badgeClass = feed.status === 'Pending Sync' ? 'bg-amber-100 text-amber-700 animate-pulse border-amber-200' : 'bg-red-50 text-brand border-red-200';
        
        container.insertAdjacentHTML('beforeend', `
          <div class="bg-white border border-borderBlue rounded-xl p-3 flex gap-3 shadow-sm">
            ${feed.photo ? `<div class="w-16 h-16 rounded-lg overflow-hidden shrink-0"><img src="${feed.photo}" class="w-full h-full object-cover"></div>` : ''}
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-start">
                <span class="font-extrabold text-textMain text-sm">${feed.type}</span>
                <span class="text-[9px] text-textMuted">${feed.timestamp || 'Recent'}</span>
              </div>
              <h4 class="text-xs font-semibold text-slate-700">${feed.village}, ${feed.district}</h4>
              <p class="text-[11px] text-textMuted mt-1 line-clamp-2">${feed.details}</p>
              <div class="mt-2 flex justify-between items-center text-[10px]">
                <span class="px-2 py-0.5 rounded font-bold uppercase border ${badgeClass}">${feed.status}</span>
              </div>
            </div>
          </div>
        `);
    });
    plotFeedsOnMap();
}

function renderWatchlist() {
    const container = document.getElementById('watchlist-items-list');
    if (!container) return;
    container.innerHTML = '';

    districtsData.forEach(dist => {
        const activeCount = feeds.filter(f => f.district === dist.name).length;
        const isSel = selectedDistrict === dist.name;
        
        const alert = weatherAlerts.find(a => a.district === dist.name);
        const alertLevel = alert ? alert.level : 'Green'; 
        
        let alertBg = '';
        let alertBadge = '';
        
        if (alertLevel === 'Red') {
            alertBg = isSel ? 'bg-red-100 border-red-500 text-red-900' : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-800';
            alertBadge = '<span class="text-[10px] text-red-700 font-bold bg-white px-1.5 py-0.5 rounded shadow-sm border border-red-100 animate-pulse">Red Alert</span>';
        } else if (alertLevel === 'Orange') {
            alertBg = isSel ? 'bg-orange-100 border-orange-500 text-orange-900' : 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-800';
            alertBadge = '<span class="text-[10px] text-orange-700 font-bold bg-white px-1.5 py-0.5 rounded shadow-sm border border-orange-100">Orange Alert</span>';
        } else if (alertLevel === 'Yellow') {
            alertBg = isSel ? 'bg-yellow-100 border-yellow-500 text-yellow-900' : 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-800';
            alertBadge = '<span class="text-[10px] text-yellow-700 font-bold bg-white px-1.5 py-0.5 rounded shadow-sm border border-yellow-100">Yellow Alert</span>';
        } else {
            alertBg = isSel ? 'bg-emerald-100 border-emerald-500 text-emerald-900' : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800';
            alertBadge = '<span class="text-[10px] text-emerald-700 font-bold bg-white px-1.5 py-0.5 rounded shadow-sm border border-emerald-100">Green</span>';
        }

        container.insertAdjacentHTML('beforeend', `
          <button class="watchlist-btn w-full p-2.5 rounded-lg flex justify-between items-center text-left transition-all border ${alertBg}" onclick="focusDistrictOnMap('${dist.name}', ${dist.lat}, ${dist.lng})">
            <div class="flex flex-col gap-1">
                <span class="font-bold text-sm">${dist.name}</span>
                <div class="flex items-center gap-1.5">
                    ${alertBadge}
                </div>
            </div>
            ${activeCount > 0 ? `<span class="bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">${activeCount} active</span>` : `<span class="text-[10px] font-semibold text-slate-500 opacity-70">SAFE</span>`}
          </button>
        `);
    });
}

window.fulfillResource = async function(id) {
    if(!confirm('Are you sure you want to mark this request as fulfilled?')) return;
    try {
        const res = await fetch(`${API_BASE_URL}/api/resources/${id}/fulfill`, { method: 'PATCH' });
        if(res.ok) {
            showToast('Request fulfilled successfully!', 'success');
            const updated = await res.json();
            resources = resources.map(r => r._id === id ? updated : r);
            renderResources();
        } else {
            showToast('Failed to fulfill request.', 'warning');
        }
    } catch(e) {
        showToast('Network error', 'warning');
    }
};

function renderResources() {
    const container = document.getElementById('resources-list');
    if(!container) return;
    container.innerHTML = '';
    
    if(resources.length === 0) {
        container.innerHTML = `<div class="text-center p-6 text-xs text-textMuted bg-slate-50 rounded-xl border border-borderBlue">No active requests.</div>`;
        return;
    }
    
    resources.forEach(res => {
        const isFulfilled = res.status === 'Fulfilled';
        const bg = isFulfilled ? 'bg-emerald-50 opacity-70' : 'bg-white';
        const badge = isFulfilled ? '<span class="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Fulfilled</span>' : '<span class="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase animate-pulse">Pending</span>';
        const btn = isFulfilled ? '' : `<button onclick="fulfillResource('${res._id}')" class="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-200 transition-colors">Fulfill</button>`;
        const intentBadge = res.intent === 'Donate' ? '<span class="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Donation</span>' : '<span class="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Need</span>';

        container.insertAdjacentHTML('beforeend', `
          <div class="border border-borderBlue rounded-xl p-3 shadow-sm ${bg}">
            <div class="flex justify-between items-start mb-2">
              <div>
                ${intentBadge}
                <span class="font-extrabold text-textMain text-sm ml-1">${res.type}</span>
                <span class="text-xs font-semibold text-slate-600 ml-2">Qty: ${res.quantity}</span>
              </div>
              ${badge}
            </div>
            <div class="text-xs text-slate-600 space-y-1">
              <p>📍 ${res.location}</p>
              <p>📞 ${res.contact}</p>
              <p class="text-[10px] text-textMuted mt-1">Requested: ${new Date(res.createdAt).toLocaleString()}</p>
            </div>
            <div class="mt-2 flex justify-end">
              ${btn}
            </div>
          </div>
        `);
    });
}

function attachEventHandlers() {
    // Language Toggle
    document.getElementById('btn-lang-toggle').addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'ml' : 'en';
        updateLanguageTexts();
        showToast(currentLang === 'en' ? 'Switched to English' : 'മലയാളത്തിലേക്ക് മാറ്റി', 'success');
    });

    // Audio Forecast Stream
    document.getElementById('btn-voice-toggle').addEventListener('click', () => {
        // INSTANT RADIO PLAYBACK (No GPS or API wait)
        let alertMessage = "";
        if (weatherAlerts && weatherAlerts.length > 0) {
            const worstAlert = weatherAlerts[0];
            const engAlert = `A ${worstAlert.level} alert is active in ${worstAlert.district}. ${worstAlert.message}.`;
            const malAlert = `${worstAlert.district} ജില്ലയിൽ ${worstAlert.level} അലർട്ട് പ്രഖ്യാപിച്ചിട്ടുണ്ട്.`;
            alertMessage = currentLang === 'en' ? engAlert : malAlert;
        } else {
            const engAlert = "Currently, there are no severe weather warnings. Stay alert.";
            const malAlert = "നിലവിൽ ഗുരുതരമായ കാലാവസ്ഥാ മുന്നറിയിപ്പുകളൊന്നുമില്ല. ജാഗ്രത പാലിക്കുക.";
            alertMessage = currentLang === 'en' ? engAlert : malAlert;
        }

        const engIntro = `Welcome to the Resqlink Emergency Broadcast. `;
        const malIntro = `റെസ്‌ക്യുലിങ്ക് അടിയന്തര ബ്രോഡ്കാസ്റ്റിലേക്ക് സ്വാഗതം. `;
        
        const finalMessage = (currentLang === 'en' ? engIntro : malIntro) + alertMessage;
        
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(finalMessage);
            u.lang = currentLang === 'en' ? 'en-US' : 'ml-IN';
            u.rate = 0.9;
            window.speechSynthesis.speak(u);
        }
    });

    // Network Toggle
    document.getElementById('btn-network-toggle').addEventListener('click', () => {
        isOnline = !isOnline;
        const btn = document.getElementById('btn-network-toggle');
        const text = document.getElementById('network-status-text');
        
        if (isOnline) {
            btn.className = "px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200";
            text.textContent = 'Online';
            
            if (offlineQueue.length > 0) {
                setTimeout(async () => {
                    try {
                        const res = await fetch(`${API_BASE_URL}/api/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(offlineQueue) });
                        if (res.ok) {
                            const json = await res.json();
                            feeds = [...json.data, ...feeds];
                            stats.totalReports += offlineQueue.length;
                            stats.confirmedAlerts += offlineQueue.length;
                            offlineQueue = [];
                            localStorage.removeItem('resqlink_offline_queue');
                            updateCountersDisplay(); renderFeeds(); renderWatchlist();
                            showToast('Offline reports synchronized!', 'success');
                        }
                    } catch(e) { showToast('Sync failed', 'warning'); }
                }, 1000);
            } else { showToast('Network Online', 'success'); }
        } else {
            btn.className = "px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 bg-amber-50 text-amber-600 border border-amber-200";
            text.textContent = 'Offline';
            showToast('Device disconnected. Offline mode active.', 'warning');
        }
    });

    // Report Wizard Logic
    function updateWizard() {
        [1,2,3].forEach(i => {
            document.getElementById(`report-step-${i}`).classList.add('hidden');
            const ind = document.getElementById(`step-indicator-${i}`);
            const line = document.getElementById(`step-line-${i}`);
            if(reportStep === i) {
                ind.className = "w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs bg-primary text-white ring-4 ring-blue-100";
            } else if (reportStep > i) {
                ind.className = "w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs bg-emerald-500 text-white";
                ind.textContent = "✓";
            } else {
                ind.className = "w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs bg-slate-100 text-textMuted border border-slate-300";
                ind.textContent = i;
            }
            if(line) line.className = `flex-1 h-1 mx-2 transition-colors ${reportStep > i ? 'bg-emerald-500' : 'bg-slate-200'}`;
        });
        document.getElementById(`report-step-${reportStep}`).classList.remove('hidden');
    }

    document.querySelectorAll('.incident-card-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentReportType = btn.getAttribute('data-value');
            document.querySelectorAll('.incident-card-btn').forEach(b => {
                b.className = "incident-card-btn p-3 rounded-xl border border-borderBlue bg-slate-50 text-left flex flex-col justify-between h-28 transition-all";
            });
            btn.className = "incident-card-btn p-3 rounded-xl border-2 border-primary bg-blue-50 text-left flex flex-col justify-between h-28 transition-all shadow-sm";
        });
    });

    document.getElementById('btn-step1-next').addEventListener('click', () => {
        if(!currentReportType) return showToast("Select incident type", "warning");
        reportStep = 2; updateWizard();
    });
    document.getElementById('btn-step2-back').addEventListener('click', () => { reportStep = 1; updateWizard(); });
    document.getElementById('btn-step2-next').addEventListener('click', () => { reportStep = 3; updateWizard(); });
    document.getElementById('btn-step3-back').addEventListener('click', () => { reportStep = 2; updateWizard(); });

    document.getElementById('btn-trigger-gps').addEventListener('click', () => {
        if (!navigator.geolocation) {
            return showToast("Geolocation not supported by browser", "error");
        }
        
        const btn = document.getElementById('btn-trigger-gps');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="animate-pulse">📍 Locating Device...</span>';
        
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            document.getElementById('input-coords').value = `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`;
            
            // Find closest district using simple distance calculation
            let closestDist = null;
            let minD = Infinity;
            districtsData.forEach(d => {
                const dist = Math.sqrt(Math.pow(d.lat - latitude, 2) + Math.pow(d.lng - longitude, 2));
                if (dist < minD) { minD = dist; closestDist = d; }
            });
            
            if (closestDist) {
                document.getElementById('select-coords-district').value = closestDist.name;
            }
            
            // Try reverse geocoding for exact village/town if online
            if (isOnline) {
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await res.json();
                    if (data && data.address) {
                        const area = data.address.village || data.address.town || data.address.city || data.address.suburb || data.address.county || "Local Area";
                        document.getElementById('input-coords-village').value = area;
                    } else {
                        document.getElementById('input-coords-village').value = "Acquired via GPS";
                    }
                } catch(e) {
                    document.getElementById('input-coords-village').value = "Acquired via GPS";
                }
            } else {
                document.getElementById('input-coords-village').value = "Acquired Offline (GPS)";
            }
            
            btn.innerHTML = originalText;
            showToast("Exact GPS Location Acquired!", "success");
            
        }, (error) => {
            btn.innerHTML = originalText;
            showToast("Failed to get location: " + error.message, "error");
        }, { timeout: 2000, maximumAge: Infinity, enableHighAccuracy: false });
    });

    let mediaStream = null;

    // Open WebRTC Camera
    document.getElementById('upload-prompt-view').addEventListener('click', async () => {
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            const video = document.getElementById('camera-video-stream');
            video.srcObject = mediaStream;
            
            document.getElementById('upload-prompt-view').classList.add('hidden');
            document.getElementById('live-camera-view').classList.remove('hidden');
        } catch (err) {
            showToast("Camera access denied or unavailable on this device", "error");
        }
    });

    // Snap Photo
    document.getElementById('btn-capture-photo').addEventListener('click', () => {
        const video = document.getElementById('camera-video-stream');
        const canvas = document.getElementById('camera-canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        attachedPhotoUrl = canvas.toDataURL('image/jpeg', 0.8);
        document.getElementById('attached-preview-img').src = attachedPhotoUrl;
        
        // Turn off camera light
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
        
        document.getElementById('live-camera-view').classList.add('hidden');
        document.getElementById('upload-preview-view').classList.remove('hidden');
    });

    // Remove photo
    document.getElementById('btn-remove-photo').addEventListener('click', (e) => {
        e.stopPropagation();
        attachedPhotoUrl = '';
        document.getElementById('upload-preview-view').classList.add('hidden');
        document.getElementById('upload-prompt-view').classList.remove('hidden');
    });

    document.getElementById('btn-step3-submit').addEventListener('click', async () => {
        const rep = {
            id: 'rep-' + Date.now(),
            type: currentReportType,
            district: document.getElementById('select-coords-district').value || 'Unknown',
            village: document.getElementById('input-coords-village').value || 'Unknown',
            coordinates: document.getElementById('input-coords').value || 'Unknown',
            details: document.getElementById('textarea-details').value || 'Reported from mobile app.',
            photo: attachedPhotoUrl,
            status: isOnline ? 'Confirmed' : 'Pending Sync',
            timestamp: 'Just now'
        };

        if (isOnline) {
            try {
                const res = await fetch(`${API_BASE_URL}/api/reports`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(rep) });
                if(res.ok) {
                    const data = await res.json();
                    rep.id = data.data._id;
                }
            } catch(e) { console.error(e); }
            feeds = [rep, ...feeds];
            stats.totalReports++; stats.confirmedAlerts++;
            showToast("Report submitted!", "success");
        } else {
            offlineQueue.push(rep);
            localStorage.setItem('resqlink_offline_queue', JSON.stringify(offlineQueue));
            showToast("Report cached offline.", "warning");
        }

        // Reset
        currentReportType = ''; attachedPhotoUrl = '';
        document.querySelectorAll('input, select, textarea').forEach(i => i.value = '');
        document.getElementById('upload-preview-view').classList.add('hidden');
        document.getElementById('upload-prompt-view').classList.remove('hidden');
        reportStep = 1; updateWizard();
        updateCountersDisplay(); renderFeeds(); renderWatchlist();
        window.navigateTo('screen-dashboard');
    });

    // Subscribe Form
    document.getElementById('alerts-subscription-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>⏳</span> Requesting Permission...';
        
        try {
            if (!messaging) throw new Error('Firebase missing configuration.');
            
            // Request permission and get token
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                throw new Error('Notification permission denied.');
            }

            const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
            if (!vapidKey) throw new Error('VAPID key is missing in .env');

            const fcmToken = await getToken(messaging, { vapidKey });
            if (!fcmToken) throw new Error('Could not generate push token.');

            const district = document.getElementById('select-subscription-district').value;
            const phone = document.getElementById('input-subscription-phone').value;
            const res = await fetch(`${API_BASE_URL}/api/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fcmToken, phone, district })
            });
            
            const data = await res.json();
            if (res.ok) {
                showToast('Push Alerts Enabled!', 'success');
                btn.innerHTML = '<span>✅</span> Subscribed';
                btn.classList.replace('bg-primary', 'bg-emerald-500');
                btn.classList.replace('hover:bg-blue-700', 'hover:bg-emerald-600');
                btn.disabled = true;
            } else {
                showToast(data.error || 'Failed to subscribe', 'warning');
                btn.innerHTML = originalText;
            }
        } catch (error) {
            showToast(error.message, 'warning');
            btn.innerHTML = originalText;
        }
    });

    // Resource Form Submit
    const resourceForm = document.getElementById('resource-request-form');
    if (resourceForm) {
        resourceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const intent = document.getElementById('res-intent').value;
            const type = document.getElementById('res-type').value;
            const quantity = document.getElementById('res-quantity').value;
            const location = document.getElementById('res-location').value;
            const contact = document.getElementById('res-contact').value;

            try {
                const res = await fetch(`${API_BASE_URL}/api/resources`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ intent, type, quantity, location, contact })
                });
                if(res.ok) {
                    const newRes = await res.json();
                    resources.unshift(newRes);
                    renderResources();
                    showToast('Resource request submitted!', 'success');
                    e.target.reset();
                } else {
                    showToast('Failed to submit request.', 'warning');
                }
            } catch(err) {
                showToast('Network error', 'warning');
            }
        });
    }

    // Volunteer Form Submit
    const volForm = document.getElementById('volunteer-registration-form');
    if (volForm) {
        volForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('vol-name').value;
            const phone = document.getElementById('vol-phone').value;
            const district = document.getElementById('vol-district').value;
            const skills = document.getElementById('vol-skills').value;
            const equipment = document.getElementById('vol-equipment').value;

            try {
                const res = await fetch(`${API_BASE_URL}/api/volunteers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, phone, district, skills, equipment })
                });
                if(res.ok) {
                    showToast('Volunteer registered successfully! Thank you.', 'success');
                    e.target.reset();
                    window.navigateTo('screen-dashboard');
                } else {
                    showToast('Failed to register.', 'warning');
                }
            } catch(err) {
                showToast('Network error', 'warning');
            }
        });
    }

    // Socket.io for SOS Chat
    let socket;
    try {
        socket = io();
        socket.on('sos-message', (data) => {
            const history = document.getElementById('sos-chat-history');
            if(!history) return;
            const align = data.role === 'Admin' ? 'items-start' : 'items-end';
            const bg = data.role === 'Admin' ? 'bg-slate-200 text-slate-800' : 'bg-brand text-white';
            
            history.insertAdjacentHTML('beforeend', `
                <div class="flex flex-col ${align} mb-2">
                    <span class="text-[9px] font-bold text-slate-400 mb-0.5">${data.role} - ${new Date(data.timestamp).toLocaleTimeString()}</span>
                    <div class="px-3 py-2 rounded-xl text-sm ${bg} max-w-[85%] shadow-sm">
                        ${data.message}
                    </div>
                </div>
            `);
            history.scrollTop = history.scrollHeight;
        });
    } catch(e) { console.log('Socket.io not loaded on client'); }

    // Chat Modal Toggle & Socket Connection
    let sosSocket = null;
    const sosModal = document.getElementById('sos-chat-modal');
    const sosHistory = document.getElementById('sos-chat-history');
    
    if(document.getElementById('btn-open-sos')) {
        document.getElementById('btn-open-sos').addEventListener('click', () => {
            sosModal.classList.remove('hidden');
            
            // Connect socket if not already connected
            if (!sosSocket) {
                const backendUrl = window.location.hostname === 'localhost' 
                    ? 'http://localhost:5000' 
                    : 'https://resqlink-backend-apyp.onrender.com';
                sosSocket = io(backendUrl);
                
                sosSocket.on('connect', () => {
                    console.log("Connected to SOS Room");
                });
                
                sosSocket.on('sos-message', (data) => {
                    const isSelf = data.role === 'User';
                    const isBot = data.role === 'Bot';
                    
                    let bgClass = 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm';
                    if (isSelf) bgClass = 'bg-brand text-white rounded-br-none';
                    if (isBot) bgClass = 'bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-bl-none shadow-sm';
                    
                    const locBadge = data.location && isSelf ? `<div class="text-[9px] bg-black/20 rounded px-1.5 py-0.5 inline-block mt-1">📍 ${data.location}</div>` : '';

                    const msgEl = document.createElement('div');
                    msgEl.className = `flex flex-col ${isSelf ? 'items-end' : 'items-start'}`;
                    msgEl.innerHTML = `
                        <div class="max-w-[85%] rounded-2xl px-4 py-2 text-sm ${bgClass}">
                            <div class="text-[10px] font-bold opacity-75 mb-0.5 flex items-center gap-1">
                                ${isBot ? '🤖' : ''} ${data.sender}
                            </div>
                            <div>${data.message}</div>
                            ${locBadge}
                        </div>
                        <div class="text-[9px] text-slate-400 mt-1">${new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    `;
                    sosHistory.appendChild(msgEl);
                    sosHistory.scrollTop = sosHistory.scrollHeight;
                });
            }
        });
        document.getElementById('btn-close-sos').addEventListener('click', () => sosModal.classList.add('hidden'));
    }

    // Chat Form Submit
    const sosForm = document.getElementById('sos-chat-form');
    if (sosForm) {
        sosForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('sos-chat-input');
            if(!input.value.trim() || !sosSocket) return;
            
            const rawMessage = input.value.trim();
            input.value = '';
            
            const fetchLocationAndEmit = () => {
                navigator.geolocation.getCurrentPosition((pos) => {
                    const loc = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
                    sosSocket.emit('sos-message', { sender: 'Victim in Distress', role: 'User', message: rawMessage, location: loc });
                }, (err) => { 
                    let errMsg = 'Location Denied'; 
                    if(err.code === 3) errMsg = 'Location Timeout (Took too long)'; 
                    if(err.code === 2) errMsg = 'Location Unavailable (No GPS signal)'; 
                    if(err.code === 1) alert("⚠️ Location access is blocked. Accurate rescue dispatch requires your live location. Please enable location access in your browser settings for this site.");
                    sosSocket.emit('sos-message', { sender: 'Victim in Distress', role: 'User', message: rawMessage, location: errMsg }); 
                }, { timeout: 5000, maximumAge: Infinity, enableHighAccuracy: false });
            };

            if (navigator.geolocation) {
                if (navigator.permissions && navigator.permissions.query) {
                    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
                        if (result.state === 'prompt') {
                            alert("⚠️ To dispatch rescue teams accurately, we need your live location. Please select 'Allow' on the next prompt.");
                        } else if (result.state === 'denied') {
                            alert("⚠️ Location access is blocked. Accurate rescue dispatch requires your live location. Please enable location access in your browser settings for this site.");
                        }
                        fetchLocationAndEmit();
                    }).catch(() => fetchLocationAndEmit());
                } else {
                    fetchLocationAndEmit();
                }
            } else {
                sosSocket.emit('sos-message', { sender: 'Victim in Distress', role: 'User', message: rawMessage, location: 'Location Unsupported' });
            }
        });
    }
    // Modals
    document.getElementById('btn-info-modal').addEventListener('click', () => document.getElementById('info-modal-backdrop').classList.remove('hidden'));
    document.getElementById('btn-close-modal').addEventListener('click', () => document.getElementById('info-modal-backdrop').classList.add('hidden'));
}

// Mobile Bottom Navigation logic
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        if (target && window.navigateTo) window.navigateTo(target);
    });
});
