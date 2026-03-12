// --- Global State ---
let currentStationId = null;
let pVertexMarkers = [];
let pMidpointMarkers = [];
let pSelectedVertexIndex = -1;
let platformsData = []; // To keep track of all platforms for this station
let selectedPlatformId = null; // The ID of the currently selected/editable platform
let editedPlatformLayer = null; // The leaflet layer of the currently editing polygon
let platformsFeatureGroup = null; // Group holding all static platforms
let platformSearchQuery = ''; // Search filter for platforms

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
        if (e.key === 'Escape') {
            const card = document.getElementById('platform-details-card');
            if (card && !card.classList.contains('hidden')) {
                togglePlatformDetailsModal(false);
            } else if (editedPlatformLayer || selectedPlatformId) {
                cancelEditingPlatform();
            }
        }
    });

    document.getElementById('header-station-name').innerText = station.name;
    document.getElementById('header-station-code').innerText = station.code;

    const manageServicesLink = document.getElementById('manage-services-link');
    if (manageServicesLink) {
        manageServicesLink.href = 'services.html?id=' + currentStationId;
    }

    map = L.map('map', { zoomControl: false, maxZoom: 24 }).setView([station.lat, station.lng], station.zoom || 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 24,
        maxNativeZoom: 19,
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
        maxZoom: 24,
        maxNativeZoom: 19,
        attribution: 'Map data: &copy; OpenStreetMap | Map style: &copy; OpenRailwayMap'
    }).addTo(map);

    if (station.geojson) {
        const stationFeatureGroup = new L.FeatureGroup();
        map.addLayer(stationFeatureGroup);
        const geoJsonLayer = L.geoJSON(station.geojson);

        geoJsonLayer.eachLayer(layer => {
            layer.setStyle({
                color: '#2563EB',
                fillOpacity: 0.1,
                weight: 2,
                dashArray: '5, 5'
            });
            layer.options.interactive = false;
            stationFeatureGroup.addLayer(layer);
        });
        map.fitBounds(stationFeatureGroup.getBounds());
    }

    platformsData = Storage.getPlatformsByStationId(currentStationId);
    platformsFeatureGroup = new L.FeatureGroup();
    map.addLayer(platformsFeatureGroup);

    if (platformsData && platformsData.length > 0) {
        renderAllStaticPlatforms();
        map.fitBounds(platformsFeatureGroup.getBounds());
    }

    renderSidebar();
});

// --- Map & Interaction ---

function renderAllStaticPlatforms() {
    platformsFeatureGroup.clearLayers();
    platformsData.forEach(p => {
        if (p.id === selectedPlatformId) return;
        if (p.geojson) {
            const layer = L.geoJSON(p.geojson, {
                style: {
                    color: '#6B7280',
                    weight: 2,
                    fillOpacity: 0.4
                }
            }).bindTooltip(p.name, {
                permanent: true,
                direction: 'center',
                className: 'font-bold text-gray-700 bg-white/80 border-none shadow-sm rounded px-1 py-0.5 text-xs'
            });

            layer.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                selectPlatform(p.id);
            });

            layer.on('mouseover', function (e) {
                this.setStyle({ fillOpacity: 0.6, color: '#8B5CF6' });
                this.bringToFront();
            });

            layer.on('mouseout', function (e) {
                this.setStyle({ fillOpacity: 0.4, color: '#6B7280' });
            });
            platformsFeatureGroup.addLayer(layer);
        }
    });
}

function renderSidebar() {
    const sidebarTitle = document.getElementById('sidebar-title');
    const sidebarContent = document.getElementById('sidebar-content');

    if (selectedPlatformId || editedPlatformLayer) {
        sidebarTitle.innerHTML = `<i class="fa-solid fa-vector-square text-purple-600 mr-2"></i> Platform Details`;
        const platform = platformsData.find(p => p.id === selectedPlatformId);
        const name = platform ? platform.name : "New Platform (Unsaved)";

        sidebarContent.innerHTML = `
            <div class="bg-purple-50 rounded-xl p-4 border border-purple-100">
                <div class="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1">Editing Platform</div>
                <h3 class="text-lg font-bold text-purple-900 truncate">${name}</h3>
            </div>
            <div class="text-xs text-gray-500 mt-4 leading-relaxed px-1">
                <p class="mb-2"><i class="fa-solid fa-info-circle mr-1 text-gray-400"></i> Shape is currently editable on the map.</p>
                <p><i class="fa-solid fa-lightbulb mr-1 text-yellow-500"></i> Dbl-click vertices to delete. Click midpoints to add.</p>
            </div>
            <div class="mt-4 space-y-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Quick Actions</p>
                <button onclick="recenterToPlatform()" class="w-full text-left px-3 py-2 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-gray-700 font-medium text-sm rounded-lg transition-colors border border-gray-200 shadow-sm"><i class="fa-solid fa-crosshairs mr-2 text-blue-500"></i> Recenter</button>
                <button onclick="savePlatform()" class="w-full text-left px-3 py-2 bg-white hover:bg-green-50 hover:text-green-700 hover:border-green-200 text-gray-700 font-medium text-sm rounded-lg transition-colors border border-gray-200 shadow-sm"><i class="fa-solid fa-check mr-2 text-green-500"></i> Save Details</button>
                <button onclick="${selectedPlatformId ? 'deleteCurrentPlatform()' : 'cancelEditingPlatform()'}" class="w-full text-left px-3 py-2 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-red-500 font-medium text-sm rounded-lg transition-colors border border-gray-200 shadow-sm"><i class="fa-solid fa-trash-can mr-2"></i> ${selectedPlatformId ? 'Delete' : 'Discard'}</button>
                <button onclick="cancelEditingPlatform()" class="w-full text-left px-3 py-2 bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-900 border border-gray-200 font-medium text-sm rounded-lg transition-colors shadow-sm"><i class="fa-solid fa-arrow-left mr-2"></i> Stop</button>
            </div>
        `;
    } else {
        sidebarTitle.innerHTML = `<i class="fa-solid fa-list-ul text-purple-600 mr-2"></i> All Platforms`;
        const filtered = platformsData.filter(p => p.name.toLowerCase().includes(platformSearchQuery.toLowerCase()));
        
        if (filtered.length === 0) {
            sidebarContent.innerHTML = `<div class="text-center py-10 px-4"><div class="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3"><i class="fa-solid fa-vector-square text-xl"></i></div><p class="text-sm text-gray-500 font-medium">${platformSearchQuery ? 'No platforms match' : 'No platforms yet'}</p></div>`;
        } else {
            let html = '';
            filtered.forEach(p => {
                html += `<div onclick="selectPlatform('${p.id}')" class="group bg-white border border-gray-200 hover:border-purple-300 rounded-xl p-3 cursor-pointer transition-all shadow-sm hover:shadow-md flex items-center justify-between"><div class="flex items-center space-x-3 overflow-hidden"><div class="w-8 h-8 rounded bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-110 group-hover:bg-purple-100 transition-all flex-shrink-0"><i class="fa-solid fa-train"></i></div><div class="truncate"><p class="font-bold text-sm text-gray-800 group-hover:text-purple-700 transition-colors truncate">${p.name}</p></div></div><i class="fa-solid fa-chevron-right text-gray-300 group-hover:text-purple-400 text-xs transition-colors"></i></div>`;
            });
            sidebarContent.innerHTML = html;
        }
    }
}

function handlePlatformSearch(query) {
    platformSearchQuery = query;
    renderSidebar();
}

// --- Platform Logic ---

function selectPlatform(platformId) {
    if (editedPlatformLayer) {
        if (!confirm("Discard unsaved changes?")) return;
        clearPlatformEditingState();
    }
    selectedPlatformId = platformId;
    const platform = platformsData.find(p => p.id === platformId);
    if (!platform) return;

    renderAllStaticPlatforms();
    const staticLayer = L.geoJSON(platform.geojson);
    const latlngs = staticLayer.getLayers()[0].getLatLngs();
    map.fitBounds(staticLayer.getBounds(), { padding: [100, 100], duration: 1 });

    editedPlatformLayer = L.polygon(latlngs, {
        color: '#9333EA', fillColor: '#A855F7', fillOpacity: 0.4, weight: 3
    }).addTo(map);
    renderPlatformVertices();
    document.getElementById('platform-name-input').value = platform.name;
    updatePlatformButtons();
    renderSidebar();
}

function clearPlatformEditingState() {
    if (editedPlatformLayer) { map.removeLayer(editedPlatformLayer); editedPlatformLayer = null; }
    clearPlatformMarkers();
    selectedPlatformId = null;
    document.getElementById('platform-name-input').value = "";
    renderAllStaticPlatforms();
    updatePlatformButtons();
    renderSidebar();
}

function cancelEditingPlatform() {
    togglePlatformDetailsModal(false);
    clearPlatformEditingState();
}

function addPlatformPolygon() {
    if (editedPlatformLayer) {
        if (confirm("Discard platform drawing?")) clearPlatformEditingState();
        return;
    }
    selectedPlatformId = null;
    const center = map.getCenter();
    const rLat = 0.00005, rLng = 0.0002;
    const latlngs = [[center.lat+rLat, center.lng-rLng], [center.lat-rLat, center.lng-rLng], [center.lat-rLat, center.lng+rLng], [center.lat+rLat, center.lng+rLng]];
    
    editedPlatformLayer = L.polygon(latlngs, { color: 'purple', weight: 3, fillOpacity: 0.4 }).addTo(map);
    renderPlatformVertices();
    updatePlatformButtons();
    renderSidebar();
}

function updatePlatformButtons() {
    const actionBtn = document.getElementById('btn-add-polygon');
    if (!actionBtn) return;
    const icon = actionBtn.querySelector('i'), label = actionBtn.querySelector('span'), iconContainer = actionBtn.querySelector('div');
    if (editedPlatformLayer) {
        label.innerText = "Cancel"; icon.className = "fa-solid fa-rotate-left"; iconContainer.className = "w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-700";
    } else {
        label.innerText = "Add Poly"; icon.className = "fa-solid fa-draw-polygon"; iconContainer.className = "w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-purple-600";
    }
}

function clearPlatformMarkers() {
    pVertexMarkers.forEach(m => map.removeLayer(m));
    pMidpointMarkers.forEach(m => map.removeLayer(m));
    pVertexMarkers = []; pMidpointMarkers = []; pSelectedVertexIndex = -1;
    const deleteBtn = document.getElementById('btn-delete-vertex');
    if (deleteBtn) { deleteBtn.disabled = true; deleteBtn.classList.add('opacity-50', 'cursor-not-allowed'); }
}

function renderPlatformVertices() {
    clearPlatformMarkers();
    if (!editedPlatformLayer) return;
    const latlngs = editedPlatformLayer.getLatLngs()[0];
    latlngs.forEach((latlng, index) => {
        const marker = L.marker(latlng, { draggable: true, icon: L.divIcon({ className: 'vertex-marker', html: `<div class="w-2.5 h-2.5 bg-white border border-purple-600 rounded-full shadow-sm cursor-pointer"></div>`, iconSize: [10, 10], iconAnchor: [5, 5] }) }).addTo(map);
        marker.on('drag', (e) => { latlngs[index] = e.target.getLatLng(); editedPlatformLayer.setLatLngs([latlngs]); updatePlatformMidpoints(); });
        marker.on('dragend', () => renderPlatformVertices());
        marker.on('dblclick', (e) => { L.DomEvent.stopPropagation(e); selectPlatformVertex(index); });
        pVertexMarkers.push(marker);
    });
    latlngs.forEach((latlng, index) => {
        const nextLatlng = latlngs[(index + 1) % latlngs.length];
        const midMarker = L.marker([(latlng.lat + nextLatlng.lat) / 2, (latlng.lng + nextLatlng.lng) / 2], { icon: L.divIcon({ className: 'midpoint-marker', html: `<div class="w-2 h-2 bg-white/80 border border-purple-400 rounded-full shadow-sm cursor-pointer"></div>`, iconSize: [8, 8], iconAnchor: [4, 4] }) }).addTo(map);
        midMarker.on('click', (e) => { L.DomEvent.stopPropagation(e); addPlatformVertex(index); });
        pMidpointMarkers.push(midMarker);
    });
}

function updatePlatformMidpoints() {
    if (!editedPlatformLayer) return;
    const latlngs = editedPlatformLayer.getLatLngs()[0];
    pMidpointMarkers.forEach((marker, index) => {
        const p1 = latlngs[index], p2 = latlngs[(index + 1) % latlngs.length];
        marker.setLatLng([(p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2]);
    });
}

function addPlatformVertex(afterIndex) {
    const latlngs = editedPlatformLayer.getLatLngs()[0];
    const p1 = latlngs[afterIndex], p2 = latlngs[(afterIndex+1)%latlngs.length];
    latlngs.splice(afterIndex+1, 0, L.latLng((p1.lat+p2.lat)/2, (p1.lng+p2.lng)/2));
    editedPlatformLayer.setLatLngs([latlngs]);
    renderPlatformVertices();
}

function selectPlatformVertex(index) {
    pSelectedVertexIndex = index;
    pVertexMarkers.forEach((m, i) => {
        const el = m.getElement().querySelector('div');
        if (i === index) { el.classList.replace('bg-white', 'bg-red-500'); el.classList.replace('border-purple-600', 'border-red-600'); }
        else { el.classList.replace('bg-red-500', 'bg-white'); el.classList.replace('border-red-600', 'border-purple-600'); }
    });
    const btn = document.getElementById('btn-delete-vertex');
    btn.disabled = false; btn.classList.remove('opacity-50', 'cursor-not-allowed');
}

function deletePlatformSelectedVertex() {
    if (pSelectedVertexIndex === -1 || !editedPlatformLayer) return;
    const latlngs = editedPlatformLayer.getLatLngs()[0];
    if (latlngs.length <= 3) { showToast("At least 3 vertices required.", true); return; }
    latlngs.splice(pSelectedVertexIndex, 1);
    editedPlatformLayer.setLatLngs([latlngs]);
    pSelectedVertexIndex = -1;
    renderPlatformVertices();
}

function togglePlatformDetailsModal(show) {
    const card = document.getElementById('platform-details-card'), backdrop = document.getElementById('platform-details-card-backdrop');
    if (show === false || !card.classList.contains('hidden')) {
        card.classList.add('scale-95', 'opacity-0');
        setTimeout(() => { card.classList.add('hidden'); backdrop.classList.add('hidden'); }, 300);
    } else {
        card.classList.remove('hidden'); backdrop.classList.remove('hidden');
        setTimeout(() => { card.classList.remove('scale-95', 'opacity-0'); card.classList.add('scale-100', 'opacity-100'); backdrop.classList.remove('opacity-0'); }, 10);
    }
}

function savePlatform() {
    if (!editedPlatformLayer) { showToast("No shape to save.", true); return; }
    if (!selectedPlatformId) {
        const input = document.getElementById('platform-name-input');
        if (!input.value) input.value = "Platform " + (platformsData.length + 1);
    }
    togglePlatformDetailsModal(true);
}

function confirmSavePlatform() {
    const name = document.getElementById('platform-name-input').value.trim();
    if (!name) { showToast("Name is required.", true); return; }
    const platformData = {
        id: selectedPlatformId || Date.now().toString(),
        stationId: currentStationId,
        name: name,
        geojson: editedPlatformLayer.toGeoJSON()
    };
    const existing = platformsData.find(p => p.id === platformData.id);
    if (existing && existing.services) platformData.services = existing.services;
    
    if (selectedPlatformId) {
        const idx = platformsData.findIndex(p => p.id === selectedPlatformId);
        if (idx !== -1) platformsData[idx] = platformData;
        Storage.savePlatforms(platformsData);
        showToast("Platform updated!");
    } else {
        Storage.addPlatform(platformData);
        platformsData.push(platformData);
        showToast("Platform saved!");
    }
    togglePlatformDetailsModal(false);
    clearPlatformEditingState();
}

function deleteCurrentPlatform() {
    if (!selectedPlatformId) return;
    if (confirm("Delete platform?")) {
        const idx = platformsData.findIndex(p => p.id === selectedPlatformId);
        if (idx !== -1) {
            platformsData.splice(idx, 1);
            Storage.savePlatforms(platformsData);
            showToast("Platform deleted!");
            togglePlatformDetailsModal(false);
            clearPlatformEditingState();
        }
    }
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

function recenterMap() {
    if (!map) return;
    const station = Storage.getStationById(currentStationId);
    if (station) {
        if (platformsData.length > 0 && platformsFeatureGroup.getBounds().isValid()) {
            map.fitBounds(platformsFeatureGroup.getBounds(), { padding: [50, 50], duration: 1.5 });
        } else {
            map.flyTo([station.lat, station.lng], station.zoom || 15, { duration: 1.5 });
        }
    }
}

function recenterToPlatform() {
    if (!editedPlatformLayer) return;
    map.fitBounds(editedPlatformLayer.getBounds(), { padding: [100, 100], duration: 1.5 });
}
