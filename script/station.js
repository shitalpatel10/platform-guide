// --- Manage Station Page Logic ---

let currentStation;
let currentStationId;
let drawnItems;
let polygonLayer = null;
let editor = null;

window.initManageStation = function(stationId) {
    const isNew = new URLSearchParams(window.location.search).get('new') === 'true';
    currentStationId = stationId;

    map = L.map('map', { zoomControl: false }).setView([20.5937, 78.9629], 5);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: 'Map data: &copy; OpenStreetMap | Map style: &copy; OpenRailwayMap'
    }).addTo(map);

    editor = new GeometryEditor(map);

    if (isNew) {
        document.getElementById('location-selection-overlay').classList.remove('hidden');
        drawnItems = new L.FeatureGroup().addTo(map);

        map.on(L.Draw.Event.CREATED, function (e) {
            drawnItems.clearLayers();
            const layer = e.layer;
            layer.setStyle({ color: '#2563EB', fillOpacity: 0.2 });
            drawnItems.addLayer(layer);

            if (!window.stationDrawControl) {
                window.stationDrawControl = new L.Control.Draw({
                    draw: false,
                    edit: { featureGroup: drawnItems, remove: false }
                });
                map.addControl(window.stationDrawControl);
            }

            const center = layer.getBounds().getCenter();
            document.getElementById('new-station-lat').value = center.lat;
            document.getElementById('new-station-lng').value = center.lng;
            document.getElementById('new-station-zoom').value = map.getZoom();
        });

    } else {
        currentStation = Storage.getStationById(stationId);
        if (!currentStation) return;

        const managePlatformsLink = document.getElementById('manage-platforms-link');
        if(managePlatformsLink) {
            managePlatformsLink.href = `platform.html?id=${stationId}`;
            managePlatformsLink.classList.remove('hidden');
        }

        const manageServicesLink = document.getElementById('manage-services-link');
        if(manageServicesLink) {
            manageServicesLink.href = `services.html?id=${stationId}`;
            manageServicesLink.classList.remove('hidden');
        }

        map.setView([currentStation.lat, currentStation.lng], currentStation.zoom || 13);
        updateLocationDisplay(currentStation.lat, currentStation.lng);

        if (currentStation.geojson) {
            drawnItems = new L.FeatureGroup().addTo(map);
            const layer = L.geoJSON(currentStation.geojson).getLayers()[0];
            layer.setStyle({ color: '#2563EB', fillOpacity: 0.2 });
            drawnItems.addLayer(layer);
            updateHeader(currentStation.name, currentStation.code);
            enableStationEditing();
        }
    }
    updatePolygonButtons();
    renderSidebar();
}

function updateHeader(name, code) {
    document.getElementById('header-station-name').innerHTML = `${name} <i class="fa-solid fa-chevron-down text-xs ml-2 text-gray-400 group-hover:text-primary transition-colors"></i>`;
    document.getElementById('header-station-code').innerText = code;
}


window.saveStationChangesAndClose = function() {
    const name = document.getElementById('station-name-input-sidebar').value, code = document.getElementById('station-code-input-sidebar').value;
    if (!name || !code) { alert("Name and Code are required."); return; }
    if (currentStation) {
        if (saveStationChanges()) { updateHeader(name, code); }
    } else {
        finalizeStationCreation();
    }
}

function finalizeStationCreation() {
    const name = document.getElementById('station-name-input-sidebar').value, code = document.getElementById('station-code-input-sidebar').value;
    const lat = document.getElementById('new-station-lat').value, lng = document.getElementById('new-station-lng').value, zoom = document.getElementById('new-station-zoom').value;
    if (!name || !code) { alert('Please enter name and code'); return; }
    const hasPolygon = (polygonLayer !== null) || (drawnItems && drawnItems.getLayers().length > 0);
    if (!hasPolygon) { window.showToast("Add a Polygon First", true); return; }

    const newStation = {
        id: Date.now().toString(), name: name, code: code,
        lat: parseFloat(lat), lng: parseFloat(lng), zoom: parseInt(zoom),
        geojson: polygonLayer ? polygonLayer.toGeoJSON() : drawnItems.getLayers()[0].toGeoJSON()
    };
    Storage.addStation(newStation);
    window.location.href = `station.html?id=${newStation.id}`;
}

function enableStationEditing() {
    if (drawnItems && drawnItems.getLayers().length > 0) {
        const layer = drawnItems.getLayers()[0];
        let latlngs = layer.getLatLngs ? layer.getLatLngs() : null;
        if (latlngs && Array.isArray(latlngs[0]) && Array.isArray(latlngs[0][0])) latlngs = latlngs[0];
        
        drawnItems.clearLayers();
        editor.initWithData(latlngs, {
            type: 'polygon',
            color: '#2563EB',
            onUpdate: (lls) => {
                // Update center or other aspects if needed
            }
        });
        polygonLayer = editor.layer;
    } else {
        startDrawing();
    }
}

function updateLocationDisplay(lat, lng) {
    document.getElementById('lat-display').innerText = parseFloat(lat).toFixed(6);
    document.getElementById('lng-display').innerText = parseFloat(lng).toFixed(6);
    
    // Update hidden inputs as well for save logic
    document.getElementById('new-station-lat').value = lat;
    document.getElementById('new-station-lng').value = lng;
}

function saveStationChanges() {
    if (!currentStation) return false;
    currentStation.name = document.getElementById('station-name-input-sidebar').value;
    currentStation.code = document.getElementById('station-code-input-sidebar').value;
    
    const lat = document.getElementById('new-station-lat').value;
    const lng = document.getElementById('new-station-lng').value;
    
    if (lat && lng) {
        currentStation.lat = parseFloat(lat);
        currentStation.lng = parseFloat(lng);
    }

    if (polygonLayer || (editor && editor.layer)) {
         const layer = polygonLayer || editor.layer;
         currentStation.geojson = layer.toGeoJSON();
    }
    else if (drawnItems && drawnItems.getLayers().length > 0) currentStation.geojson = drawnItems.getLayers()[0].toGeoJSON();
    Storage.updateStation(currentStation);
    window.showToast("Station updated successfully!");
    renderSidebar();
    return true;
}

window.updatePolygonButtons = function() {
    const hasPolygon = (polygonLayer !== null) || (drawnItems && drawnItems.getLayers().length > 0);
    const actionBtn = document.getElementById('btn-add-polygon');
    if (actionBtn) {
        actionBtn.classList.remove('hidden');
        const iconContainer = actionBtn.querySelector('div'), icon = actionBtn.querySelector('i'), label = actionBtn.querySelector('span');
        const zoomContainer = document.getElementById('zoom-controls-container');
        
        if (hasPolygon) {
            label.innerText = "Reset"; icon.className = "fa-solid fa-rotate-left";
            iconContainer.className = "w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors text-gray-700";
            actionBtn.onclick = window.clearPolygon;
            if (zoomContainer) zoomContainer.classList.remove('hidden');
        } else {
            label.innerText = "Add Poly"; icon.className = "fa-solid fa-draw-polygon";
            iconContainer.className = "w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors text-primary";
            actionBtn.onclick = window.addPolygon;
            if (zoomContainer) zoomContainer.classList.add('hidden');
        }
    }
}

window.addPolygon = function() { startDrawing(true); }
window.clearPolygon = function() {
    if (confirm("Clear polygon?")) {
        if (editor) editor.reset();
        if (drawnItems) drawnItems.clearLayers();
        polygonLayer = null;
        window.updatePolygonButtons();
    }
}

window.deleteStation = function() {
    if (!currentStation) return;
    if (confirm(`Delete station "${currentStation.name}"?`)) {
        Storage.deleteStation(currentStation.id);
        window.location.href = 'index.html';
    }
}

window.handleSearch = function(event) { if (event.key === 'Enter') window.searchLocation(); }
window.searchLocationWizard = function() { const q = document.getElementById('wizard-search-input').value; if (q) performWizardSearch(q); }
window.selectPredefinedLocation = function(city) {
    const locs = { 'Amravati': { lat: 20.9319, lng: 77.7523 }, 'Badnera': { lat: 20.8677, lng: 77.7348 }, 'Dhamangaon': { lat: 20.7618, lng: 78.1408 }, 'Nagpur': { lat: 21.1458, lng: 79.0882 } };
    if (locs[city]) setupWizardMap(locs[city].lat, locs[city].lng);
}

window.useCurrentLocation = function() {
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => setupWizardMap(p.coords.latitude, p.coords.longitude), () => alert('Could not get location.'));
    else alert('Geolocation not supported.');
}

function performWizardSearch(query) {
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`).then(r => r.json()).then(data => {
        if (data && data.length > 0) setupWizardMap(parseFloat(data[0].lat), parseFloat(data[0].lon));
        else alert('Location not found');
    });
}

function setupWizardMap(lat, lng) {
    map.setView([lat, lng], 15); updateLocationDisplay(lat, lng);
    document.getElementById('location-selection-overlay').classList.add('hidden');
    document.getElementById('drawing-controls').classList.remove('hidden');
    window.updatePolygonButtons();
}

function startDrawing(force) {
    if (!force && (polygonLayer || (editor && editor.layer))) return;
    
    editor.init({
        type: 'polygon',
        color: '#2563EB'
    });
    polygonLayer = editor.layer;
    window.updatePolygonButtons();
}

window.deleteSelectedVertex = function() {
    // This is now handled by double-clicking a vertex in the engine
    window.showToast("Double-click a vertex to delete it");
}

function renderSidebar() {
    const title = document.getElementById('sidebar-title');
    const content = document.getElementById('sidebar-content');
    
    if (!title || !content) return;

    if (currentStation || polygonLayer || (editor && editor.layer)) {
        const name = currentStation ? currentStation.name : (document.getElementById('station-name-input-sidebar')?.value || '');
        const code = currentStation ? currentStation.code : (document.getElementById('header-station-code')?.innerText === '---' ? '' : document.getElementById('header-station-code')?.innerText);

        title.innerHTML = `<i class="fa-solid fa-city text-primary mr-2"></i> Station Workspace`;
        content.innerHTML = `
            <div class="space-y-6 animate-slide-in">
                <div class="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <p class="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Configuration</p>
                    <h3 class="font-bold text-blue-900">${currentStation ? 'Edit Station' : 'Create New Station'}</h3>
                </div>

                <div class="space-y-4">
                    <div>
                        <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Station Name</label>
                        <input type="text" id="station-name-input-sidebar" value="${name}" placeholder="e.g., Howrah Junction"
                            class="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-medium transition-all shadow-sm">
                    </div>

                    <div>
                        <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Station Code</label>
                        <input type="text" id="station-code-input-sidebar" value="${code}" placeholder="e.g., HWH"
                            class="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-mono font-medium transition-all shadow-sm uppercase">
                    </div>
                </div>

                <div class="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                    <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Coordinates</h4>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="bg-white p-2 rounded-lg border border-gray-100">
                            <p class="text-[9px] text-gray-400 uppercase font-bold">Lat</p>
                            <p id="lat-display-sidebar" class="text-xs font-mono font-bold text-gray-700">${document.getElementById('lat-display')?.innerText || '-'}</p>
                        </div>
                        <div class="bg-white p-2 rounded-lg border border-gray-100">
                            <p class="text-[9px] text-gray-400 uppercase font-bold">Lng</p>
                            <p id="lng-display-sidebar" class="text-xs font-mono font-bold text-gray-700">${document.getElementById('lng-display')?.innerText || '-'}</p>
                        </div>
                    </div>
                </div>

                <div class="pt-2 space-y-3">
                    <button onclick="saveStationChangesAndClose()" class="w-full py-3 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-secondary transition-all flex items-center justify-center">
                        <i class="fa-solid fa-cloud-arrow-up mr-2"></i> Save & Sync Station
                    </button>
                    
                    ${currentStation ? `
                    <div class="flex space-x-2">
                        <button onclick="deleteStation()" class="w-full py-2 bg-white text-red-500 border border-red-50 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors">
                            <i class="fa-solid fa-trash-can mr-1"></i> Delete Station
                        </button>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
}

// Intercept updateLocationDisplay to update sidebar too
const originalUpdateLocationDisplay = window.updateLocationDisplay;
window.updateLocationDisplay = function(lat, lng) {
    if(originalUpdateLocationDisplay) originalUpdateLocationDisplay(lat, lng);
    const latSd = document.getElementById('lat-display-sidebar');
    const lngSd = document.getElementById('lng-display-sidebar');
    if (latSd) latSd.innerText = parseFloat(lat).toFixed(6);
    if (lngSd) lngSd.innerText = parseFloat(lng).toFixed(6);
};

window.openStationDetailsModal = function() {
    saveStationChangesAndClose();
}

window.searchLocation = function() {
    const q = document.getElementById('location-search').value; if (!q) return;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`).then(r => r.json()).then(data => {
        if (data && data.length > 0) { const lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon); map.setView([lat, lon], 15); updateLocationDisplay(lat, lon); }
        else alert('Location not found');
    });
}

window.showToast = function(msg, isErr = false) {
    const t = document.createElement('div');
    t.className = `fixed bottom-5 right-5 ${isErr ? 'bg-red-600' : 'bg-green-600'} text-white px-6 py-3 rounded-lg shadow-lg z-[4000] transition-all transform translate-y-10 opacity-0 text-sm font-medium`;
    t.innerHTML = `<i class="fa-solid ${isErr ? 'fa-triangle-exclamation' : 'fa-check'} mr-2"></i> ${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.classList.remove('translate-y-10', 'opacity-0'), 100);
    setTimeout(() => { t.classList.add('translate-y-10', 'opacity-0'); setTimeout(() => t.remove(), 300); }, 3000);
}
