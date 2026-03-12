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

    getInfrastructure: () => JSON.parse(localStorage.getItem('infrastructure')) || [],
    saveInfrastructure: (infra) => localStorage.setItem('infrastructure', JSON.stringify(infra)),

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

        // Clean up infrastructure
        let infra = Storage.getInfrastructure();
        infra = infra.filter(i => i.stationId !== id);
        Storage.saveInfrastructure(infra);

        // Clean up services
        let services = Storage.getServices();
        services = services.filter(s => s.stationId !== id);
        Storage.saveServices(services);
    },

    getStationById: (id) => Storage.getStations().find(s => s.id === id),

    addPlatform: (platform) => {
        const platforms = Storage.getPlatforms();
        platforms.push(platform);
        Storage.savePlatforms(platforms);
    },

    getPlatformsByStationId: (stationId) => Storage.getPlatforms().filter(p => p.stationId === stationId),

    getInfrastructureByStationId: (stationId) => Storage.getInfrastructure().filter(i => i.stationId === stationId),

    addInfrastructure: (item) => {
        const infra = Storage.getInfrastructure();
        infra.push(item);
        Storage.saveInfrastructure(infra);
    },

    getServices: () => JSON.parse(localStorage.getItem('services')) || [],
    saveServices: (services) => localStorage.setItem('services', JSON.stringify(services)),

    getServicesByStationId: (stationId) => Storage.getServices().filter(s => s.stationId === stationId)
};

/**
 * GeoFilter - Hand-coded geometry math for point-in-polygon and intersections.
 */
const GeoFilter = {
    // 1. Ray Casting Algorithm (Point in Polygon)
    isPointInPolygon: (point, vs) => {
        const x = point.lat || point[0], y = point.lng || point[1];
        let inside = false;
        // Normalize vs if it's geojson coordinates [lng, lat]
        const polygon = vs.map(v => Array.isArray(v) ? { lat: v[1], lng: v[0] } : v);
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].lat, yi = polygon[i].lng;
            const xj = polygon[j].lat, yj = polygon[j].lng;

            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    },

    // 2. Line Segment Intersection
    doSegmentsIntersect: (p1, q1, p2, q2) => {
        const getOrientation = (p, q, r) => {
            const val = (q.lng - p.lng) * (r.lat - q.lat) - (q.lat - p.lat) * (r.lng - q.lng);
            if (Math.abs(val) < 1e-10) return 0; // collinear
            return (val > 0) ? 1 : 2;
        };

        const o1 = getOrientation(p1, q1, p2);
        const o2 = getOrientation(p1, q1, q2);
        const o3 = getOrientation(p2, q2, p1);
        const o4 = getOrientation(p2, q2, q1);

        if (o1 !== o2 && o3 !== o4) return true;
        return false;
    }
};

// --- Universal Workspace Switcher ---
const WorkspaceNavigation = {
    init: () => {
        const urlParams = new URLSearchParams(window.location.search);
        const stationId = urlParams.get('id');
        if (!stationId) return;

        // Detect current page to show as active label
        const pageMap = {
            'station.html': 'Station',
            'platform.html': 'Platforms',
            'infrastructure.html': 'Infrastructure',
            'services.html': 'Services'
        };
        const currentFileName = window.location.pathname.split('/').pop() || 'station.html';
        const activeLabel = pageMap[currentFileName] || 'Workspace';

        if (currentFileName === 'result.html') return;

        const iconMap = {
            'Station': 'fa-city',
            'Platforms': 'fa-layer-group',
            'Infrastructure': 'fa-bridge',
            'Services': 'fa-location-dot'
        };
        const activeIcon = iconMap[activeLabel] || 'fa-compass';

        // Create the navigation container if it doesn't exist
        if (!document.getElementById('workspace-hub-container')) {
            const navbar = document.querySelector('nav .max-w-7xl');
            if (!navbar) return;

            const hubHtml = `
                <div class="relative" id="workspace-hub-container">
                    <button onclick="WorkspaceNavigation.toggleMenu()" 
                        class="flex items-center px-4 py-2 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100/50 border border-indigo-100 rounded-full text-sm font-bold transition-all shadow-sm ring-offset-2 focus:ring-2 focus:ring-indigo-500/20 group">
                        <div class="w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center mr-3 shadow-sm group-hover:scale-110 transition-transform">
                            <i class="fa-solid ${activeIcon} text-[10px]"></i>
                        </div>
                        <span class="mr-1.5 opacity-40 font-medium whitespace-nowrap tracking-wide">Page:</span>
                        <span class="text-indigo-900 whitespace-nowrap font-black tracking-tight underline-offset-4 decoration-indigo-200/50 hover:underline">${activeLabel}</span>
                        <i class="fa-solid fa-chevron-down ml-3 text-[10px] opacity-20 group-hover:opacity-100 transition-opacity"></i>
                    </button>
                    
                    <div id="workspace-menu" class="absolute left-0 top-full mt-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-2xl py-2 z-[4000] hidden transform scale-95 opacity-0 transition-all duration-200 origin-top-left">
                        <div class="px-4 py-2 border-b border-gray-50 mb-1">
                            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Global Navigation</p>
                        </div>
                        
                        <a href="index.html" class="flex items-center px-4 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors border-b border-gray-50 mb-1 group">
                             <div class="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-white"><i class="fa-solid fa-house text-xs"></i></div>
                             Back to Home
                        </a>

                        <a href="station.html?id=${stationId}" class="flex items-center px-4 py-2.5 text-sm font-semibold ${activeLabel === 'Station' ? 'bg-indigo-50 text-black' : 'text-gray-600 hover:bg-gray-50'} transition-all group">
                            <div class="w-8 h-8 ${activeLabel === 'Station' ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-50 text-blue-500'} rounded-xl flex items-center justify-center mr-3 group-hover:scale-110 transition-transform"><i class="fa-solid fa-city text-[10px]"></i></div>
                            Station Boundary
                        </a>
                        <a href="platform.html?id=${stationId}" class="flex items-center px-4 py-2.5 text-sm font-semibold ${activeLabel === 'Platforms' ? 'bg-indigo-50 text-black' : 'text-gray-600 hover:bg-gray-50'} transition-all group">
                            <div class="w-8 h-8 ${activeLabel === 'Platforms' ? 'bg-orange-600 text-white shadow-md' : 'bg-orange-50 text-orange-500'} rounded-xl flex items-center justify-center mr-3 group-hover:scale-110 transition-transform"><i class="fa-solid fa-layer-group text-[10px]"></i></div>
                            Platform Mapping
                        </a>
                        <a href="infrastructure.html?id=${stationId}" class="flex items-center px-4 py-2.5 text-sm font-semibold ${activeLabel === 'Infrastructure' ? 'bg-indigo-50 text-black' : 'text-gray-600 hover:bg-gray-50'} transition-all group">
                            <div class="w-8 h-8 ${activeLabel === 'Infrastructure' ? 'bg-teal-600 text-white shadow-md' : 'bg-teal-50 text-teal-500'} rounded-xl flex items-center justify-center mr-3 group-hover:scale-110 transition-transform"><i class="fa-solid fa-bridge text-[10px]"></i></div>
                            Infrastructure
                        </a>
                        <a href="services.html?id=${stationId}" class="flex items-center px-4 py-2.5 text-sm font-semibold ${activeLabel === 'Services' ? 'bg-indigo-50 text-black' : 'text-gray-600 hover:bg-gray-50'} transition-all group">
                            <div class="w-8 h-8 ${activeLabel === 'Services' ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-50 text-indigo-500'} rounded-xl flex items-center justify-center mr-3 group-hover:scale-110 transition-transform"><i class="fa-solid fa-location-dot text-[10px]"></i></div>
                            Services & POI
                        </a>
                        
                        <div class="pt-2 border-t border-gray-50 mt-1 px-3">
                             <a href="result.html?id=${stationId}" target="_blank" class="flex items-center px-4 py-3 bg-gray-900 text-white rounded-2xl text-[11px] font-black hover:bg-black transition-all justify-center shadow-xl shadow-gray-200 group">
                                <i class="fa-solid fa-eye mr-3 text-indigo-400 group-hover:scale-125 transition-transform"></i> TRAVELER VIEW
                             </a>
                        </div>
                    </div>
                </div>
            `;
            
            // Insert into the designated 'nav-left' column
            const navLeft = document.getElementById('nav-left');
            if (navLeft) {
                navLeft.innerHTML = hubHtml;
            }
        }

        // Close menu on click outside
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('workspace-menu');
            const btn = document.getElementById('workspace-hub-container');
            if (menu && btn && !btn.contains(e.target)) {
                WorkspaceNavigation.toggleMenu(false);
            }
        });
    },

    toggleMenu: (force) => {
        const menu = document.getElementById('workspace-menu');
        if (!menu) return;
        
        const isHidden = menu.classList.contains('hidden');
        const show = force !== undefined ? force : isHidden;

        if (show) {
            menu.classList.remove('hidden');
            setTimeout(() => menu.classList.remove('scale-95', 'opacity-0'), 10);
        } else {
            menu.classList.add('scale-95', 'opacity-0');
            setTimeout(() => menu.classList.add('hidden'), 200);
        }
    }
};

// Initialize navigation on load
document.addEventListener('DOMContentLoaded', WorkspaceNavigation.init);

// Global map variable (shared across page-specific scripts)
let map;
