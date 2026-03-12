// --- Data Management (Storage) ---
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
        
        // Also clean up platforms associated with this station
        let platforms = Storage.getPlatforms();
        platforms = platforms.filter(p => p.stationId !== id);
        Storage.savePlatforms(platforms);
    },

    getStationById: (id) => Storage.getStations().find(s => s.id === id),

    addPlatform: (platform) => {
        const platforms = Storage.getPlatforms();
        platforms.push(platform);
        Storage.savePlatforms(platforms);
    },

    getPlatformsByStationId: (stationId) => Storage.getPlatforms().filter(p => p.stationId === stationId),

    clearAll: () => {
        localStorage.clear();
        location.reload();
    }
};

// Global map variable (shared across page-specific scripts)
let map;
