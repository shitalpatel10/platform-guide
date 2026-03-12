// --- Global State ---
let currentStationId = null;
let stationData = null;
let platformsData = [];
let platformsFeatureGroup;
let servicesFeatureGroup;
let boundaryFeatureGroup;
let osmServicesGroup;
let infraFeatureGroup;
let infraData = [];
let servicesData = [];

let activeFilter = 'all';
let searchQuery = '';
let selectedItemId = null;
let selectedItemType = null;
let isFetchingOSM = false;
let userMarker = null;

const PLATFORM_SERVICES = {
    'washroom': { name: 'Washroom', icon: 'fa-restroom', color: 'text-blue-500', bg: 'bg-blue-100', layerColor: '#3B82F6' },
    'water_cooler': { name: 'Water Cooler', icon: 'fa-glass-water', color: 'text-cyan-500', bg: 'bg-cyan-100', layerColor: '#06B6D4' },
    'grocery': { name: 'Grocery / Shop', icon: 'fa-store', color: 'text-green-500', bg: 'bg-green-100', layerColor: '#10B981' },
    'tea_coffee': { name: 'Tea / Coffee Stall', icon: 'fa-mug-hot', color: 'text-orange-500', bg: 'bg-orange-100', layerColor: '#F97316' },
    'waiting_area': { name: 'Waiting Area', icon: 'fa-chair', color: 'text-indigo-500', bg: 'bg-indigo-100', layerColor: '#6366F1' },
    'charging_point': { name: 'Charging Point', icon: 'fa-plug', color: 'text-yellow-500', bg: 'bg-yellow-100', layerColor: '#EAB308' },
    'ticket': { name: 'Ticket Counter', icon: 'fa-ticket', color: 'text-pink-500', bg: 'bg-pink-100', layerColor: '#EC4899' },
    'info': { name: 'Information Desk', icon: 'fa-circle-info', color: 'text-sky-500', bg: 'bg-sky-100', layerColor: '#0EA5E9' }
};

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentStationId = urlParams.get('id');

    if (!currentStationId) {
        alert("No station selected!");
        window.location.href = 'index.html';
        return;
    }

    stationData = Storage.getStationById(currentStationId);
    if (!stationData) {
        alert("Station not found!");
        window.location.href = 'index.html';
        return;
    }

    platformsData = Storage.getPlatformsByStationId(currentStationId);
    infraData = Storage.getInfrastructureByStationId(currentStationId);
    servicesData = Storage.getServicesByStationId(currentStationId);

    initUI();
    initMap();
    renderAll();
});

function initUI() {
    document.getElementById('header-station-name').innerText = stationData.name;
    document.getElementById('header-station-code').innerText = stationData.code;
}

function initMap() {
    map = L.map('map', { zoomControl: false, maxZoom: 22 }).setView([stationData.lat, stationData.lng], stationData.zoom || 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 22,
        maxNativeZoom: 19,
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
        maxZoom: 22,
        maxNativeZoom: 19,
        attribution: 'Map data: &copy; OpenStreetMap | Map style: &copy; OpenRailwayMap'
    }).addTo(map);

    boundaryFeatureGroup = new L.FeatureGroup().addTo(map);
    platformsFeatureGroup = new L.FeatureGroup().addTo(map);
    servicesFeatureGroup = new L.FeatureGroup().addTo(map);
    osmServicesGroup = new L.FeatureGroup().addTo(map);
    infraFeatureGroup = new L.FeatureGroup().addTo(map);

    map.on('click', (e) => {
        // Feature removed as per request
    });

    // Render boundary if exists
    if (stationData.geojson) {
        const layer = L.geoJSON(stationData.geojson, {
            style: {
                color: '#2563EB',
                fillOpacity: 0.05,
                weight: 2,
                dashArray: '5, 8'
            }
        }).addTo(boundaryFeatureGroup);

        layer.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            selectItem('station', stationData.id);
        });
    }

    // Feature removed: Only show admin-added data
}


// --- Rendering Logic ---

function renderAll() {
    platformsFeatureGroup.clearLayers();
    servicesFeatureGroup.clearLayers();
    infraFeatureGroup.clearLayers();

    const query = searchQuery.toLowerCase();

    platformsData.forEach(p => {
        const pMatches = activeFilter !== 'services' && p.name.toLowerCase().includes(query);
        const shouldShowPlatform = activeFilter !== 'services' && (pMatches || query === '');

        if (p.geojson && (activeFilter === 'all' || activeFilter === 'platforms')) {
            const isSelected = selectedItemType === 'platform' && selectedItemId === p.id;
            const isVisible = shouldShowPlatform || isSelected;

            const layer = L.geoJSON(p.geojson, {
                style: {
                    color: isSelected ? '#2563EB' : '#6B7280',
                    weight: isSelected ? 3 : 2,
                    fillOpacity: isVisible ? (isSelected ? 0.6 : 0.4) : 0.1,
                    fillColor: isSelected ? '#2563EB' : '#9CA3AF',
                    opacity: isVisible ? 1 : 0.2
                }
            }).addTo(platformsFeatureGroup);

            if (isVisible) {
                layer.bindTooltip(`<b>${p.name}</b>`, {
                    permanent: true,
                    direction: 'center',
                    className: 'user-tooltip font-bold text-gray-700 bg-white/90 border-none shadow-sm rounded-lg px-2 py-1 text-[10px]'
                });
            }

            layer.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                selectItem('platform', p.id);
            });
        }
    });

    // Render Global Station Services
    if (activeFilter === 'all' || activeFilter === 'services') {
        servicesData.forEach((srv, idx) => {
            const isSelected = selectedItemType === 'service' && selectedItemId === srv.id;
            const sType = PLATFORM_SERVICES[srv.type];
            const sMatches = sType && sType.name.toLowerCase().includes(query);
            const isVisible = sMatches || isSelected || query === '';

            if (sType && isVisible) {
                const marker = L.marker([srv.lat, srv.lng], {
                    icon: L.divIcon({
                        className: 'service-marker-container',
                        html: `
                            <div class="group relative flex flex-col items-center">
                                <div class="w-8 h-8 ${isSelected ? 'bg-indigo-600' : sType.bg} ${isSelected ? 'text-white' : sType.color} rounded-full border-2 border-white shadow-lg flex items-center justify-center text-sm transform transition-all hover:scale-110 active:scale-95 cursor-pointer">
                                    <i class="fa-solid ${sType.icon}"></i>
                                </div>
                                <div class="mt-1 bg-white/90 px-1.5 py-0.5 rounded shadow-sm text-[8px] font-bold text-gray-600 border border-gray-100 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}">
                                    ${sType.name}
                                </div>
                            </div>
                        `,
                        iconSize: [32, 48],
                        iconAnchor: [16, 16]
                    })
                }).addTo(servicesFeatureGroup);

                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    selectItem('service', srv.id, srv);
                });
            }
        });
    }


    infraData.forEach(item => {
        const isSelected = selectedItemId === item.id;
        const matches = item.name.toLowerCase().includes(query) || query === '';
        
        if (matches && (activeFilter === 'all' || activeFilter === 'platforms' || activeFilter === 'infrastructure')) {
            if (item.type === 'bridge' || item.type === 'path') {
                const layerColors = { 'bridge': '#EA580C', 'path': '#0D9488' };
                const renderMainPath = (pts, isBranch = false) => {
                    const layer = L.polyline(pts, {
                        color: layerColors[item.type] || '#6B7280',
                        weight: isSelected ? (isBranch ? 6 : 8) : (isBranch ? 3 : 5),
                        opacity: isSelected ? 1 : 0.7,
                        dashArray: isBranch ? '5, 5' : null,
                        lineJoin: 'round'
                    }).addTo(infraFeatureGroup);

                    layer.on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        selectItem('infra', item.id);
                    });
                };

                if (item.latlngs) renderMainPath(item.latlngs);
                if (item.branches) {
                    item.branches.forEach(b => renderMainPath(b, true));
                }
            } else {
                const icons = {
                    'entry': 'fa-door-open',
                    'exit': 'fa-door-closed',
                    'concourse': 'fa-couch',
                    'transport_hub': 'fa-taxi'
                };
                const bgColors = {
                    'entry': 'bg-teal-600',
                    'exit': 'bg-red-600',
                    'concourse': 'bg-indigo-600',
                    'transport_hub': 'bg-yellow-600'
                };
                const iconClass = icons[item.type] || 'fa-location-dot';
                const bgColor = bgColors[item.type] || 'bg-gray-600';

                const icon = L.divIcon({
                    className: 'gate-icon',
                    html: `<div class="w-7 h-7 ${isSelected ? 'scale-125 border-primary shadow-xl' : ''} ${bgColor} text-white rounded-full border-2 border-white shadow-md flex items-center justify-center text-xs transition-all"><i class="fa-solid ${iconClass}"></i></div>`,
                    iconSize: [28, 28], iconAnchor: [14, 14]
                });
                const marker = L.marker(item.latlng, { icon }).addTo(infraFeatureGroup);
                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    selectItem('infra', item.id);
                });
            }
        }
    });

    updateSidebarList();
    
    if (!selectedItemId && platformsData.length > 0 && query === '') {
        fitAll();
    }
}

function updateSidebarList() {
    const container = document.getElementById('sidebar-content');
    const countEl = document.getElementById('items-count');
    
    if (selectedItemId) {
        renderDetailView(container);
        countEl.innerText = "Showing Details";
        return;
    }

    let filteredPlatforms = [];
    let filteredServices = [];
    const query = searchQuery.toLowerCase();

    if (activeFilter === 'all' || activeFilter === 'platforms') {
        filteredPlatforms = platformsData.filter(p => p.name.toLowerCase().includes(query));
    }

    if (activeFilter === 'all' || activeFilter === 'services') {
        servicesData.forEach((srv) => {
            const sType = PLATFORM_SERVICES[srv.type];
            if (sType && sType.name.toLowerCase().includes(query)) {
                const platform = platformsData.find(p => p.id === srv.platformId);
                const platformName = platform ? platform.name : "Ground";
                filteredServices.push({ ...srv, platformName: platformName, source: 'internal' });
            }
        });
    }

    let filteredInfra = [];
    if (activeFilter === 'all' || activeFilter === 'platforms' || activeFilter === 'infrastructure') {
        filteredInfra = infraData.filter(i => i.name.toLowerCase().includes(query));
    }

    countEl.innerText = `${filteredPlatforms.length + filteredServices.length + filteredInfra.length} Results`;

    if (filteredPlatforms.length === 0 && filteredServices.length === 0 && filteredInfra.length === 0) {
        if (isFetchingOSM) {
            container.innerHTML = `<div class="text-center py-12 px-6"><div class="inline-block animate-spin w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full mb-4"></div><p class="text-xs text-gray-500">Searching for amenities...</p></div>`;
        } else {
            container.innerHTML = `<div class="text-center py-12 px-6"><div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100"><i class="fa-solid fa-magnifying-glass text-gray-200 text-2xl"></i></div><h3 class="text-sm font-bold text-gray-900">No results found</h3></div>`;
        }
        return;
    }

    let html = '';
    if (filteredPlatforms.length > 0) {
        html += `<div class="space-y-2"><p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Platforms</p><div class="grid grid-cols-1 gap-2">`;
        filteredPlatforms.forEach(p => {
            html += `<div onclick="selectItem('platform', '${p.id}')" class="group bg-white border border-gray-200 hover:border-primary/30 rounded-2xl p-4 cursor-pointer transition-all shadow-sm hover:shadow-md flex items-center justify-between"><div class="flex items-center space-x-4"><div class="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all"><i class="fa-solid fa-train-subway"></i></div><div><p class="font-bold text-gray-900 group-hover:text-primary transition-colors text-sm">${p.name}</p></div></div><i class="fa-solid fa-chevron-right text-gray-300 group-hover:text-primary text-xs transition-all"></i></div>`;
        });
        html += `</div></div>`;
    }

    if (filteredServices.length > 0) {
        html += `<div class="space-y-2 mt-6"><p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Facilities</p><div class="grid grid-cols-1 gap-2">`;
        filteredServices.forEach(srv => {
            if (srv.source === 'internal') {
                const sType = PLATFORM_SERVICES[srv.type];
                const locationLabel = srv.platformName === 'Ground' ? 'On Ground' : `Platform ${srv.platformName}`;
                html += `<div onclick="selectItem('service', '${srv.id}')" class="group bg-white border border-gray-200 hover:border-primary/30 rounded-2xl p-4 cursor-pointer transition-all shadow-sm hover:shadow-md flex items-center justify-between"><div class="flex items-center space-x-4"><div class="w-10 h-10 rounded-xl ${sType.bg} ${sType.color} flex items-center justify-center transform group-hover:scale-110 transition-all"><i class="fa-solid ${sType.icon}"></i></div><div><p class="font-bold text-gray-900 text-sm group-hover:text-primary transition-colors">${sType.name}</p><p class="text-[10px] text-gray-400 font-medium">${locationLabel}</p></div></div><i class="fa-solid fa-chevron-right text-gray-300 group-hover:text-primary text-xs transition-all"></i></div>`;
            } else {
                html += `<div onclick="selectItem('osm', '${srv.id}', ${JSON.stringify(srv).replace(/"/g, '&quot;')})" class="group bg-white border border-gray-200 hover:border-primary/30 rounded-2xl p-4 cursor-pointer transition-all shadow-sm hover:shadow-md flex items-center justify-between"><div class="flex items-center space-x-4"><div class="w-10 h-10 rounded-xl bg-gray-50 text-gray-600 border border-gray-100 flex items-center justify-center text-lg transform group-hover:scale-110 transition-all">📍</div><div><p class="font-bold text-gray-900 text-sm group-hover:text-primary transition-colors">${srv.name}</p><p class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">${srv.type}</p></div></div><i class="fa-solid fa-chevron-right text-gray-300 group-hover:text-primary text-xs transition-all"></i></div>`;
            }
        });
        html += `</div></div>`;
    }

    if (filteredInfra.length > 0) {
        html += `<div class="space-y-2 mt-6"><p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Infrastructure</p><div class="grid grid-cols-1 gap-2">`;
        filteredInfra.forEach(item => {
            const icons = {
                'bridge': 'fa-bridge', 'path': 'fa-route', 'entry': 'fa-door-open', 
                'exit': 'fa-door-closed', 'concourse': 'fa-couch', 'transport_hub': 'fa-taxi'
            };
            const colors = {
                'bridge': 'bg-orange-50 text-orange-600', 'path': 'bg-teal-50 text-teal-600',
                'entry': 'bg-teal-50 text-teal-600', 'exit': 'bg-red-50 text-red-600',
                'concourse': 'bg-indigo-50 text-indigo-600', 'transport_hub': 'bg-yellow-50 text-yellow-600'
            };
            const icon = icons[item.type] || 'fa-location-dot';
            const color = colors[item.type] || 'bg-gray-50 text-gray-600';
            html += `<div onclick="selectItem('infra', '${item.id}')" class="group bg-white border border-gray-200 hover:border-primary/30 rounded-2xl p-4 cursor-pointer transition-all shadow-sm hover:shadow-md flex items-center justify-between"><div class="flex items-center space-x-4"><div class="w-10 h-10 rounded-xl ${color} flex items-center justify-center transform group-hover:scale-110 transition-all"><i class="fa-solid ${icon}"></i></div><div><p class="font-bold text-gray-900 text-sm group-hover:text-primary transition-colors">${item.name}</p><p class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">${item.type.replace('_', ' ')}</p></div></div><i class="fa-solid fa-chevron-right text-gray-300 group-hover:text-primary text-xs transition-all"></i></div>`;
        });
        html += `</div></div>`;
    }
    container.innerHTML = html;
}

function renderDetailView(container) {
    if (selectedItemType === 'platform') {
        const platform = platformsData.find(p => p.id === selectedItemId);
        if (!platform) return;
        let servicesHtml = (platform.services || []).map(srv => {
            const sType = PLATFORM_SERVICES[srv.type];
            return `<div class="flex items-center space-x-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm"><div class="w-8 h-8 rounded-lg ${sType.bg} ${sType.color} flex items-center justify-center text-xs"><i class="fa-solid ${sType.icon}"></i></div><span class="text-xs font-bold text-gray-700">${sType.name}</span></div>`;
        }).join('') || '<p class="text-xs text-gray-400 italic">No services listed.</p>';

        container.innerHTML = `<div class="space-y-6 animate-in slide-in-from-bottom-4"><button onclick="deselectItem()" class="flex items-center text-primary text-xs font-bold hover:underline mb-2"><i class="fa-solid fa-arrow-left mr-2"></i> Back</button><div class="bg-primary rounded-3xl p-6 text-white shadow-xl relative overflow-hidden"><h2 class="text-2xl font-black">${platform.name}</h2></div><button onclick="recenterToItem('platform', '${platform.id}')" class="w-full py-3 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-bold transition-all border border-gray-100 flex items-center justify-center"><i class="fa-solid fa-crosshairs mr-2"></i> Recenter</button><div class="space-y-3"><h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Amenities</h4>${servicesHtml}</div></div>`;
    } else if (selectedItemType === 'service') {
        let service = servicesData.find(s => s.id === selectedItemId);
        if (!service) {
            // Fallback for services nested within platforms (old structure)
            for (let p of platformsData) {
                if (p.services) {
                    const s = p.services.find((s, i) => `${p.id}_srv_${i}` === selectedItemId);
                    if (s) { service = { ...s, ...PLATFORM_SERVICES[s.type], platformName: p.name, id: selectedItemId }; break; }
                }
            }
        } else {
            // If found in servicesData, enrich with PLATFORM_SERVICES info
            service = { ...service, ...PLATFORM_SERVICES[service.type] };
            const platform = platformsData.find(p => p.id === service.platformId);
            service.platformName = platform ? platform.name : "Ground";
        }
        
        if (!service) return;
        container.innerHTML = `<div class="space-y-6 animate-in slide-in-from-bottom-4"><button onclick="deselectItem()" class="flex items-center text-primary text-xs font-bold hover:underline mb-2"><i class="fa-solid fa-arrow-left mr-2"></i> Back</button><div class="bg-white border-2 border-gray-100 rounded-3xl p-6 shadow-xl"><div class="w-16 h-16 ${service.bg} ${service.color} rounded-2xl flex items-center justify-center text-2xl mb-4"><i class="fa-solid ${service.icon}"></i></div><h2 class="text-2xl font-black">${service.name}</h2><p class="text-[10px] text-gray-500 mt-2">${service.platformName}</p></div><button onclick="recenterToItem('service', '${service.id}')" class="w-full py-3 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-bold transition-all border border-gray-100 flex items-center justify-center"><i class="fa-solid fa-crosshairs mr-2"></i> Recenter</button></div>`;
    } else if (selectedItemType === 'station') {
        container.innerHTML = `<div class="space-y-6 animate-in slide-in-from-bottom-4"><button onclick="deselectItem()" class="flex items-center text-primary text-xs font-bold hover:underline mb-2"><i class="fa-solid fa-arrow-left mr-2"></i> Back</button><div class="bg-gradient-to-br from-blue-600 to-primary rounded-3xl p-6 text-white shadow-xl"><h2 class="text-2xl font-black">${stationData.name}</h2><p class="text-sm font-mono opacity-80">${stationData.code}</p></div><button onclick="recenterToItem('station', '${stationData.id}')" class="w-full py-3 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-bold transition-all border border-gray-100 flex items-center justify-center"><i class="fa-solid fa-crosshairs mr-2"></i> Recenter</button></div>`;
    } else if (selectedItemType === 'infra') {
        const item = infraData.find(i => i.id === selectedItemId);
        if (!item) return;
        const icons = {
            'bridge': 'fa-bridge', 'path': 'fa-route', 'entry': 'fa-door-open', 
            'exit': 'fa-door-closed', 'concourse': 'fa-couch', 'transport_hub': 'fa-taxi'
        };
        const colors = {
            'bridge': 'bg-orange-50 text-orange-600', 'path': 'bg-teal-50 text-teal-600',
            'entry': 'bg-teal-50 text-teal-600', 'exit': 'bg-red-50 text-red-600',
            'concourse': 'bg-indigo-50 text-indigo-600', 'transport_hub': 'bg-yellow-50 text-yellow-600'
        };
        const icon = icons[item.type] || 'fa-location-dot';
        const color = colors[item.type] || 'bg-gray-50 text-gray-600';
        container.innerHTML = `<div class="space-y-6 animate-in slide-in-from-bottom-4"><button onclick="deselectItem()" class="flex items-center text-primary text-xs font-bold hover:underline mb-2"><i class="fa-solid fa-arrow-left mr-2"></i> Back</button><div class="bg-white border-2 border-gray-100 rounded-3xl p-6 shadow-xl"><div class="w-16 h-16 ${color} rounded-2xl flex items-center justify-center text-2xl mb-4"><i class="fa-solid ${icon}"></i></div><h2 class="text-2xl font-black">${item.name}</h2><p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-2">${item.type.replace('_', ' ')}</p></div><button onclick="recenterToItem('infra', '${item.id}')" class="w-full py-3 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-bold transition-all border border-gray-100 flex items-center justify-center"><i class="fa-solid fa-crosshairs mr-2"></i> Recenter</button></div>`;
    }

    // Add distance indicator if user location is active
    if (userMarker) {
        let targetLat, targetLng;
        if (selectedItemType === 'platform') {
             const p = platformsData.find(x => x.id === selectedItemId);
             if (p) { const center = L.geoJSON(p.geojson).getBounds().getCenter(); targetLat = center.lat; targetLng = center.lng; }
        } else if (selectedItemType === 'service') {
             // Logic to find internal service lat/lng
             for (let p of platformsData) {
                 if (p.services) {
                     const s = p.services.find((s, i) => `${p.id}_srv_${i}` === selectedItemId);
                     if (s) { targetLat = s.lat; targetLng = s.lng; break; }
                 }
             }
        }

        if (targetLat && targetLng) {
            const dist = map.distance(userMarker.getLatLng(), [targetLat, targetLng]);
            const distStr = dist > 1000 ? (dist/1000).toFixed(1) + ' km' : Math.round(dist) + ' m';
            const distDiv = document.createElement('div');
            distDiv.className = 'bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between mt-4';
            distDiv.innerHTML = `<div><p class="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Distance from you</p><p class="text-lg font-black text-blue-900">${distStr}</p></div><div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><i class="fa-solid fa-person-walking"></i></div>`;
            container.appendChild(distDiv);
        }
    }
}

// --- Interaction Logic ---

function handleSearch(val) {
    searchQuery = val;
    selectedItemId = null;
    selectedItemType = null;
    renderAll();
}

function setFilter(filter, event) {
    activeFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(btn => {
        btn.classList.remove('active', 'bg-primary', 'text-white', 'shadow-md', 'shadow-primary/20');
        btn.classList.add('bg-gray-100', 'text-gray-500');
    });
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.remove('bg-gray-100', 'text-gray-500');
        event.currentTarget.classList.add('active', 'bg-primary', 'text-white', 'shadow-md', 'shadow-primary/20');
    }
    selectedItemId = null;
    selectedItemType = null;
    renderAll();
}

function selectItem(type, id) {
    selectedItemId = id;
    selectedItemType = type;
    renderAll();
    recenterToItem(type, id);
}

function recenterToItem(type, id) {
    if (type === 'platform') {
        const platform = platformsData.find(p => p.id === id);
        if (platform && platform.geojson) { map.fitBounds(L.geoJSON(platform.geojson).getBounds(), { padding: [100, 100], duration: 1.5 }); }
    } else if (type === 'service') {
        let found = extraData;
        if (!found) { for (let p of platformsData) { if (p.services) { found = p.services.find((s, i) => `${p.id}_srv_${i}` === id); if (found) break; } } }
        if (found) { map.flyTo([found.lat, found.lng], 20, { duration: 1.5 }); }
    } else if (type === 'osm') {
        const item = extraData || window.__selectedOsmItem;
        if (item) { map.flyTo([item.lat, item.lon || item.lng], 19, { duration: 1.5 }); }
    } else if (type === 'station') {
        if (boundaryFeatureGroup.getBounds().isValid()) { map.fitBounds(boundaryFeatureGroup.getBounds(), { padding: [100, 100], duration: 1.5 }); }
        else { map.flyTo([stationData.lat, stationData.lng], stationData.zoom || 15, { duration: 1.5 }); }
    } else if (type === 'infra') {
        const item = infraData.find(i => i.id === id);
        if (item) {
            if (item.type === 'bridge' || item.type === 'path') {
                const layer = L.polyline(item.latlngs);
                map.fitBounds(layer.getBounds(), { padding: [100, 100], duration: 1.5 });
            } else {
                map.flyTo(item.latlng, 19, { duration: 1.5 });
            }
        }
    }
}

function deselectItem() {
    selectedItemId = null;
    selectedItemType = null;
    window.__selectedOsmItem = null;
    renderAll();
    fitAll();
}

function fitAll() {
    if (!map) return;
    const allBounds = platformsFeatureGroup.getBounds();
    if (allBounds.isValid()) { map.fitBounds(allBounds, { padding: [40, 40], duration: 1 }); }
    else if (boundaryFeatureGroup.getBounds().isValid()) { map.fitBounds(boundaryFeatureGroup.getBounds(), { padding: [40, 40], duration: 1 }); }
    else { map.setView([stationData.lat, stationData.lng], stationData.zoom || 14); }
}

function updateUserLocation(lat, lng) {
    if (userMarker) map.removeLayer(userMarker);
    
    userMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'user-location-marker',
            html: `
                <div class="relative flex items-center justify-center">
                    <div class="absolute w-8 h-8 bg-blue-500 rounded-full animate-ping opacity-25"></div>
                    <div class="w-4 h-4 bg-white rounded-full border-4 border-blue-500 shadow-lg"></div>
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        })
    }).addTo(map);
    
    renderAll();
}

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-5 right-5 ${isError ? 'bg-red-600' : 'bg-green-600'} text-white px-6 py-3 rounded-lg shadow-lg z-[4000] transition-all transform translate-y-10 opacity-0 text-sm font-medium`;
    toast.innerHTML = `<i class="fa-solid ${isError ? 'fa-triangle-exclamation' : 'fa-check'} mr-2"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 50);
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
