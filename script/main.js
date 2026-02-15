// Main JavaScript File

// --- Data Management ---
const Storage = {
    getStations: () => JSON.parse(localStorage.getItem('stations')) || [],
    saveStations: (stations) => localStorage.setItem('stations', JSON.stringify(stations)),

    getPlatforms: () => JSON.parse(localStorage.getItem('platforms')) || [],
    savePlatforms: (platforms) => localStorage.setItem('platforms', JSON.stringify(platforms)),

    addStation: (station) => {
        const stations = Storage.getStations();
        stations.push(station);
        Storage.saveStations(stations);
    },

    updateStation: (updatedStation) => {
        let stations = Storage.getStations();
        const index = stations.findIndex(s => s.id === updatedStation.id);
        if (index !== -1) {
            stations[index] = updatedStation;
            Storage.saveStations(stations);
        }
    },

    deleteStation: (id) => {
        let stations = Storage.getStations();
        const newStations = stations.filter(s => s.id !== id);
        Storage.saveStations(newStations);
    },

    getStationById: (id) => Storage.getStations().find(s => s.id === id),

    addPlatform: (platform) => {
        const platforms = Storage.getPlatforms();
        platforms.push(platform);
        Storage.savePlatforms(platforms);
    },

    getPlatformsByStationId: (stationId) => Storage.getPlatforms().filter(p => p.stationId === stationId),

    clearAll: () => {
        if (confirm('Are you sure you want to delete all data? This cannot be undone.')) {
            localStorage.clear();
            location.reload();
        }
    }
};

// --- Home Page Logic ---
function initHomePage() {
    const grid = document.getElementById('station-grid');
    const emptyState = document.getElementById('empty-state');
    const stations = Storage.getStations();

    if (stations.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        grid.innerHTML = '';
        stations.forEach(station => {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-xl shadow-sm border border-gray-100 p-6 station-card flex flex-col justify-between h-48 relative overflow-hidden group cursor-pointer hover:border-primary/30 transition-all';
            card.onclick = (e) => {
                // Prevent navigation if clicking on buttons inside
                if (e.target.closest('a') || e.target.closest('button')) return;
                window.location.href = `station.html?id=${station.id}`;
            };

            card.innerHTML = `
                <div class="absolute right-6 top-6 text-gray-300 group-hover:text-primary transition-colors">
                    <i class="fa-solid fa-chevron-right text-xl"></i>
                </div>

                <div>
                    <div class="flex items-center space-x-3 mb-2">
                        <div class="w-10 h-10 rounded-lg bg-blue-50 text-primary flex items-center justify-center">
                            <i class="fa-solid fa-train-subway text-lg"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold text-gray-900 leading-tight">${station.name}</h3>
                            <span class="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">${station.code}</span>
                        </div>
                    </div>
                </div>

                <div class="flex space-x-2 mt-4 pt-4 border-t border-gray-50">
                    <button onclick="deleteStationFromIndex('${station.id}', event)" class="px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-50 hover:border-red-100 group-hover:border-red-200" title="Delete Station">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                    <a href="platform.html?id=${station.id}" onclick="event.stopPropagation()" class="flex-1 text-center px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-secondary rounded-lg transition-colors shadow-sm">
                        Manage Platforms
                    </a>
                </div>
            `;
            grid.appendChild(card);
        });
    }
}

function openAddStationModal() {
    const modal = document.getElementById('add-station-modal');
    modal.classList.remove('hidden');
    // small delay for transition
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('modal-content').classList.remove('scale-95');
        document.getElementById('modal-content').classList.add('scale-100');
    }, 10);
}

function deleteStationFromIndex(id, event) {
    event.stopPropagation();
    const station = Storage.getStationById(id);
    if (confirm(`Are you sure you want to delete station "${station.name}"? This action cannot be undone.`)) {
        Storage.deleteStation(id);
        initHomePage(); // Re-render to update UI
    }
}

function closeAddStationModal() {
    const modal = document.getElementById('add-station-modal');
    modal.classList.add('opacity-0');
    document.getElementById('modal-content').classList.remove('scale-100');
    document.getElementById('modal-content').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function saveNewStation() {
    const name = document.getElementById('station-name').value;
    const code = document.getElementById('station-code').value;

    if (!name || !code) {
        alert('Please fill in need fields');
        return;
    }

    const newStation = {
        id: Date.now().toString(),
        name: name,
        code: code,
        lat: 51.505, // Default London
        lng: -0.09,
        zoom: 13
    };

    Storage.addStation(newStation);
    closeAddStationModal();
    location.reload(); // Refresh to show new station
}

function deleteStation(id) {
    if (confirm('Delete this station?')) {
        let stations = Storage.getStations().filter(s => s.id !== id);
        Storage.saveStations(stations);
        location.reload();
    }
}

function clearAllData() {
    Storage.clearAll();
}

// --- Manage Station Page Logic ---
// --- Manage Station Page Logic ---
let map;
let currentStation;

function initManageStation(stationId) {
    const isNew = new URLSearchParams(window.location.search).get('new') === 'true';

    // Init Map (Default View)
    map = L.map('map', { zoomControl: false }).setView([20.5937, 78.9629], 5); // India view

    // Base Layer: CartoDB Positron (Clean)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    // Overlay: OpenRailwayMap
    L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: 'Map data: &copy; OpenStreetMap | Map style: &copy; OpenRailwayMap'
    }).addTo(map);

    if (isNew) {
        // Wizard Mode
        document.querySelector('.control-panel').classList.add('hidden');
        document.querySelector('.search-panel').classList.add('hidden');
        document.getElementById('location-selection-overlay').classList.remove('hidden');

        // Init FeatureGroup for drawing
        drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        // Setup Draw Events
        map.on(L.Draw.Event.CREATED, function (e) {
            drawnItems.clearLayers(); // Only one station area allowed
            const layer = e.layer;
            layer.setStyle({ color: '#2563EB', fillOpacity: 0.2 });
            drawnItems.addLayer(layer);

            // Enable editing immediately
            // layer.editing.enable() is not directly available on standard L.Draw.Rectangle creation
            // We need to re-add it as an editable layer to the FeatureGroup that the Draw Control is linked to
            // But wait, our 'drawControl' is not initialized in 'initManageStation' yet!
            // We only initialized `drawnItems`.

            // To allow editing, we need the Edit Toolbar or enable editing on the layer manually.
            // Let's add the Edit Toolbar to the map for this mode too, or just enable editing programmatically.
            // Simple approach: Add L.Control.Draw with edit handler.

            if (!window.stationDrawControl) {
                window.stationDrawControl = new L.Control.Draw({
                    draw: false,
                    edit: {
                        featureGroup: drawnItems,
                        remove: false // We have our own clear button
                    }
                });
                map.addControl(window.stationDrawControl);
            }

            // Open Modal
            // Open Modal - REMOVED (User must click Save button)
            // document.getElementById('station-details-modal').classList.remove('hidden');

            // Auto-fill hidden geo fields
            const center = layer.getBounds().getCenter();
            document.getElementById('new-station-lat').value = center.lat;
            document.getElementById('new-station-lng').value = center.lng;
            document.getElementById('new-station-zoom').value = map.getZoom();
        });

    } else {
        // Edit Mode
        currentStation = Storage.getStationById(stationId);
        if (!currentStation) return;

        // Show Manage Platforms Button
        const manageLink = document.getElementById('manage-platforms-link');
        manageLink.href = `platform.html?id=${stationId}`;
        manageLink.classList.remove('hidden');

        // Show Edit Station Button - REMOVED
        // document.getElementById('btn-edit-station').classList.remove('hidden');

        map.setView([currentStation.lat, currentStation.lng], currentStation.zoom || 13);

        // Populate Fields (Disabled by default)
        const nameInput = document.getElementById('station-name-input');
        const codeInput = document.getElementById('station-code-input');
        nameInput.value = currentStation.name;
        codeInput.value = currentStation.code;
        // nameInput.disabled = true; // Always editable
        // codeInput.disabled = true; // Always editable

        updateLocationDisplay(currentStation.lat, currentStation.lng);

        updateLocationDisplay(currentStation.lat, currentStation.lng);

        // Marker removed as per request
        // Map center is enough or polygon


        // Show Existing Station Shape if exists (Static initially)
        if (currentStation.geojson) {
            drawnItems = new L.FeatureGroup();
            map.addLayer(drawnItems);
            const layer = L.geoJSON(currentStation.geojson).getLayers()[0];
            layer.setStyle({ color: '#2563EB', fillOpacity: 0.2 });
            drawnItems.addLayer(layer);

            // Initial Header Update
            updateHeader(currentStation.name, currentStation.code);

            // Enable Editing Immediately
            enableStationEditing();
        } else {
            // Should not happen for existing station, but if so:
            // startDrawing(); // Logic change: Don't auto-start. Let user click Add.
            updatePolygonButtons();
        }
    }
    updatePolygonButtons();
}

function updateHeader(name, code) {
    document.getElementById('header-station-name').innerHTML = `${name} <i class="fa-solid fa-chevron-down text-xs ml-2 text-gray-400 group-hover:text-primary transition-colors"></i>`;
    document.getElementById('header-station-code').innerText = code;
}

function toggleStationDetailsCard() {
    const card = document.getElementById('station-details-card');
    const backdrop = document.getElementById('station-details-card-backdrop');

    if (card.classList.contains('hidden')) {
        // Open
        card.classList.remove('hidden');
        backdrop.classList.remove('hidden');
        // Small delay for transition
        setTimeout(() => {
            card.classList.remove('scale-95', 'opacity-0');
            card.classList.add('scale-100', 'opacity-100');
            backdrop.classList.remove('opacity-0'); // backdrop needs opacity class if we want transition
        }, 10);
    } else {
        // Close
        card.classList.add('scale-95', 'opacity-0');
        // backdrop.classList.add('opacity-0');
        setTimeout(() => {
            card.classList.add('hidden');
            backdrop.classList.add('hidden');
        }, 300);
    }
}

function saveStationChangesAndClose() {
    // Save logic
    const name = document.getElementById('station-name-input').value;
    const code = document.getElementById('station-code-input').value;

    if (!name || !code) {
        alert("Name and Code are required.");
        return;
    }



    // If currentStation exists, update it.
    if (currentStation) {
        if (saveStationChanges()) {
            updateHeader(name, code);
            toggleStationDetailsCard();
            return;
        } else {
            return;
        }
    } else {
        // We are likely in that "finalizing new station" phase (wizard)
        if (finalizeStationCreationRefactored()) {
            // finalize handles its own redirects/close
        }
        return;
    }
}

function finalizeStationCreationRefactored() {
    const name = document.getElementById('station-name-input').value;
    const code = document.getElementById('station-code-input').value;
    const lat = document.getElementById('new-station-lat').value;
    const lng = document.getElementById('new-station-lng').value;
    const zoom = document.getElementById('new-station-zoom').value;

    if (!name || !code) { alert('Please enter name and code'); return false; }

    // Validation: Check if polygon exists
    const hasPolygon = (polygonLayer !== null) || (typeof drawnItems !== 'undefined' && drawnItems.getLayers().length > 0);
    if (!hasPolygon) {
        // Show Toast
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-5 right-5 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-[3000] flex items-center transition-all duration-300 transform translate-y-10 opacity-0';
        toast.innerHTML = '<i class="fa-solid fa-triangle-exclamation mr-2"></i> Add a Polygon First';
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 100);
        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
        return false;
    }

    const newStation = {
        id: Date.now().toString(),
        name: name,
        code: code,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        zoom: parseInt(zoom),
        geojson: polygonLayer ? polygonLayer.toGeoJSON() : null
    };

    Storage.addStation(newStation);
    alert('Station created!');
    window.location.href = `station.html?id=${newStation.id}`;
    return true;
}

function enableStationEditing() {
    // Enable Inputs
    document.getElementById('station-name-input').disabled = false;
    document.getElementById('station-code-input').disabled = false;

    // Enable Marker Drag - REMOVED

    // Enable Shape Editing
    // Enable Shape Editing
    // Convert existing static drawing to editable polygon
    if (drawnItems && drawnItems.getLayers().length > 0) {
        const layer = drawnItems.getLayers()[0];
        // Need to extract coordinates
        let latlngs;
        if (layer.getLatLngs) {
            latlngs = layer.getLatLngs();
            // Handle nested arrays (GeoJSON multipolygon or simple polygon)
            // L.Polygon.getLatLngs() returns [ [p1, p2, p3] ] for simple polygon
            if (Array.isArray(latlngs[0]) && Array.isArray(latlngs[0][0]) && typeof latlngs[0][0][0] !== 'number') {
                // It's a MultiPolygon or Polygon with holes, complicate.
                // Assuming simple polygon for this MVP as per previous rectangle logic.
                // StartDrawing creates simple polygon.
                latlngs = latlngs[0];
            }
            // However, L.geoJSON might create a Multipolygon?
            // If we saved a simple polygon, it should be fine.

            // If it was a rectangle (from old version), it has latlngs.
        } else {
            // Fallback
            return;
        }

        // Clear static
        drawnItems.clearLayers();

        // set global polygonLayer
        if (polygonLayer) map.removeLayer(polygonLayer);

        polygonLayer = L.polygon(latlngs, {
            color: '#2563EB',
            weight: 3,
            fillOpacity: 0.2
        }).addTo(map);

        renderVertices();
    } else if (currentStation && currentStation.geojson) {
        // If currentStation has geojson but it's not in drawnItems (e.g., first edit)
        // This case should ideally be handled by the drawnItems check above if initManageStation loads it.
        // But as a fallback or for different flows, we could re-create polygonLayer from currentStation.geojson here.
        // For now, assuming drawnItems will contain it if it exists.
    } else {
        // If no shape, start drawing
        startDrawing();
    }

    // Toggle Buttons - REMOVED headers buttons
    // document.getElementById('btn-edit-station').classList.add('hidden');
    // document.getElementById('btn-save-station').classList.remove('hidden');
}

function disableStationEditing() {
    // Disable Inputs
    document.getElementById('station-name-input').disabled = true;
    document.getElementById('station-code-input').disabled = true;

    // Disable Marker Drag - REMOVED

    // Disable Shape Editing
    // Disable Shape Editing
    clearMarkers();
    deselectVertex();

    // Convert editable polygon back to static in drawnItems if needed for view mode consistecy
    if (polygonLayer) {
        // Update currentStation locally? No, save does that.
        // Just move to drawnItems for consistency
        const latlngs = polygonLayer.getLatLngs();
        map.removeLayer(polygonLayer);
        polygonLayer = null;
        // document.getElementById('btn-draw').classList.add('text-primary'); // Removed calc dependency

        if (drawnItems) {
            drawnItems.clearLayers();
            const layer = L.polygon(latlngs, { color: '#2563EB', fillOpacity: 0.2 });
            drawnItems.addLayer(layer);
            map.addLayer(drawnItems);
        }
    }

    if (window.stationDrawControl) {
        map.removeControl(window.stationDrawControl);
        window.stationDrawControl = null;
    }

    // Toggle Buttons - Removed Draw/Move buttons
    // document.getElementById('btn-draw').classList.add('bg-blue-50', 'text-primary', 'border-primary');
    // document.getElementById('btn-move').classList.remove('bg-blue-50', 'text-primary', 'border-primary');
}





function updateLocationDisplay(lat, lng) {
    document.getElementById('lat-display').innerText = parseFloat(lat).toFixed(6);
    document.getElementById('lng-display').innerText = parseFloat(lng).toFixed(6);
}

function saveStationChanges() {
    if (!currentStation) return;

    currentStation.name = document.getElementById('station-name-input').value;
    currentStation.code = document.getElementById('station-code-input').value;

    // Validation: Check if polygon exists
    const hasPolygon = (polygonLayer !== null) || (typeof drawnItems !== 'undefined' && drawnItems.getLayers().length > 0);
    if (!hasPolygon) {
        // Show Toast
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-5 right-5 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-[3000] flex items-center transition-all duration-300 transform translate-y-10 opacity-0';
        toast.innerHTML = '<i class="fa-solid fa-triangle-exclamation mr-2"></i> Add a Polygon First';
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 100);
        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
        return false;
    }

    currentStation.zoom = map.getZoom();

    Storage.updateStation(currentStation);

    // If we have a shape drawn in edit mode (we need to handle saving that too)
    // But currently `saveStationChanges` is for the "old" edit mode (name/code/marker).
    // The requirement says "after saving the station ... station shape not visible".
    // This implies we should be able to update shape too.

    // Check if we have drawnItems and update geojson
    // Check if we have drawnItems and update geojson
    if (polygonLayer) {
        currentStation.geojson = polygonLayer.toGeoJSON();
        Storage.updateStation(currentStation);
    } else if (typeof drawnItems !== 'undefined' && drawnItems.getLayers().length > 0) {
        const layer = drawnItems.getLayers()[0];
        currentStation.geojson = layer.toGeoJSON();
        Storage.updateStation(currentStation);
    }

    // Revert to View Mode - REMOVED (Always Editable)
    // disableStationEditing();

    // Show success feedback (simple alert for now, could be toast)
    // We can't use the button because it's now hidden! Let's show a global toast or just alert.
    // Or we keep the button visible for a second.
    // For now, simple alert or reusing the toast logic if we had a toast container.
    // Let's just create a temp toast.

    const toast = document.createElement('div');
    toast.className = 'fixed bottom-5 right-5 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-[3000] flex items-center transition-all duration-300 transform translate-y-10 opacity-0';
    toast.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Station updated successfully!';
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 100);

    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);

    return true;
}


// --- Polygon Visibility Logic ---
function updatePolygonButtons() {
    const hasPolygon = (polygonLayer !== null) || (typeof drawnItems !== 'undefined' && drawnItems.getLayers().length > 0);
    const addBtn = document.getElementById('btn-add-polygon');
    const clearBtn = document.getElementById('btn-clear-polygon');

    // Only update if elements exist (might not be on station.html)
    if (addBtn && clearBtn) {
        if (hasPolygon) {
            addBtn.classList.add('hidden');
            clearBtn.classList.remove('hidden');
        } else {
            addBtn.classList.remove('hidden');
            clearBtn.classList.add('hidden');
        }
    }
}

function addPolygon() {
    startDrawing(true);
}

function clearPolygon() {
    if (confirm("Are you sure you want to clear the polygon?")) {
        // Clear all layers
        if (polygonLayer) {
            map.removeLayer(polygonLayer);
            polygonLayer = null;
        }
        if (typeof drawnItems !== 'undefined') {
            drawnItems.clearLayers();
        }

        // Clear markers
        clearMarkers();

        // Deselect any selected vertex
        selectedVertexIndex = -1;
        const deleteBtn = document.getElementById('btn-delete-vertex');
        if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }

        updatePolygonButtons();
    }
}

function deleteStation() {
    if (!currentStation) return;

    if (confirm(`Are you sure you want to delete station "${currentStation.name}"? This action cannot be undone.`)) {
        Storage.deleteStation(currentStation.id);
        // Also delete associated platforms if needed, but for now just station
        alert('Station deleted successfully.');
        window.location.href = 'index.html';
    }
}

function handleSearch(event) {
    if (event.key === 'Enter') {
        searchLocation();
    }
}

// --- Manage Station Page Logic ---

// ... (searchLocation is kept, but we add wizard functions)

function searchLocationWizard() {
    const query = document.getElementById('wizard-search-input').value;
    if (!query) return;
    performWizardSearch(query);
}

function selectPredefinedLocation(city) {
    const locations = {
        'Amravati': { lat: 20.9319, lng: 77.7523 },
        'Badnera': { lat: 20.8677, lng: 77.7348 },
        'Dhamangaon': { lat: 20.7618, lng: 78.1408 },
        'Nagpur': { lat: 21.1458, lng: 79.0882 }
    };

    const loc = locations[city];
    if (loc) {
        setupWizardMap(loc.lat, loc.lng);
    }
}

function useCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            setupWizardMap(position.coords.latitude, position.coords.longitude);
        }, () => {
            alert('Could not get your location.');
        });
    } else {
        alert('Geolocation is not supported by this browser.');
    }
}

function performWizardSearch(query) {
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                setupWizardMap(lat, lon);
            } else {
                alert('Location not found');
            }
        });
}

function setupWizardMap(lat, lng) {
    map.setView([lat, lng], 15);
    // Hide overlay, show controls
    document.getElementById('location-selection-overlay').classList.add('hidden');
    document.getElementById('drawing-controls').classList.remove('hidden');

    // Automatically start drawing
    // startDrawing(); // Logic change: Don't auto-start. Let user click Add.
    updatePolygonButtons();
}

// --- Custom Polygon Drawing & Editing ---
let polygonLayer = null;
let vertexMarkers = [];
let midpointMarkers = [];
let selectedVertexIndex = -1;

function startDrawing(force) {
    // If polygon exists, just ensure it's editable
    if (!force && polygonLayer) return;

    // Create initial triangle in center of view
    const center = map.getCenter();
    const r = 0.002; // Roughly 200m
    const p1 = [center.lat + r, center.lng];
    const p2 = [center.lat - r / 2, center.lng - r];
    const p3 = [center.lat - r / 2, center.lng + r];
    const latlngs = [p1, p2, p3];

    polygonLayer = L.polygon(latlngs, {
        color: '#2563EB',
        weight: 3,
        fillOpacity: 0.2
    }).addTo(map);

    // Sync with global drawnItems if used
    if (typeof drawnItems !== 'undefined') {
        drawnItems.clearLayers();
        drawnItems.addLayer(polygonLayer);
    }

    renderVertices();
    document.getElementById('btn-draw').classList.add('text-primary');

    updatePolygonButtons();
}

function stopDrawing() {
    // "Move" mode - effectively just deselect vertex deletion
    deselectVertex();
    document.getElementById('btn-draw').classList.remove('text-primary');
}

function clearDrawing() {
    if (polygonLayer) {
        map.removeLayer(polygonLayer);
        polygonLayer = null;
    }
    if (drawnItems) drawnItems.clearLayers();

    clearMarkers();
    deselectVertex();
    clearMarkers();
    deselectVertex();
    // document.getElementById('station-details-modal').classList.add('hidden'); // Old modal
}

function clearMarkers() {
    vertexMarkers.forEach(m => map.removeLayer(m));
    midpointMarkers.forEach(m => map.removeLayer(m));
    vertexMarkers = [];
    midpointMarkers = [];
}

function renderVertices() {
    clearMarkers();
    if (!polygonLayer) return;

    const latlngs = polygonLayer.getLatLngs()[0]; // Outer ring

    // 1. Create Handle Markers (Vertices)
    latlngs.forEach((latlng, index) => {
        const marker = L.marker(latlng, {
            draggable: true,
            icon: L.divIcon({
                className: 'vertex-marker',
                html: `<div class="w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-sm hover:scale-125 transition-transform cursor-pointer"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        }).addTo(map);

        marker.on('drag', (e) => {
            const newPos = e.target.getLatLng();
            latlngs[index] = newPos;
            polygonLayer.setLatLngs([latlngs]);
            updateMidpoints(); // Real-time update of midpoints
        });

        marker.on('dragend', () => {
            renderVertices(); // Full re-render to ensure clean state
        });

        marker.on('dblclick', (e) => {
            L.DomEvent.stopPropagation(e); // Prevent map zoom
            selectVertex(index);
        });

        // Mobile tap support for selection? 
        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            // Maybe single click to select? The requirement says "double clicked".
        });

        vertexMarkers.push(marker);
    });

    // 2. Create Edge Splitters (Midpoints)
    latlngs.forEach((latlng, index) => {
        const nextIndex = (index + 1) % latlngs.length;
        const nextLatlng = latlngs[nextIndex];

        const midLat = (latlng.lat + nextLatlng.lat) / 2;
        const midLng = (latlng.lng + nextLatlng.lng) / 2;

        const midMarker = L.marker([midLat, midLng], {
            draggable: false, // It becomes a vertex on click
            icon: L.divIcon({
                className: 'midpoint-marker',
                html: `<div class="w-5 h-5 bg-white text-blue-600 rounded-full shadow border border-blue-100 flex items-center justify-center hover:bg-blue-50 cursor-pointer transition-all transform hover:scale-110" title="Add Vertex">
                        <i class="fa-solid fa-plus text-[10px]"></i>
                       </div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(map);

        midMarker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            addVertex(index);
        });

        midpointMarkers.push(midMarker);
    });
}

function updateMidpoints() {
    // Lightweight update for dragging
    if (!polygonLayer) return;
    const latlngs = polygonLayer.getLatLngs()[0];

    midpointMarkers.forEach((marker, index) => {
        const nextIndex = (index + 1) % latlngs.length;
        const p1 = latlngs[index];
        const p2 = latlngs[nextIndex];
        marker.setLatLng([(p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2]);
    });
}

function addVertex(afterIndex) {
    const latlngs = polygonLayer.getLatLngs()[0];
    const p1 = latlngs[afterIndex];
    const p2 = latlngs[(afterIndex + 1) % latlngs.length];

    const newPoint = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);

    // Insert new point
    latlngs.splice(afterIndex + 1, 0, newPoint);
    polygonLayer.setLatLngs([latlngs]);

    renderVertices();
}

function selectVertex(index) {
    selectedVertexIndex = index;

    // Highlight marker
    vertexMarkers.forEach((m, i) => {
        const el = m.getElement().querySelector('div');
        if (i === index) {
            el.classList.remove('bg-white', 'border-blue-600');
            el.classList.add('bg-red-500', 'border-red-600');
        } else {
            el.classList.add('bg-white', 'border-blue-600');
            el.classList.remove('bg-red-500', 'border-red-600');
        }
    });

    // Show delete button
    const btn = document.getElementById('btn-delete-vertex');
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
    // btn.classList.remove('hidden', 'scale-95', 'opacity-0');
    // btn.classList.add('scale-100', 'opacity-100');
}

function deselectVertex() {
    selectedVertexIndex = -1;

    // Reset marker styles
    vertexMarkers.forEach(m => {
        if (!m.getElement()) return;
        const el = m.getElement().querySelector('div');
        el.classList.add('bg-white', 'border-blue-600');
        el.classList.remove('bg-red-500', 'border-red-600');
    });

    // Hide delete button
    const btn = document.getElementById('btn-delete-vertex');
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    // btn.classList.add('scale-95', 'opacity-0');
    // setTimeout(() => btn.classList.add('hidden'), 300);
}

function deleteSelectedVertex() {
    if (selectedVertexIndex === -1 || !polygonLayer) return;

    const latlngs = polygonLayer.getLatLngs()[0];

    if (latlngs.length <= 3) {
        alert("A polygon must have at least 3 vertices.");
        return;
    }

    latlngs.splice(selectedVertexIndex, 1);
    polygonLayer.setLatLngs([latlngs]);

    deselectVertex();
    renderVertices();
}

function openStationDetailsModal() {
    if ((!drawnItems || drawnItems.getLayers().length === 0) && !polygonLayer) {
        alert("Please draw the station area first.");
        return;
    }

    const layer = polygonLayer || drawnItems.getLayers()[0];
    const center = layer.getBounds().getCenter();

    // Set hidden fields for "New" mode
    document.getElementById('new-station-lat').value = center.lat;
    document.getElementById('new-station-lng').value = center.lng;
    document.getElementById('new-station-zoom').value = map.getZoom();

    // Open the NEW modal
    toggleStationDetailsCard();

    // Focus name
    setTimeout(() => document.getElementById('station-name-input').focus(), 100);
}



// original searchLocation logic ...
function searchLocation() {
    const query = document.getElementById('location-search').value;
    if (!query) return;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                map.setView([lat, lon], 15);
                // marker.setLatLng([lat, lon]); // Marker removed
                updateLocationDisplay(lat, lon);
            } else {
                alert('Location not found');
            }
        });
}


// --- Manage Platforms Page Logic ---
let drawControl;
let drawnItems;

function initManagePlatforms(stationId) {
    const station = Storage.getStationById(stationId);
    if (!station) return;

    document.getElementById('station-name-header').innerText = station.name;

    // Init Map
    map = L.map('map', { zoomControl: false }).setView([station.lat, station.lng], station.zoom || 15);

    // Base Layer: CartoDB Positron (Clean)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    // Overlay: OpenRailwayMap
    L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: 'Map data: &copy; OpenStreetMap | Map style: &copy; OpenRailwayMap'
    }).addTo(map);

    // FeatureGroup is to store editable layers
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Initialise Draw Control
    drawControl = new L.Control.Draw({
        draw: {
            polyline: false,
            circle: false,
            marker: false,
            circlemarker: false,
            polygon: {
                allowIntersection: false,
                drawError: {
                    color: '#e1e100', // Color the shape will turn when intersects
                    message: '<strong>Oh snap!<strong> you can\'t draw that!' // Message that will show when intersect
                },
                shapeOptions: {
                    color: '#2563EB'
                }
            },
            rectangle: {
                shapeOptions: {
                    color: '#2563EB'
                }
            }
        },
        edit: {
            featureGroup: drawnItems
        }
    });
    map.addControl(drawControl);

    // Load existing platforms
    const platforms = Storage.getPlatformsByStationId(stationId);
    platforms.forEach(p => {
        const layer = L.geoJSON(p.geojson).getLayers()[0];
        // add ID to layer so we can identify it later
        layer.feature = layer.feature || {};
        layer.feature.properties = layer.feature.properties || {};
        layer.feature.properties.id = p.id;
        layer.feature.properties.name = p.name;

        drawnItems.addLayer(layer);
        addPlatformToList(p);
    });

    // Handle Created Event
    map.on(L.Draw.Event.CREATED, function (e) {
        const type = e.layerType;
        const layer = e.layer;

        // Ensure proper styling
        layer.setStyle({ color: '#2563EB' });

        // Add to map
        drawnItems.addLayer(layer);

        // Ask for name
        const name = prompt("Enter platform name/number:", "Platform " + (drawnItems.getLayers().length));
        if (name) {
            const newPlatform = {
                id: Date.now().toString(),
                stationId: stationId,
                name: name,
                geojson: layer.toGeoJSON()
            };

            // Assign ID to layer for syncing
            layer.feature = layer.feature || {};
            layer.feature.properties = layer.feature.properties || {};
            layer.feature.properties.id = newPlatform.id;
            layer.feature.properties.name = name;

            Storage.addPlatform(newPlatform);
            addPlatformToList(newPlatform);
        } else {
            drawnItems.removeLayer(layer); // User cancelled
        }
    });

    // Handle Edited/Deleted Events (Sync with Storage)
    map.on(L.Draw.Event.EDITED, function (e) {
        // This is complex because we need to update geojSON in storage for matches
        e.layers.eachLayer(function (layer) {
            updatePlatformInStorage(layer);
        });
    });

    map.on(L.Draw.Event.DELETED, function (e) {
        e.layers.eachLayer(function (layer) {
            removePlatformFromStorage(layer);
            // Also remove from list UI
            const id = layer.feature?.properties?.id;
            if (id) {
                const item = document.getElementById(`platform-item-${id}`);
                if (item) item.remove();
            }
        });
    });

    // Show toast hint
    const toast = document.getElementById('toast');
    setTimeout(() => {
        toast.classList.remove('opacity-0', 'translate-y-10');
    }, 1000);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-10');
    }, 5000);
}

function addPlatformToList(platform) {
    const list = document.getElementById('platform-items');
    // Remove empty state if present
    if (list.querySelector('.text-gray-400')) {
        list.innerHTML = '';
    }

    const div = document.createElement('div');
    div.id = `platform-item-${platform.id}`;
    div.className = "flex justify-between items-center p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm group";
    div.innerHTML = `
        <span class="font-medium text-gray-700"><i class="fa-solid fa-vector-square mr-2 text-primary/70"></i>${platform.name}</span>
        <button onclick="zoomToPlatform('${platform.id}')" class="text-gray-400 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            <i class="fa-solid fa-crosshairs"></i>
        </button>
    `;
    list.appendChild(div);
}

function updatePlatformInStorage(layer) {
    const id = layer.feature?.properties?.id;
    if (!id) return;

    const platforms = Storage.getPlatforms();
    const index = platforms.findIndex(p => p.id === id);
    if (index !== -1) {
        platforms[index].geojson = layer.toGeoJSON();
        Storage.savePlatforms(platforms);
    }
}

function removePlatformFromStorage(layer) {
    const id = layer.feature?.properties?.id;
    if (!id) return;

    let platforms = Storage.getPlatforms();
    platforms = platforms.filter(p => p.id !== id);
    Storage.savePlatforms(platforms);
}

function zoomToPlatform(id) {
    drawnItems.eachLayer(function (layer) {
        if (layer.feature?.properties?.id === id) {
            map.fitBounds(layer.getBounds());
        }
    });
}
function savePlatformChanges() {
    const btn = document.querySelector('button[onclick="savePlatformChanges()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Saved!';
    btn.classList.add('bg-green-600', 'hover:bg-green-700');
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove('bg-green-600', 'hover:bg-green-700');
    }, 2000);
}


// --- Init based on page ---
if (document.getElementById('station-grid')) {
    initHomePage();
}
