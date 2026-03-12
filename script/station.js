// --- Manage Station Page Logic ---

let currentStation;
let currentStationId;
let drawnItems;
let polygonLayer = null;
let vertexMarkers = [];
let midpointMarkers = [];
let selectedVertexIndex = -1;

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
        document.getElementById('station-name-input').value = currentStation.name;
        document.getElementById('station-code-input').value = currentStation.code;
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
}

function updateHeader(name, code) {
    document.getElementById('header-station-name').innerHTML = `${name} <i class="fa-solid fa-chevron-down text-xs ml-2 text-gray-400 group-hover:text-primary transition-colors"></i>`;
    document.getElementById('header-station-code').innerText = code;
}

window.toggleStationDetailsCard = function() {
    const card = document.getElementById('station-details-card'), backdrop = document.getElementById('station-details-card-backdrop');
    if (card.classList.contains('hidden')) {
        card.classList.remove('hidden'); backdrop.classList.remove('hidden');
        setTimeout(() => { card.classList.remove('scale-95', 'opacity-0'); card.classList.add('scale-100', 'opacity-100'); backdrop.classList.remove('opacity-0'); }, 10);
    } else {
        card.classList.add('scale-95', 'opacity-0');
        setTimeout(() => { card.classList.add('hidden'); backdrop.classList.add('hidden'); }, 300);
    }
}

window.saveStationChangesAndClose = function() {
    const name = document.getElementById('station-name-input').value, code = document.getElementById('station-code-input').value;
    if (!name || !code) { alert("Name and Code are required."); return; }
    if (currentStation) {
        if (saveStationChanges()) { updateHeader(name, code); window.toggleStationDetailsCard(); }
    } else {
        finalizeStationCreation();
    }
}

function finalizeStationCreation() {
    const name = document.getElementById('station-name-input').value, code = document.getElementById('station-code-input').value;
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
        if (polygonLayer) map.removeLayer(polygonLayer);
        polygonLayer = L.polygon(latlngs, { color: '#2563EB', weight: 3, fillOpacity: 0.2 }).addTo(map);
        renderVertices();
    } else {
        startDrawing();
    }
}

function updateLocationDisplay(lat, lng) {
    document.getElementById('lat-display').innerText = parseFloat(lat).toFixed(6);
    document.getElementById('lng-display').innerText = parseFloat(lng).toFixed(6);
}

function saveStationChanges() {
    if (!currentStation) return false;
    currentStation.name = document.getElementById('station-name-input').value;
    currentStation.code = document.getElementById('station-code-input').value;
    const hasPolygon = (polygonLayer !== null) || (drawnItems && drawnItems.getLayers().length > 0);
    if (!hasPolygon) { window.showToast("Add a Polygon First", true); return false; }
    currentStation.zoom = map.getZoom();
    if (polygonLayer) currentStation.geojson = polygonLayer.toGeoJSON();
    else if (drawnItems && drawnItems.getLayers().length > 0) currentStation.geojson = drawnItems.getLayers()[0].toGeoJSON();
    Storage.updateStation(currentStation);
    window.showToast("Station updated successfully!");
    return true;
}

window.updatePolygonButtons = function() {
    const hasPolygon = (polygonLayer !== null) || (drawnItems && drawnItems.getLayers().length > 0);
    const actionBtn = document.getElementById('btn-add-polygon');
    if (actionBtn) {
        actionBtn.classList.remove('hidden');
        const iconContainer = actionBtn.querySelector('div'), icon = actionBtn.querySelector('i'), label = actionBtn.querySelector('span');
        if (hasPolygon) {
            label.innerText = "Reset"; icon.className = "fa-solid fa-rotate-left";
            iconContainer.className = "w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors text-gray-700";
            actionBtn.onclick = window.clearPolygon;
        } else {
            label.innerText = "Add Poly"; icon.className = "fa-solid fa-draw-polygon";
            iconContainer.className = "w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors text-primary";
            actionBtn.onclick = window.addPolygon;
        }
    }
}

window.addPolygon = function() { startDrawing(true); }
window.clearPolygon = function() {
    if (confirm("Clear polygon?")) {
        if (polygonLayer) { map.removeLayer(polygonLayer); polygonLayer = null; }
        if (drawnItems) drawnItems.clearLayers();
        clearMarkers(); window.deselectVertex(); window.updatePolygonButtons();
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
    if (!force && polygonLayer) return;
    const center = map.getCenter();
    const r = 0.002, latlngs = [[center.lat+r, center.lng], [center.lat-r/2, center.lng-r], [center.lat-r/2, center.lng+r]];
    if (polygonLayer) map.removeLayer(polygonLayer);
    polygonLayer = L.polygon(latlngs, { color: '#2563EB', weight: 3, fillOpacity: 0.2 }).addTo(map);
    renderVertices(); window.updatePolygonButtons();
}

function clearMarkers() { vertexMarkers.forEach(m => map.removeLayer(m)); midpointMarkers.forEach(m => map.removeLayer(m)); vertexMarkers = []; midpointMarkers = []; }

function renderVertices() {
    clearMarkers(); if (!polygonLayer) return;
    const latlngs = polygonLayer.getLatLngs()[0];
    latlngs.forEach((latlng, index) => {
        const m = L.marker(latlng, { draggable: true, icon: L.divIcon({ className: 'vertex-marker', html: `<div class="w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-sm hover:scale-125 transition-transform cursor-pointer"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(map);
        m.on('drag', (e) => { latlngs[index] = e.target.getLatLng(); polygonLayer.setLatLngs([latlngs]); updateMidpoints(); });
        m.on('dragend', () => renderVertices());
        m.on('dblclick', (e) => { L.DomEvent.stopPropagation(e); window.selectVertex(index); });
        vertexMarkers.push(m);
    });
    latlngs.forEach((latlng, index) => {
        const next = latlngs[(index + 1) % latlngs.length], mid = [(latlng.lat+next.lat)/2, (latlng.lng+next.lng)/2];
        const mm = L.marker(mid, { icon: L.divIcon({ className: 'midpoint-marker', html: `<div class="w-5 h-5 bg-white text-blue-600 rounded-full shadow border border-blue-100 flex items-center justify-center hover:bg-blue-50 cursor-pointer transition-all transform hover:scale-110"><i class="fa-solid fa-plus text-[10px]"></i></div>`, iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(map);
        mm.on('click', (e) => { L.DomEvent.stopPropagation(e); addVertex(index); });
        midpointMarkers.push(mm);
    });
}

function updateMidpoints() {
    if (!polygonLayer) return;
    const latlngs = polygonLayer.getLatLngs()[0];
    midpointMarkers.forEach((m, i) => { const p1 = latlngs[i], p2 = latlngs[(i+1)%latlngs.length]; m.setLatLng([(p1.lat+p2.lat)/2, (p1.lng+p2.lng)/2]); });
}

function addVertex(idx) {
    const latlngs = polygonLayer.getLatLngs()[0], p1 = latlngs[idx], p2 = latlngs[(idx+1)%latlngs.length];
    latlngs.splice(idx+1, 0, L.latLng((p1.lat+p2.lat)/2, (p1.lng+p2.lng)/2));
    polygonLayer.setLatLngs([latlngs]); renderVertices();
}

window.selectVertex = function(idx) {
    selectedVertexIndex = idx;
    vertexMarkers.forEach((m, i) => {
        const el = m.getElement().querySelector('div');
        if (i === idx) { el.classList.remove('bg-white', 'border-blue-600'); el.classList.add('bg-red-500', 'border-red-600'); }
        else { el.classList.add('bg-white', 'border-blue-600'); el.classList.remove('bg-red-500', 'border-red-600'); }
    });
    const btn = document.getElementById('btn-delete-vertex'); btn.disabled = false; btn.classList.remove('opacity-50', 'cursor-not-allowed');
}

window.deselectVertex = function() {
    selectedVertexIndex = -1;
    vertexMarkers.forEach(m => { const el = m.getElement()?.querySelector('div'); if (el) { el.classList.add('bg-white', 'border-blue-600'); el.classList.remove('bg-red-500', 'border-red-600'); } });
    const btn = document.getElementById('btn-delete-vertex'); btn.disabled = true; btn.classList.add('opacity-50', 'cursor-not-allowed');
}

window.deleteSelectedVertex = function() {
    if (selectedVertexIndex === -1 || !polygonLayer) return;
    const latlngs = polygonLayer.getLatLngs()[0];
    if (latlngs.length <= 3) { alert("Polygon must have at least 3 vertices."); return; }
    latlngs.splice(selectedVertexIndex, 1); polygonLayer.setLatLngs([latlngs]);
    window.deselectVertex(); renderVertices();
}

window.openStationDetailsModal = function() {
    if (!polygonLayer && (!drawnItems || drawnItems.getLayers().length === 0)) { alert("Draw the station area first."); return; }
    const layer = polygonLayer || drawnItems.getLayers()[0], center = layer.getBounds().getCenter();
    document.getElementById('new-station-lat').value = center.lat;
    document.getElementById('new-station-lng').value = center.lng;
    document.getElementById('new-station-zoom').value = map.getZoom();
    window.toggleStationDetailsCard();
    setTimeout(() => document.getElementById('station-name-input').focus(), 100);
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
