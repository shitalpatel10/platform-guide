// --- Home Page Logic ---
function initHomePage() {
    const grid = document.getElementById('station-grid');
    const emptyState = document.getElementById('empty-state');
    const stations = Storage.getStations();
    const platforms = Storage.getPlatforms();

    if (stations.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        grid.innerHTML = '';
        stations.forEach((station, index) => {
            const card = document.createElement('div');
            const staggerClass = index < 4 ? `stagger-${index + 1}` : '';
            card.className = `bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row items-start md:items-center justify-between group cursor-pointer hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all opacity-0 animate-slide-up ${staggerClass}`;
            card.onclick = (e) => {
                if (e.target.closest('a') || e.target.closest('button')) return;
                window.location.href = `station.html?id=${station.id}`;
            };

            const platformCount = platforms.filter(p => p.stationId === station.id).length;

            card.innerHTML = `
                <div class="flex items-center space-x-5 flex-grow">
                    <div class="w-14 h-14 rounded-2xl bg-blue-50 text-primary flex items-center justify-center text-2xl group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                        <i class="fa-solid fa-train-subway"></i>
                    </div>
                    <div>
                        <div class="flex items-center space-x-3 mb-1">
                            <h3 class="text-xl font-extrabold text-gray-900 leading-tight group-hover:text-primary transition-colors">${station.name}</h3>
                            <span class="text-[10px] font-black font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 uppercase tracking-wider">${station.code}</span>
                        </div>
                        <div class="flex items-center space-x-3">
                            <span class="flex items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                <i class="fa-solid fa-layer-group mr-1.5 opacity-50"></i> ${platformCount} Platforms
                            </span>
                            <span class="w-1 h-1 rounded-full bg-gray-200"></span>
                            <span class="flex items-center text-[10px] font-bold text-green-500 uppercase tracking-widest">
                                <i class="fa-solid fa-circle-check mr-1.5 opacity-50"></i> Verified Path
                            </span>
                        </div>
                    </div>
                </div>

                <div class="flex flex-col md:flex-row items-center space-y-3 md:space-y-0 md:space-x-3 w-full md:w-auto mt-6 md:mt-0 pt-6 md:pt-0 border-t md:border-t-0 border-gray-50">
                    <div class="flex flex-wrap items-center gap-1.5 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 w-full md:w-auto">
                        <a href="platform.html?id=${station.id}" onclick="event.stopPropagation()" 
                           class="flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 bg-white text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-orange-600 hover:shadow-sm border border-transparent hover:border-orange-100 rounded-xl transition-all group/link">
                            <i class="fa-solid fa-layer-group mr-2 opacity-40 group-hover/link:opacity-100"></i> Platforms
                        </a>
                        <a href="services.html?id=${station.id}" onclick="event.stopPropagation()" 
                           class="flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 bg-white text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-indigo-600 hover:shadow-sm border border-transparent hover:border-indigo-100 rounded-xl transition-all group/link">
                            <i class="fa-solid fa-location-dot mr-2 opacity-40 group-hover/link:opacity-100"></i> Services
                        </a>
                        <a href="infrastructure.html?id=${station.id}" onclick="event.stopPropagation()" 
                           class="flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 bg-white text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-teal-600 hover:shadow-sm border border-transparent hover:border-teal-100 rounded-xl transition-all group/link">
                            <i class="fa-solid fa-bridge mr-2 opacity-40 group-hover/link:opacity-100"></i> Infra
                        </a>
                    </div>

                    <a href="result.html?id=${station.id}" onclick="event.stopPropagation()" 
                       class="w-full md:w-auto flex items-center justify-center space-x-3 px-6 py-4 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-2xl transition-all shadow-xl shadow-blue-600/20 group/btn">
                        <span class="tracking-widest uppercase">Live View</span>
                        <i class="fa-solid fa-arrow-right text-[10px] group-hover/btn:translate-x-1 transition-transform"></i>
                    </a>
                </div>
            `;
            grid.appendChild(card);
        });

        // Add the "Dashed Fine Line" Add New Station button at the end
        const addCard = document.createElement('a');
        addCard.href = 'station.html?new=true';
        addCard.className = 'group flex items-center justify-center p-8 rounded-2xl border-2 border-dashed border-gray-200 hover:border-primary/40 hover:bg-blue-50/30 transition-all duration-300';
        addCard.innerHTML = `
            <div class="flex items-center space-x-3 text-gray-400 group-hover:text-primary transition-colors">
                <div class="w-8 h-8 rounded-full border-2 border-dashed border-current flex items-center justify-center group-hover:rotate-90 transition-transform duration-500">
                    <i class="fa-solid fa-plus text-sm"></i>
                </div>
                <span class="text-sm font-black uppercase tracking-[0.2em]">Add New Station</span>
            </div>
        `;
        grid.appendChild(addCard);
    }
}

// Initialize home page if grid exists
if (document.getElementById('station-grid')) {
    initHomePage();
}
