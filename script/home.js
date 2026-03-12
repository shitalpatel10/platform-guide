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
                    <a href="platform.html?id=${station.id}" onclick="event.stopPropagation()" class="flex-1 text-center px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-secondary rounded-lg transition-colors shadow-sm" title="Manage Platforms">
                        <i class="fa-solid fa-layer-group"></i>
                    </a>
                    <a href="services.html?id=${station.id}" onclick="event.stopPropagation()" class="flex-1 text-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors shadow-sm" title="Manage Services">
                        <i class="fa-solid fa-location-dot text-indigo-500"></i>
                    </a>
                    <a href="result.html?id=${station.id}" onclick="event.stopPropagation()" class="flex-1 text-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-lg transition-colors shadow-sm" title="User View (Finished Map)">
                        <i class="fa-solid fa-eye"></i>
                    </a>
                </div>
            `;
            grid.appendChild(card);
        });
    }
}

window.deleteStationFromIndex = function(id, event) {
    event.stopPropagation();
    const station = Storage.getStationById(id);
    if (confirm(`Are you sure you want to delete station "${station.name}"? This action cannot be undone.`)) {
        Storage.deleteStation(id);
        initHomePage();
    }
}

window.clearAllData = function() {
    if (confirm('Are you sure you want to delete all data? This cannot be undone.')) {
        localStorage.clear();
        location.reload();
    }
}

// Initialize home page if grid exists
if (document.getElementById('station-grid')) {
    initHomePage();
}
