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
        stations.forEach(station => {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-xl shadow-sm border border-gray-100 p-6 station-card flex flex-col justify-between h-48 relative overflow-hidden group';
            card.innerHTML = `
                <div class="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="deleteStation('${station.id}')" class="text-red-400 hover:text-red-600 transition-colors" title="Delete Station">
                        <i class="fa-solid fa-trash"></i>
                    </button>
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
                    <a href="station.html?id=${station.id}" class="flex-1 text-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:text-primary hover:border-primary/30 rounded-lg transition-colors">
                        Manage Station
                    </a>
                    <a href="platform.html?id=${station.id}" class="flex-1 text-center px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-secondary rounded-lg transition-colors shadow-sm">
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
let map, marker;
let currentStation;

function initManageStation(stationId) {
    const isNew = new URLSearchParams(window.location.search).get('new') === 'true';

    // Init Map (Default View)
    map = L.map('map').setView([20.5937, 78.9629], 5); // India view

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

        // Show Edit Station Button
        document.getElementById('btn-edit-station').classList.remove('hidden');

        map.setView([currentStation.lat, currentStation.lng], currentStation.zoom || 13);

        // Populate Fields (Disabled by default)
        const nameInput = document.getElementById('station-name-input');
        const codeInput = document.getElementById('station-code-input');
        nameInput.value = currentStation.name;
        codeInput.value = currentStation.code;
        nameInput.disabled = true;
        codeInput.disabled = true;

        updateLocationDisplay(currentStation.lat, currentStation.lng);

        // Static Marker (not draggable initially)
        marker = L.marker([currentStation.lat, currentStation.lng], { draggable: false }).addTo(map);

        marker.on('dragend', function (event) {
            const position = marker.getLatLng();
            updateLocationDisplay(position.lat, position.lng);
        });

        // Show Existing Station Shape if exists (Static initially)
        if (currentStation.geojson) {
            drawnItems = new L.FeatureGroup();
            map.addLayer(drawnItems);
            const layer = L.geoJSON(currentStation.geojson).getLayers()[0];
            layer.setStyle({ color: '#2563EB', fillOpacity: 0.2 });
            drawnItems.addLayer(layer);

            // Do NOT enable editing here by default
        }
    }
}

function enableStationEditing() {
    // Enable Inputs
    document.getElementById('station-name-input').disabled = false;
    document.getElementById('station-code-input').disabled = false;

    // Enable Marker Drag
    if (marker) {
        marker.dragging.enable();
    }

    // Enable Shape Editing
    if (drawnItems && drawnItems.getLayers().length > 0) {
        if (!window.stationDrawControl) {
            window.stationDrawControl = new L.Control.Draw({
                draw: false,
                edit: {
                    featureGroup: drawnItems,
                    remove: false
                }
            });
            map.addControl(window.stationDrawControl);
        }
    }

    // Toggle Buttons
    document.getElementById('btn-edit-station').classList.add('hidden');
    document.getElementById('btn-save-station').classList.remove('hidden');
}

function disableStationEditing() {
    // Disable Inputs
    document.getElementById('station-name-input').disabled = true;
    document.getElementById('station-code-input').disabled = true;

    // Disable Marker Drag
    if (marker) {
        marker.dragging.disable();
    }

    // Disable Shape Editing
    if (window.stationDrawControl) {
        map.removeControl(window.stationDrawControl);
        window.stationDrawControl = null;
    }

    // Toggle Buttons
    document.getElementById('btn-edit-station').classList.remove('hidden');
    document.getElementById('btn-save-station').classList.add('hidden');
}

function updateLocationDisplay(lat, lng) {
    document.getElementById('lat-display').innerText = parseFloat(lat).toFixed(6);
    document.getElementById('lng-display').innerText = parseFloat(lng).toFixed(6);
}

function saveStationChanges() {
    if (!currentStation) return;

    currentStation.name = document.getElementById('station-name-input').value;
    currentStation.code = document.getElementById('station-code-input').value;
    const latLng = marker.getLatLng();
    currentStation.lat = latLng.lat;
    currentStation.lng = latLng.lng;
    currentStation.zoom = map.getZoom();

    Storage.updateStation(currentStation);

    // If we have a shape drawn in edit mode (we need to handle saving that too)
    // But currently `saveStationChanges` is for the "old" edit mode (name/code/marker).
    // The requirement says "after saving the station ... station shape not visible".
    // This implies we should be able to update shape too.

    // Check if we have drawnItems and update geojson
    if (typeof drawnItems !== 'undefined' && drawnItems.getLayers().length > 0) {
        const layer = drawnItems.getLayers()[0];
        currentStation.geojson = layer.toGeoJSON();
        Storage.updateStation(currentStation);
    }

    // Revert to View Mode
    disableStationEditing();

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

    // Toast hint
    // (Optional: add a toast here like in platform page)
}

function startDrawing() {
    new L.Draw.Rectangle(map, {
        shapeOptions: {
            color: '#2563EB',
            weight: 2
        }
    }).enable();
}

function stopDrawing() {
    // There isn't a direct "stop" in L.Draw if not in a handler reference context easily, 
    // but we can just disable the tool if we had a reference. 
    // For now, "Move" acts as a "Cancel Drawing" logic if using standard Toolbar, 
    // but since we call `.enable()` directly, we can't easily cancel it without the handler instance.
    // However, clicking "Move" conceptually just means "interacting with map is now for moving".
    // A simple hack to stop drawing is to disable it
    // But since we created a new instance, we don't have the reference. 
    // A better way is to store the drawer instance.

    // For this simple implementation, we rely on the user finishing the draw or clicking logic.
    // Actually, L.Draw.Rectangle.disable() works if we kept the instance.

    // Let's improve startDrawing to store instance
    if (window.currentDrawer) {
        window.currentDrawer.disable();
        window.currentDrawer = null;
    }
}

// Redefine startDrawing to support stop
window.currentDrawer = null;
function startDrawing() {
    if (window.currentDrawer) window.currentDrawer.disable();
    window.currentDrawer = new L.Draw.Rectangle(map, {
        shapeOptions: {
            color: '#2563EB',
            weight: 2
        }
    });
    window.currentDrawer.enable();
    document.getElementById('btn-draw').classList.add('text-primary'); // Highlight button
}

function stopDrawing() {
    if (window.currentDrawer) {
        window.currentDrawer.disable();
        window.currentDrawer = null;
    }
    document.getElementById('btn-draw').classList.remove('text-primary');
}

function clearDrawing() {
    if (drawnItems) drawnItems.clearLayers();
    document.getElementById('station-details-modal').classList.add('hidden');
}

function openStationDetailsModal() {
    if (!drawnItems || drawnItems.getLayers().length === 0) {
        alert("Please draw the station area first.");
        return;
    }

    const layer = drawnItems.getLayers()[0];
    const center = layer.getBounds().getCenter();
    document.getElementById('new-station-lat').value = center.lat;
    document.getElementById('new-station-lng').value = center.lng;
    document.getElementById('new-station-zoom').value = map.getZoom();

    document.getElementById('station-details-modal').classList.remove('hidden');
}

function cancelStationCreation() {
    document.getElementById('station-details-modal').classList.add('hidden');
    // Do not clear layers on cancel (user might want to edit/save again)
}

function finalizeStationCreation() {
    const name = document.getElementById('new-station-name').value;
    const code = document.getElementById('new-station-code').value;
    const lat = document.getElementById('new-station-lat').value;
    const lng = document.getElementById('new-station-lng').value;
    const zoom = document.getElementById('new-station-zoom').value;

    if (!name || !code) {
        alert('Please enter station name and code.');
        return;
    }

    const newStation = {
        id: Date.now().toString(),
        name: name,
        code: code,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        zoom: parseInt(zoom),
        geojson: drawnItems.getLayers()[0].toGeoJSON() // Save the shape!
    };

    Storage.addStation(newStation);
    alert('Station created!');
    // window.location.href = `platform.html?id=${newStation.id}`;

    // Switch to Edit Mode for this station without reloading if possible, or just reload to clean state?
    // User said "also when i save they dont go on station.html" -> I think they mean they want to stay here or go to "manage platforms" manually.
    // Let's reload to "Edit Mode" of this station so they can see what they created.
    window.location.href = `station.html?id=${newStation.id}`;
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
                marker.setLatLng([lat, lon]);
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
    map = L.map('map').setView([station.lat, station.lng], station.zoom || 15);

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
