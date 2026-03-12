/**
 * GeometryEditor - A unified, premium drawing engine for Polygons and Polylines.
 * Provides rubber-band editing, active midpoints, and smooth visual feedback.
 */
class GeometryEditor {
    constructor(map) {
        this.map = map;
        this.layer = null;
        this.vertexMarkers = [];
        this.midpointMarkers = [];
        this.options = {
            type: 'polygon', // 'polygon' or 'polyline'
            color: '#2563EB',
            weight: 3,
            fillOpacity: 0.2,
            onUpdate: null // Callback when geometry changes
        };
        this.isDragging = false;
    }

    init(options = {}) {
        this.reset();
        this.options = { ...this.options, ...options };
        
        // Define initial geometry if none exists
        if (!this.layer) {
            const center = this.map.getCenter();
            const r = 0.0005;
            let latlngs;
            if (this.options.type === 'polygon') {
                latlngs = [[center.lat + r, center.lng], [center.lat - r, center.lng - r], [center.lat - r, center.lng + r]];
            } else {
                latlngs = [[center.lat, center.lng - r], [center.lat, center.lng + r]];
            }
            this.createLayer(latlngs);
        }
        this.render();
    }

    initWithData(latlngs, options = {}) {
        this.reset();
        this.options = { ...this.options, ...options };
        this.createLayer(latlngs);
        this.render();
    }

    createLayer(latlngs) {
        if (this.options.type === 'polygon') {
            this.layer = L.polygon(latlngs, {
                color: this.options.color,
                weight: this.options.weight,
                fillOpacity: this.options.fillOpacity,
                lineJoin: 'round'
            }).addTo(this.map);
        } else {
            this.layer = L.polyline(latlngs, {
                color: this.options.color,
                weight: this.options.weight,
                lineJoin: 'round'
            }).addTo(this.map);
        }
    }

    render() {
        this.clearMarkers();
        if (!this.layer) return;

        let latlngs = this.getLatlngs();
        
        // Render Vertex Markers
        latlngs.forEach((ll, idx) => {
            const m = L.marker(ll, {
                draggable: true,
                icon: L.divIcon({
                    className: 'editor-vertex',
                    html: `<div class="w-4 h-4 bg-white border-2 rounded-full shadow-md hover:scale-125 transition-transform" style="border-color: ${this.options.color}"></div>`,
                    iconSize: [16, 16], iconAnchor: [8, 8]
                })
            }).addTo(this.map);

            m.on('drag', (e) => {
                this.isDragging = true;
                const newLatlngs = this.getLatlngs();
                newLatlngs[idx] = e.target.getLatLng();
                this.setLatlngs(newLatlngs);
                this.updateMidpointsInternal();
            });

            m.on('dragend', () => {
                this.isDragging = false;
                this.render();
                if (this.options.onUpdate) this.options.onUpdate(this.getLatlngs());
            });

            m.on('dblclick', (e) => {
                L.DomEvent.stopPropagation(e);
                this.removeVertex(idx);
            });

            this.vertexMarkers.push(m);
        });

        // Render Midpoint Markers
        const segmentCount = this.options.type === 'polygon' ? latlngs.length : latlngs.length - 1;
        for (let i = 0; i < segmentCount; i++) {
            const p1 = latlngs[i];
            const p2 = latlngs[(i + 1) % latlngs.length];
            const mid = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);

            const mm = L.marker(mid, {
                draggable: true,
                icon: L.divIcon({
                    className: 'editor-midpoint',
                    html: `<div class="w-4 h-4 bg-white rounded-full border shadow-sm flex items-center justify-center opacity-60 hover:opacity-100 transition-all hover:scale-110" style="color: ${this.options.color}"><i class="fa-solid fa-plus text-[8px]"></i></div>`,
                    iconSize: [16, 16], iconAnchor: [8, 8]
                })
            }).addTo(this.map);

            let originalLatlngs = null;

            mm.on('dragstart', (e) => {
                L.DomEvent.stopPropagation(e);
                originalLatlngs = this.getLatlngs();
            });

            mm.on('drag', (e) => {
                if (!originalLatlngs) return;
                const newPos = e.target.getLatLng();
                const tempLatlngs = [...originalLatlngs];
                tempLatlngs.splice(i + 1, 0, newPos);
                this.setLatlngs(tempLatlngs);
            });

            mm.on('dragend', (e) => {
                originalLatlngs = null;
                this.render();
                if (this.options.onUpdate) this.options.onUpdate(this.getLatlngs());
            });

            mm.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                this.addVertex(i + 1, mid);
            });

            this.midpointMarkers.push(mm);
        }
    }

    updateMidpointsInternal() {
        const latlngs = this.getLatlngs();
        const segmentCount = this.options.type === 'polygon' ? latlngs.length : latlngs.length - 1;
        this.midpointMarkers.forEach((m, i) => {
            if (i < segmentCount) {
                const p1 = latlngs[i];
                const p2 = latlngs[(i + 1) % latlngs.length];
                m.setLatLng([(p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2]);
            }
        });
    }

    addVertex(idx, latlng) {
        const latlngs = this.getLatlngs();
        latlngs.splice(idx, 0, latlng);
        this.setLatlngs(latlngs);
        this.render();
        if (this.options.onUpdate) this.options.onUpdate(this.getLatlngs());
    }

    removeVertex(idx) {
        const latlngs = this.getLatlngs();
        const minPoints = this.options.type === 'polygon' ? 3 : 2;
        if (latlngs.length <= minPoints) return;
        latlngs.splice(idx, 1);
        this.setLatlngs(latlngs);
        this.render();
        if (this.options.onUpdate) this.options.onUpdate(this.getLatlngs());
    }

    getLatlngs() {
        let lls = this.layer.getLatLngs();
        if (this.options.type === 'polygon' && Array.isArray(lls[0])) lls = lls[0];
        return [...lls];
    }

    setLatlngs(latlngs) {
        if (this.options.type === 'polygon') {
            this.layer.setLatLngs([latlngs]);
        } else {
            this.layer.setLatLngs(latlngs);
        }
    }

    clearMarkers() {
        this.vertexMarkers.forEach(m => this.map.removeLayer(m));
        this.midpointMarkers.forEach(m => this.map.removeLayer(m));
        this.vertexMarkers = [];
        this.midpointMarkers = [];
    }

    reset() {
        if (this.layer) this.map.removeLayer(this.layer);
        this.clearMarkers();
        this.layer = null;
    }
}
