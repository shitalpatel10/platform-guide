let currentStationId = null;
let platformsData = [];
let platformsFeatureGroup = null;

let pServiceMarkers = [];
let currentServicesData = []; // Now station-wide services
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

    // Load station-wide services
    currentServicesData = Storage.getServicesByStationId(currentStationId);
    
    // Migration: If no global services but platforms have them, migrate
    if (currentServicesData.length === 0 && platformsData.some(p => p.services && p.services.length > 0)) {
        console.log("Migrating platform services to global station services...");
        platformsData.forEach(p => {
            if (p.services) {
                p.services.forEach(srv => {
                    currentServicesData.push({
                        ...srv,
                        stationId: currentStationId,
                        platformId: p.id,
                        id: 'srv_' + Date.now() + Math.random().toString(36).substr(2, 9)
                    });
                });
                delete p.services;
            }
        });
        Storage.savePlatforms(Storage.getPlatforms().map(p => {
            const match = platformsData.find(pd => pd.id === p.id);
            return match || p;
        }));
        Storage.saveServices([...Storage.getServices(), ...currentServicesData]);
    }

    renderServiceMarkers();
    renderSidebar();
    setTimeout(fetchOSMServices, 600);

    map.on('click', (e) => {
        if (currentPlacementServiceType) {
            // Auto-detect platform
            let detectedPlatformId = null;
            for (const p of platformsData) {
                if (p.geojson && GeoFilter.isPointInPolygon(e.latlng, p.geojson.geometry.coordinates[0])) {
                    detectedPlatformId = p.id;
                    break;
                }
            }

            const newService = {
                id: 'srv_' + Date.now(),
                stationId: currentStationId,
                platformId: detectedPlatformId,
                type: currentPlacementServiceType,
                lat: e.latlng.lat,
                lng: e.latlng.lng
            };

            currentServicesData.push(newService);
            currentPlacementServiceType = null;
            renderServiceMarkers();
            renderSidebar();
            showToast(detectedPlatformId ? `Service placed on Platform` : `Service placed on Ground`);
        }
    });
});

// --- Map Rendering ---

function renderAllStaticPlatforms() {
    platformsFeatureGroup.clearLayers();
    platformsData.forEach(p => {
        if (p.geojson) {
            const layer = L.geoJSON(p.geojson, {
                style: { color: '#6B7280', weight: 2, fillOpacity: 0.15 }
            }).bindTooltip(p.name, { 
                permanent: true, 
                direction: 'center', 
                className: 'font-bold text-gray-400 bg-transparent border-none shadow-none pointer-events-none text-[10px] uppercase tracking-wider' 
            });
            platformsFeatureGroup.addLayer(layer);
        }
    });
}

function renderSidebar() {
    const sidebarTitle = document.getElementById('sidebar-title');
    const sidebarContent = document.getElementById('sidebar-content');

    sidebarTitle.innerHTML = `<i class="fa-solid fa-location-dot text-indigo-600 mr-2"></i> Station Services`;

    let servicesHTML = '';
    if (currentServicesData.length === 0) {
        servicesHTML = '<div class="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200"><p class="text-xs text-gray-400">No services added yet.</p></div>';
    } else {
        servicesHTML = `<div class="space-y-2">` + currentServicesData.map((srv, idx) => {
            const sType = PLATFORM_SERVICES[srv.type];
            const platform = platformsData.find(p => p.id === srv.platformId);
            const locationName = platform ? platform.name : "On Ground";
            
            return `
                <div class="flex flex-col bg-white p-3 border border-gray-100 rounded-xl shadow-sm hover:border-indigo-200 transition-all group">
                    <div class="flex justify-between items-start">
                        <div class="flex items-center space-x-3">
                            <div class="w-8 h-8 ${sType.bg} ${sType.color} rounded-lg flex justify-center items-center text-xs shadow-inner">
                                <i class="fa-solid ${sType.icon}"></i>
                            </div>
                            <div>
                                <p class="text-xs font-bold text-gray-800">${sType.name}</p>
                                <p class="text-[10px] text-gray-400 font-medium flex items-center">
                                    <i class="fa-solid ${platform ? 'fa-layer-group text-orange-400' : 'fa-earth-asia text-green-400'} mr-1"></i> ${locationName}
                                </p>
                            </div>
                        </div>
                        <button onclick="deleteService(${idx})" class="text-gray-300 hover:text-red-500 p-1.5 transition-colors">
                            <i class="fa-solid fa-trash-can text-sm"></i>
                        </button>
                    </div>
                </div>`;
        }).join('') + `</div>`;
    }

    sidebarContent.innerHTML = `
        <div class="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50 mb-6">
            <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Service Placement</p>
            <h3 class="text-sm font-bold text-indigo-900 mb-3 leading-tight">Add facilities to your station map</h3>
            
            ${currentPlacementServiceType ? `
                <div class="bg-indigo-600 text-white p-3 rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-between animate-pulse">
                    <div class="flex items-center space-x-2">
                        <i class="fa-solid fa-location-crosshairs"></i>
                        <span class="text-xs font-bold">CLICK ON MAP TO PLACE</span>
                    </div>
                    <button onclick="cancelPlacement()" class="bg-white/20 hover:bg-white/30 p-1 rounded-lg">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            ` : `
                <div class="grid grid-cols-4 gap-2">
                    ${Object.keys(PLATFORM_SERVICES).map(key => `
                        <button onclick="startPlacingService('${key}')" 
                            class="h-11 bg-white border border-gray-100 rounded-xl flex items-center justify-center hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm active:scale-95 group">
                            <i class="fa-solid ${PLATFORM_SERVICES[key].icon} text-gray-400 group-hover:text-indigo-500"></i>
                        </button>
                    `).join('')}
                </div>
            `}
        </div>

        <div class="space-y-4">
            <div class="flex items-center justify-between px-1">
                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Services</p>
                <span class="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">${currentServicesData.length}</span>
            </div>
            ${servicesHTML}
        </div>

        <div class="mt-8 pt-6 border-t border-gray-100 flex flex-col space-y-3">
            <button onclick="saveAllServices()" class="w-full py-3 bg-gray-900 text-white font-bold text-xs rounded-xl shadow-lg shadow-gray-200 hover:bg-black transition-all flex items-center justify-center group">
                <i class="fa-solid fa-cloud-arrow-up mr-2 text-indigo-400 group-hover:scale-110 transition-transform"></i> SAVE ALL CHANGES
            </button>
            <button onclick="recenterMap()" class="w-full py-3 bg-white border border-gray-200 text-gray-600 font-bold text-xs rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center">
                <i class="fa-solid fa-crosshairs mr-2"></i> RECENTER VIEW
            </button>
        </div>
    `;
}

// --- Interaction Actions ---

function startPlacingService(type) { currentPlacementServiceType = type; renderSidebar(); }
function cancelPlacement() { currentPlacementServiceType = null; renderSidebar(); }

function renderServiceMarkers() {
    pServiceMarkers.forEach(m => map.removeLayer(m));
    pServiceMarkers = [];
    
    currentServicesData.forEach((srv, index) => {
        const sType = PLATFORM_SERVICES[srv.type];
        if(!sType) return;
        
        const platform = platformsData.find(p => p.id === srv.platformId);
        const locationTip = platform ? platform.name : "Ground";

        const marker = L.marker([srv.lat, srv.lng], {
            draggable: true,
            icon: L.divIcon({
                className: 'service-marker',
                html: `<div class="w-7 h-7 ${sType.bg} ${sType.color} rounded-full border-2 border-white shadow-md flex items-center justify-center text-[12px] group relative focus:ring-4 focus:ring-indigo-100 transition-all"><i class="fa-solid ${sType.icon}"></i></div>`,
                iconSize: [28, 28], iconAnchor: [14, 14]
            })
        }).addTo(map).bindTooltip(`${sType.name} (${locationTip})`, { direction: 'top', offset: [0, -10] });

        marker.on('dragend', (e) => { 
            const pos = e.target.getLatLng(); 
            srv.lat = pos.lat; 
            srv.lng = pos.lng; 
            
            // Re-detect platform on drag end
            let detectedPlatformId = null;
            for (const p of platformsData) {
                if (p.geojson && GeoFilter.isPointInPolygon(pos, p.geojson.geometry.coordinates[0])) {
                    detectedPlatformId = p.id;
                    break;
                }
            }
            srv.platformId = detectedPlatformId;
            renderSidebar();
            marker.setTooltipContent(`${sType.name} (${detectedPlatformId ? platformsData.find(p => p.id === detectedPlatformId).name : "Ground"})`);
        });
        
        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
        });

        pServiceMarkers.push(marker);
    });
}

function deleteService(index) { 
    currentServicesData.splice(index, 1); 
    renderServiceMarkers(); 
    renderSidebar(); 
}

function saveAllServices() {
    const allServices = Storage.getServices().filter(s => s.stationId !== currentStationId);
    const updatedServices = [...allServices, ...currentServicesData];
    Storage.saveServices(updatedServices);
    showToast("All services saved successfully!");
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
        for (let p of platformsData) { 
            if (p.geojson && GeoFilter.isPointInPolygon(pt, p.geojson.geometry.coordinates[0])) { 
                inside = true; 
                break; 
            } 
        }
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

