// --- Global State ---
let currentStationId = null;
let infraData = [];
let platformsData = [];
let selectedInfraId = null;
let editedLayer = null;
let staticLayersGroup = null;
let infraLayersGroup = null;
let editor = null;

let currentDrawingMode = null; // 'line' or 'marker'
let activeBridgeBranches = [];

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

    document.getElementById('header-station-name').innerText = station.name;
    document.getElementById('header-station-code').innerText = station.code;

    map = L.map('map', { zoomControl: false, maxZoom: 24 }).setView([station.lat, station.lng], station.zoom || 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 24, maxNativeZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    staticLayersGroup = new L.FeatureGroup().addTo(map);
    infraLayersGroup = new L.FeatureGroup().addTo(map);
    editor = new GeometryEditor(map);

    // Render Station Boundary
    if (station.geojson) {
        L.geoJSON(station.geojson, {
            style: { color: '#2563EB', fillOpacity: 0.05, weight: 2, dashArray: '5, 5' },
            interactive: false
        }).addTo(staticLayersGroup);
    }

    // Render Platforms
    platformsData = Storage.getPlatformsByStationId(currentStationId);
    platformsData.forEach(p => {
        if (p.geojson) {
            L.geoJSON(p.geojson, {
                style: { color: '#9CA3AF', weight: 2, fillOpacity: 0.2 },
                interactive: false
            }).addTo(staticLayersGroup);
        }
    });

    infraData = Storage.getInfrastructureByStationId(currentStationId);
    renderAllStaticInfra();
    renderSidebar();

    map.on('click', (e) => {
        if (currentDrawingMode === 'marker') {
            createMarkerInfra(e.latlng);
        }
    });
});

// --- Map Operations ---

function renderAllStaticInfra() {
    // We'll use a separate group for infra if we want to toggle it, but for now just add to map
    infraData.forEach(item => {
        if (item.id === selectedInfraId) return;
        renderStaticItem(item);
    });

    // Render active branches being edited
    if (activeBridgeBranches.length > 0) {
        activeBridgeBranches.forEach(branch => {
            L.polyline(branch, {
                color: '#EA580C',
                weight: 3,
                opacity: 0.5,
                dashArray: '5, 5'
            }).addTo(infraLayersGroup);
        });
    }
}

function renderStaticItem(item) {
    if (item.type === 'bridge' || item.type === 'path') {
        const renderPath = (pts, isBranch = false) => {
             const layer = L.polyline(pts, {
                color: item.type === 'bridge' ? '#EA580C' : '#0D9488',
                weight: isBranch ? 3 : 5,
                opacity: 0.7,
                dashArray: isBranch ? '5, 5' : null
            }).addTo(infraLayersGroup);
            layer.on('click', () => selectInfra(item.id));
            layer.bindTooltip(`${item.name}${isBranch ? ' (Branch)' : ''}`, { sticky: true });
        };

        if (item.latlngs) renderPath(item.latlngs);
        if (item.branches) {
            item.branches.forEach(branch => renderPath(branch, true));
        }
    } else {
        const icon = L.divIcon({
            className: 'gate-icon',
            html: `<div class="w-6 h-6 bg-teal-600 text-white rounded-full border-2 border-white shadow-md flex items-center justify-center text-xs"><i class="fa-solid fa-door-open"></i></div>`,
            iconSize: [24, 24], iconAnchor: [12, 12]
        });
        const marker = L.marker(item.latlng, { icon }).addTo(infraLayersGroup);
        marker.on('click', () => selectInfra(item.id));
        marker.bindTooltip(item.name, { direction: 'top', offset: [0, -10] });
    }
}

function startDrawingLine() {
    clearEditing();
    currentDrawingMode = 'line';
    editor.init({
        type: 'polyline',
        color: '#EA580C',
        weight: 6,
        onUpdate: () => updateConnectionUI()
    });
    renderSidebar();
}

function startPlacingMarker() {
    clearEditing();
    currentDrawingMode = 'marker';
    showToast("Click on map to place Gate/Entry", false);
    renderSidebar();
}

function createMarkerInfra(latlng) {
    clearEditing();
    currentDrawingMode = null;
    editedLayer = L.marker(latlng, {
        draggable: true,
        icon: L.divIcon({
            className: 'gate-edit-icon',
            html: `<div class="w-8 h-8 bg-teal-500 text-white rounded-full border-2 border-white shadow-lg flex items-center justify-center text-lg animate-bounce"><i class="fa-solid fa-door-open"></i></div>`,
            iconSize: [32, 32], iconAnchor: [16, 16]
        })
    }).addTo(map);
    
    document.getElementById('infra-type-select-sidebar') && (document.getElementById('infra-type-select-sidebar').value = 'entry');
    renderSidebar();
}

function selectInfra(id) {
    clearEditing();
    selectedInfraId = id;
    const item = infraData.find(i => i.id === id);
    if (!item) return;

    if (item.type === 'bridge' || item.type === 'path') {
        currentDrawingMode = 'line';
        editor.initWithData(item.latlngs, {
            type: 'polyline',
            color: item.type === 'bridge' ? '#EA580C' : '#0D9488',
            weight: 6,
            onUpdate: () => updateConnectionUI()
        });
        activeBridgeBranches = item.branches || [];
    } else {
        currentDrawingMode = 'marker';
        editedLayer = L.marker(item.latlng, {
            draggable: true,
            icon: L.divIcon({
                className: 'gate-edit-icon',
                html: `<div class="w-8 h-8 bg-teal-500 text-white rounded-full border-2 border-white shadow-lg flex items-center justify-center text-lg"><i class="fa-solid fa-door-open"></i></div>`,
                iconSize: [32, 32], iconAnchor: [16, 16]
            })
        }).addTo(map);
    }
    
    // Refresh static layers to hide the one we just selected for editing
    if (infraLayersGroup) {
        infraLayersGroup.clearLayers();
        renderAllStaticInfra();
    }
    
    renderSidebar();
}

function clearEditing() {
    if (editedLayer) map.removeLayer(editedLayer);
    if (editor) editor.reset();
    
    editedLayer = null;
    selectedInfraId = null;
    currentDrawingMode = null;
    activeBridgeBranches = [];
    if (infraLayersGroup) infraLayersGroup.clearLayers();
    renderAllStaticInfra();
    renderSidebar();
}

function saveInfra() {
    confirmSaveInfra();
}

function confirmSaveInfra() {
    const name = document.getElementById('infra-name-input-sidebar').value.trim();
    const type = document.getElementById('infra-type-select-sidebar').value;
    if (!name) { showToast("Label is required", true); return; }

    const item = {
        id: selectedInfraId || Date.now().toString(),
        stationId: currentStationId,
        name: name,
        type: type,
        branches: activeBridgeBranches || []
    };

    if (type === 'bridge' || type === 'path') {
        item.latlngs = editor.getLatlngs().map(ll => [ll.lat, ll.lng]);
    } else {
        const pos = editedLayer.getLatLng();
        item.latlng = [pos.lat, pos.lng];
    }

    const idx = infraData.findIndex(i => i.id === item.id);
    if (idx !== -1) infraData[idx] = item;
    else infraData.push(item);

    Storage.saveInfrastructure(infraData);
    showToast(`${item.name} saved!`);
    clearEditing();
}

function renderSidebar() {
    const title = document.getElementById('sidebar-title');
    const content = document.getElementById('sidebar-content');

    if (editedLayer || (editor && editor.layer)) {
        const activeItem = selectedInfraId ? infraData.find(i => i.id === selectedInfraId) : { name: '', type: currentDrawingMode === 'line' ? 'bridge' : 'entry' };
        
        title.innerHTML = `<i class="fa-solid fa-edit text-orange-600 mr-2"></i> ${selectedInfraId ? 'Edit' : 'New'} Item`;
        content.innerHTML = `
            <div class="space-y-6 animate-slide-in">
                <div class="bg-orange-50 rounded-xl p-4 border border-orange-100">
                    <p class="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Live Workspace</p>
                    <h3 class="font-bold text-orange-900">${currentDrawingMode === 'line' ? 'Connection Property' : 'Point Location'}</h3>
                </div>

                <div class="space-y-4">
                    <div>
                        <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Label Name</label>
                        <input type="text" id="infra-name-input-sidebar" value="${activeItem.name}" placeholder="e.g., Main FOB"
                            class="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-sm font-medium transition-all shadow-sm">
                    </div>

                    <div>
                        <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Item Type</label>
                        <select id="infra-type-select-sidebar" class="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-sm font-medium transition-all shadow-sm">
                            <option value="bridge" ${activeItem.type === 'bridge' ? 'selected' : ''}>Bridge / FOB</option>
                            <option value="path" ${activeItem.type === 'path' ? 'selected' : ''}>Transit Path / Walkway</option>
                            <option value="entry" ${activeItem.type === 'entry' ? 'selected' : ''}>Station Entry / Gate</option>
                            <option value="exit" ${activeItem.type === 'exit' ? 'selected' : ''}>Station Exit</option>
                            <option value="concourse" ${activeItem.type === 'concourse' ? 'selected' : ''}>Concourse / Waiting Hall</option>
                            <option value="transport_hub" ${activeItem.type === 'transport_hub' ? 'selected' : ''}>Transport Hub</option>
                        </select>
                    </div>

                    ${activeItem.type === 'bridge' || activeItem.type === 'path' ? `
                        <div class="space-y-2">
                             <div class="flex items-center justify-between px-1">
                                  <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Branches (${activeBridgeBranches.length})</label>
                                  <button onclick="addBridgeBranch()" class="text-[10px] font-bold text-orange-600 hover:text-orange-700">
                                     <i class="fa-solid fa-plus-circle"></i> Add Exit/Stair
                                  </button>
                             </div>
                             <div id="bridge-branches-static-list" class="space-y-1">
                                 ${activeBridgeBranches.map((b, i) => `
                                     <div class="flex items-center justify-between bg-gray-50 px-2 py-1 rounded text-[10px] text-gray-500 border border-gray-100 italic">
                                         <span>Part ${i + 1} (${b.length} pts)</span>
                                         <button onclick="removeBranch(${i})" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-times"></i></button>
                                     </div>
                                 `).join('')}
                             </div>
                        </div>
                    ` : ''}
                </div>

                <div class="pt-4 space-y-3">
                    <button onclick="saveInfra()" class="w-full py-3 bg-orange-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-600/20 hover:bg-orange-700 transition-all flex items-center justify-center">
                        <i class="fa-solid fa-cloud-arrow-up mr-2"></i> Update & Sync
                    </button>

                    ${activeItem.type === 'bridge' || activeItem.type === 'path' ? `
                        <div class="bg-gray-50 rounded-xl p-3 border border-gray-100">
                             <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Detected Connections</p>
                             <div id="detected-connections-list" class="flex flex-wrap gap-1">
                                 <span class="text-[10px] text-gray-400 italic">No platforms detected...</span>
                             </div>
                        </div>
                    ` : ''}

                    <div class="flex space-x-2">
                        <button onclick="deleteCurrentInfra()" class="flex-1 py-2 bg-white text-red-500 border border-red-50 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors">
                            <i class="fa-solid fa-trash-can mr-1"></i> Delete
                        </button>
                        <button onclick="clearEditing()" class="flex-1 py-2 bg-white text-gray-400 border border-gray-100 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        // Immediate detection after render
        if (activeItem.type === 'bridge' || activeItem.type === 'path') {
            updateConnectionUI();
        }
    } else {
        title.innerHTML = `<i class="fa-solid fa-sitemap text-orange-600 mr-2"></i> Infrastructure`;
        if (infraData.length === 0) {
            content.innerHTML = `<div class="py-12 text-center text-gray-400"><i class="fa-solid fa-bridge text-3xl mb-3 opacity-20"></i><p class="text-xs">No bridges or entries yet.</p></div>`;
        } else {
            let html = '<div class="space-y-2">';
            infraData.forEach(item => {
                const icon = item.type === 'bridge' ? 'fa-bridge' : (item.type === 'path' ? 'fa-route' : 'fa-door-open');
                const color = item.type === 'bridge' ? 'bg-orange-100 text-orange-600' : 'bg-teal-100 text-teal-600';
                html += `
                    <div onclick="selectInfra('${item.id}')" class="group bg-white border border-gray-200 p-3 rounded-xl hover:border-orange-300 transition-all cursor-pointer flex items-center justify-between shadow-sm">
                        <div class="flex items-center space-x-3">
                            <div class="w-8 h-8 ${color} rounded-lg flex items-center justify-center text-xs"><i class="fa-solid ${icon}"></i></div>
                            <span class="text-sm font-bold text-gray-800">${item.name}</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-gray-300 group-hover:text-orange-500 text-[10px] transition-colors"></i>
                    </div>
                `;
            });
            html += '</div>';
            content.innerHTML = html;
        }
    }
}

function deleteCurrentInfra() {
    if (!selectedInfraId) { clearEditing(); return; }
    if (confirm("Delete this item?")) {
        infraData = infraData.filter(i => i.id !== selectedInfraId);
        Storage.saveInfrastructure(infraData);
        clearEditing();
    }
}

// --- Connection Intelligence ---

function addBridgeBranch() {
    const currentPath = editor.getLatlngs().map(ll => [ll.lat, ll.lng]);
    activeBridgeBranches.push(currentPath);
    
    // Start fresh branch with just 2 points (near center of map for visibility)
    const center = map.getCenter();
    const r = 0.0002;
    editor.initWithData([[center.lat, center.lng - r], [center.lat, center.lng + r]], {
        type: 'polyline', color: '#EA580C', weight: 6, onUpdate: () => updateConnectionUI()
    });
    
    // Render the branches we just "committed"
    renderAllStaticInfra();
    renderSidebar();
}

function removeBranch(idx) {
    activeBridgeBranches.splice(idx, 1);
    renderAllStaticInfra();
    renderSidebar();
}

function updateConnectionUI() {
    const listEl = document.getElementById('detected-connections-list');
    if (!listEl || !editor || !editor.layer) return;

    const latlngs = editor.getLatlngs();
    const connections = new Set();

    latlngs.forEach(ll => {
        platformsData.forEach(p => {
            if (p.geojson && GeoFilter.isPointInPolygon(ll, p.geojson.geometry.coordinates[0])) {
                connections.add(p.name);
            }
        });
    });

    if (connections.size > 0) {
        listEl.innerHTML = Array.from(connections).map(name => `
            <span class="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[9px] font-bold border border-orange-200">
                <i class="fa-solid fa-link mr-1 opacity-50"></i> ${name}
            </span>
        `).join('');
    } else {
        listEl.innerHTML = '<span class="text-[10px] text-gray-400 italic">No platforms detected...</span>';
    }
}


function recenterMap() {
    if (staticLayersGroup.getBounds().isValid()) {
        map.fitBounds(staticLayersGroup.getBounds(), { padding: [50, 50], duration: 1.5 });
    }
}

function showToast(msg, isErr = false) {
    const t = document.createElement('div');
    t.className = `fixed bottom-5 right-5 ${isErr ? 'bg-red-600' : 'bg-green-600'} text-white px-6 py-3 rounded-lg shadow-lg z-[4000] transition-all transform translate-y-10 opacity-0 text-sm font-medium`;
    t.innerHTML = `<i class="fa-solid ${isErr ? 'fa-triangle-exclamation' : 'fa-check'} mr-2"></i> ${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.classList.remove('translate-y-10', 'opacity-0'), 100);
    setTimeout(() => { t.classList.add('translate-y-10', 'opacity-0'); setTimeout(() => t.remove(), 300); }, 3000);
}
