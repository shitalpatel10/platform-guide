// --- Global State ---
let currentStationId = null;
let platformsData = [];
let selectedPlatformId = null;
let editedPlatformLayer = null;
let platformsFeatureGroup = null;

let pServiceMarkers = [];
let currentServicesData = [];
let currentPlacementServiceType = null;

let osmServicesGroup = null;
let fetchedOSMElements = [];

const PLATFORM_SERVICES = {
    'washroom': { name: 'Washroom', icon: 'fa-restroom', color: 'text-blue-500', bg: 'bg-blue-100' },
    'water_cooler': { name: 'Water Cooler', icon: 'fa-glass-water', color: 'text-cyan-500', bg: 'bg-cyan-100' },
    'grocery': { name: 'Grocery / Shop', icon: 'fa-store', color: 'text-green-500', bg: 'bg-green-100' },
    'tea_coffee': { name: 'Tea / Coffee Stall', icon: 'fa-mug-hot', color: 'text-orange-500', bg: 'bg-orange-100' },
    'waiting_area': { name: 'Waiting Area', icon: 'fa-chair', color: 'text-indigo-500', bg: 'bg-indigo-100' },
    'charging_point': { name: 'Charging Point', icon: 'fa-plug', color: 'text-yellow-500', bg: 'bg-yellow-100' },
    'ticket': { name: 'Ticket Counter', icon: 'fa-ticket', color: 'text-pink-500', bg: 'bg-pink-100' },
    'info': { name: 'Information Desk', icon: 'fa-circle-info', color: 'text-sky-500', bg: 'bg-sky-100' }
};

// --- Page Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentStationId = urlParams.get('id');

    if (!currentStationId) {
        alert("No station ID provided!");
        window.location.href = 'index.html';
        return;
    }

    const station = Storage.getStationById(currentStationId);
    if (!station) {
        alert("Station not found!");
        window.location.href = 'index.html';
        return;
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') if (editedPlatformLayer || selectedPlatformId) clearPlatformEditingState();
    });

    document.getElementById('header-station-name').innerText = station.name;
    document.getElementById('header-station-code').innerText = station.code;

    const managePlatformsLink = document.getElementById('manage-platforms-link');
    if (managePlatformsLink) managePlatformsLink.href = 'platform.html?id=' + currentStationId;

    map = L.map('map', { zoomControl: false, maxZoom: 24 }).setView([station.lat, station.lng], station.zoom || 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 24, maxNativeZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
        maxZoom: 24, maxNativeZoom: 19, attribution: 'Map data: &copy; OpenStreetMap | Map style: &copy; OpenRailwayMap'
    }).addTo(map);

    if (station.geojson) {
        const stationFG = new L.FeatureGroup().addTo(map);
        L.geoJSON(station.geojson, {
            style: { color: '#2563EB', fillOpacity: 0.1, weight: 2, dashArray: '5, 5' },
            interactive: false
        }).addTo(stationFG);
        map.fitBounds(stationFG.getBounds());
    }

    platformsData = Storage.getPlatformsByStationId(currentStationId);
    platformsFeatureGroup = new L.FeatureGroup().addTo(map);

    if (platformsData.length > 0) {
        renderAllStaticPlatforms();
        map.fitBounds(platformsFeatureGroup.getBounds());
    }

    renderSidebar();
    setTimeout(fetchOSMServices, 600);

    map.on('click', (e) => {
        if (currentPlacementServiceType) {
            currentServicesData.push({ type: currentPlacementServiceType, lat: e.latlng.lat, lng: e.latlng.lng });
            currentPlacementServiceType = null;
            renderServiceMarkers();
            renderSidebar();
        }
    });
});

// --- Map Rendering ---

function renderAllStaticPlatforms() {
    platformsFeatureGroup.clearLayers();
    platformsData.forEach(p => {
        if (p.id === selectedPlatformId) return;
        if (p.geojson) {
            const layer = L.geoJSON(p.geojson, {
                style: { color: '#6B7280', weight: 2, fillOpacity: 0.4 }
            }).bindTooltip(p.name, { permanent: true, direction: 'center', className: 'font-bold text-gray-700 bg-white/80 border-none shadow-sm rounded px-1 py-0.5 text-xs' });
            layer.on('click', (e) => { L.DomEvent.stopPropagation(e); selectPlatform(p.id); });
            layer.on('mouseover', function () { this.setStyle({ fillOpacity: 0.6, color: '#8B5CF6' }); this.bringToFront(); });
            layer.on('mouseout', function () { this.setStyle({ fillOpacity: 0.4, color: '#6B7280' }); });
            platformsFeatureGroup.addLayer(layer);
        }
        if (p.services) {
            p.services.forEach(srv => {
                const sType = PLATFORM_SERVICES[srv.type];
                if (sType) {
                    L.marker([srv.lat, srv.lng], {
                        interactive: false,
                        icon: L.divIcon({
                            className: 'static-service-marker',
                            html: `<div class="w-5 h-5 ${sType.bg} ${sType.color} rounded-full border border-white shadow-sm flex items-center justify-center text-[10px] opacity-80"><i class="fa-solid ${sType.icon}"></i></div>`,
                            iconSize: [20, 20], iconAnchor: [10, 10]
                        })
                    }).addTo(platformsFeatureGroup);
                }
            });
        }
    });
}

function renderSidebar() {
    const sidebarTitle = document.getElementById('sidebar-title');
    const sidebarContent = document.getElementById('sidebar-content');

    if (selectedPlatformId || editedPlatformLayer) {
        sidebarTitle.innerHTML = `<i class="fa-solid fa-layer-group text-purple-600 mr-2"></i> Services`;
        const platform = platformsData.find(p => p.id === selectedPlatformId);
        const name = platform ? platform.name : "Platform Services";

        let currentServicesHTML = currentServicesData.length === 0 ? '<p class="text-xs text-gray-500">No services added yet.</p>' : currentServicesData.map((srv, idx) => {
            const sType = PLATFORM_SERVICES[srv.type];
            return `<div class="flex justify-between items-center bg-white p-2 border border-gray-200 rounded-lg shadow-sm"><div class="flex items-center space-x-2"><div class="w-6 h-6 ${sType.bg} ${sType.color} rounded-full flex justify-center items-center text-[10px]"><i class="fa-solid ${sType.icon}"></i></div><span class="text-xs font-semibold text-gray-700">${sType.name}</span></div><button onclick="deleteService(${idx})" class="text-red-400 hover:text-red-600 p-1 transition-colors"><i class="fa-solid fa-trash-can text-sm"></i></button></div>`;
        }).join('');

        sidebarContent.innerHTML = `<div class="bg-purple-50 rounded-xl p-4 border border-purple-100"><div class="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1">Editing Platform</div><h3 class="text-lg font-bold text-purple-900 truncate">${name}</h3></div><div class="mt-4 space-y-3 bg-gray-50 p-3 rounded-xl border border-gray-100"><p class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Add Services</p>${currentPlacementServiceType ? `<div class="bg-blue-50 border border-blue-200 text-blue-700 text-xs p-2 rounded flex items-center justify-between shadow-sm"><span>Click on map to place <b>${PLATFORM_SERVICES[currentPlacementServiceType].name}</b></span><button onclick="cancelPlacement()" class="text-blue-500 hover:text-blue-800"><i class="fa-solid fa-xmark"></i></button></div>` : `<div class="grid grid-cols-4 gap-2">${Object.keys(PLATFORM_SERVICES).map(key => `<button onclick="startPlacingService('${key}')" title="${PLATFORM_SERVICES[key].name}" class="h-10 border border-gray-200 bg-white rounded-lg flex items-center justify-center hover:bg-purple-50 hover:text-purple-600 hover:border-purple-300 transition-colors shadow-sm text-gray-500"><i class="fa-solid ${PLATFORM_SERVICES[key].icon}"></i></button>`).join('')}</div>`}</div><div class="mt-4 space-y-3 bg-gray-50 p-3 rounded-xl border border-gray-100"><p class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Current Services</p>${currentServicesHTML}</div><div class="mt-4 space-y-3 bg-gray-50 p-3 rounded-xl border border-gray-100"><p class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Quick Actions</p><button onclick="recenterToPlatform()" class="w-full text-left px-3 py-2 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-gray-700 font-medium text-sm rounded-lg transition-colors border border-gray-200 shadow-sm"><i class="fa-solid fa-crosshairs mr-2 text-blue-500"></i> Recenter</button><button onclick="saveServices()" class="w-full text-left px-3 py-2 bg-white hover:bg-green-50 hover:text-green-700 hover:border-green-200 text-green-600 font-medium text-sm rounded-lg transition-colors border border-gray-200 shadow-sm"><i class="fa-solid fa-check mr-2 text-green-500"></i> Save Services</button><button onclick="clearPlatformEditingState()" class="w-full text-left px-3 py-2 bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-900 border border-gray-200 font-medium text-sm rounded-lg transition-colors shadow-sm"><i class="fa-solid fa-arrow-left mr-2"></i> Back</button></div>`;
    } else {
        sidebarTitle.innerHTML = `<i class="fa-solid fa-list-ul text-purple-600 mr-2"></i> All Platforms`;
        if (platformsData.length === 0) {
            sidebarContent.innerHTML = `<div class="text-center py-10 px-4"><div class="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3"><i class="fa-solid fa-layer-group text-xl"></i></div><p class="text-sm text-gray-500 font-medium">No platforms found</p></div>`;
        } else {
            let html = '';
            platformsData.forEach(p => {
                html += `<div onclick="selectPlatform('${p.id}')" class="group bg-white border border-gray-200 hover:border-purple-300 rounded-xl p-3 cursor-pointer transition-all shadow-sm hover:shadow-md flex items-center justify-between"><div class="flex items-center space-x-3 overflow-hidden"><div class="w-8 h-8 rounded bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-110 group-hover:bg-purple-100 transition-all flex-shrink-0"><i class="fa-solid fa-train"></i></div><div class="truncate"><p class="font-bold text-sm text-gray-800 group-hover:text-purple-700 transition-colors truncate">${p.name}</p></div></div><i class="fa-solid fa-chevron-right text-gray-300 group-hover:text-purple-400 text-xs transition-colors"></i></div>`;
            });
            sidebarContent.innerHTML = html;
        }
    }
}

// --- Interaction Actions ---

function selectPlatform(platformId) {
    if (editedPlatformLayer) {
        if(!confirm("Discard unsaved changes?")) return;
        clearPlatformEditingState();
    }
    selectedPlatformId = platformId;
    const platform = platformsData.find(p => p.id === platformId);
    if (!platform) return;

    renderAllStaticPlatforms();
    const staticLayer = L.geoJSON(platform.geojson);
    const latlngs = staticLayer.getLayers()[0].getLatLngs();
    currentServicesData = platform.services ? JSON.parse(JSON.stringify(platform.services)) : [];

    editedPlatformLayer = L.polygon(latlngs, { color: 'purple', weight: 3, fillOpacity: 0.1, interactive: false }).addTo(map);
    renderServiceMarkers();
    renderSidebar();
    renderOSMServices();
}

function clearPlatformEditingState() {
    if (editedPlatformLayer) { map.removeLayer(editedPlatformLayer); editedPlatformLayer = null; }
    pServiceMarkers.forEach(m => map.removeLayer(m));
    pServiceMarkers = [];
    currentServicesData = []; currentPlacementServiceType = null; selectedPlatformId = null;
    renderAllStaticPlatforms(); renderSidebar(); renderOSMServices();
}

function startPlacingService(type) { currentPlacementServiceType = type; renderSidebar(); }
function cancelPlacement() { currentPlacementServiceType = null; renderSidebar(); }

function renderServiceMarkers() {
    pServiceMarkers.forEach(m => map.removeLayer(m));
    pServiceMarkers = [];
    if (!editedPlatformLayer) return;
    currentServicesData.forEach((srv, index) => {
        const sType = PLATFORM_SERVICES[srv.type];
        if(!sType) return;
        const marker = L.marker([srv.lat, srv.lng], {
            draggable: true,
            icon: L.divIcon({
                className: 'service-marker',
                html: `<div class="w-7 h-7 ${sType.bg} ${sType.color} rounded-full border-2 border-white shadow-md flex items-center justify-center text-[12px] group relative"><i class="fa-solid ${sType.icon}"></i><div class="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full flex flex-col items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 cursor-pointer shadow"><i class="fa-solid fa-xmark"></i></div></div>`,
                iconSize: [28, 28], iconAnchor: [14, 14]
            })
        }).addTo(map);

        marker.on('dragend', (e) => { const pos = e.target.getLatLng(); srv.lat = pos.lat; srv.lng = pos.lng; });
        marker.on('dblclick', (e) => { L.DomEvent.stopPropagation(e); currentServicesData.splice(index, 1); renderServiceMarkers(); renderSidebar(); });
        pServiceMarkers.push(marker);
    });
}

function deleteService(index) { currentServicesData.splice(index, 1); renderServiceMarkers(); renderSidebar(); }
function saveServices() {
    if (!selectedPlatformId) return;
    const idx = platformsData.findIndex(p => p.id === selectedPlatformId);
    if(idx !== -1) { platformsData[idx].services = currentServicesData; Storage.savePlatforms(platformsData); showToast("Services saved!"); clearPlatformEditingState(); }
}

// --- OSM Logic ---

async function fetchOSMServices() {
    if (!map) return;
    const b = map.getBounds();
    const s = b.getSouth()-0.002, w = b.getWest()-0.002, n = b.getNorth()+0.002, e = b.getEast()+0.002;
    const query = `[out:json];(node["amenity"="toilets"](${s},${w},${n},${e});node["amenity"="drinking_water"](${s},${w},${n},${e});node["shop"="convenience"](${s},${w},${n},${e});node["amenity"="charging_station"](${s},${w},${n},${e}););out body;`;
    try {
        const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query });
        const data = await res.json();
        fetchedOSMElements = data.elements || [];
        renderOSMServices();
    } catch(err) { console.error(err); }
}

function renderOSMServices() {
    if (osmServicesGroup) map.removeLayer(osmServicesGroup);
    osmServicesGroup = new L.FeatureGroup().addTo(map);
    fetchedOSMElements.forEach(el => {
        const pt = [el.lat, el.lon];
        let inside = false;
        if (editedPlatformLayer) inside = isPointInPolygon(pt, editedPlatformLayer.getLatLngs()[0]);
        else { for (let p of platformsData) { if (p.geojson && isPointInPolygon(pt, p.geojson.geometry.coordinates[0].map(c => ({lat:c[1], lng:c[0]})))) { inside = true; break; } } }
        if (inside) {
            let icon = 'ℹ️', name = 'Service';
            if (el.tags.amenity === 'toilets') icon = '🚻';
            else if (el.tags.amenity === 'drinking_water') icon = '💧';
            else if (el.tags.shop === 'convenience') icon = '🛒';
            else if (el.tags.amenity === 'charging_station') icon = '🔌';
            L.marker(pt, { icon: L.divIcon({ className: 'osm-service-marker', html: `<div class="w-6 h-6 bg-white rounded-full border border-blue-400 shadow-md flex items-center justify-center text-[12px] hover:scale-110 transition-transform cursor-pointer">${icon}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }) }).bindPopup(name).addTo(osmServicesGroup);
        }
    });
}

function isPointInPolygon(pt, vs) {
    let x = pt[0], y = pt[1], inside = false;
    for (let i = 0, j = vs.length-1; i < vs.length; j = i++) {
        let xi = vs[i].lat, yi = vs[i].lng, xj = vs[j].lat, yj = vs[j].lng;
        if (((yi > y) != (yj > y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)) inside = !inside;
    }
    return inside;
}

// --- UI Helpers ---

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-5 right-5 ${isError ? 'bg-red-600' : 'bg-green-600'} text-white px-6 py-3 rounded-lg shadow-lg z-[4000] transition-all transform translate-y-10 opacity-0 text-sm font-medium`;
    toast.innerHTML = `<i class="fa-solid ${isError ? 'fa-triangle-exclamation' : 'fa-check'} mr-2"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 50);
    setTimeout(() => { toast.classList.add('translate-y-10', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function recenterMap() {
    const s = Storage.getStationById(currentStationId);
    if (!s) return;
    if (platformsData.length > 0 && platformsFeatureGroup.getBounds().isValid()) map.fitBounds(platformsFeatureGroup.getBounds(), { padding: [50, 50], duration: 1.5 });
    else map.flyTo([s.lat, s.lng], s.zoom || 15, { duration: 1.5 });
}

function recenterToPlatform() {
    if (editedPlatformLayer) map.fitBounds(editedPlatformLayer.getBounds(), { padding: [100, 100], duration: 1.5 });
}
