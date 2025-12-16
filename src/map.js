import L from 'leaflet';

let map = null;
let myMarker = null;
let myCircle = null; // Added
let markers = {}; 
let autoFollow = false;

// User colors
const PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6'];
const userColors = {};

export function initMap() {
    map = L.map('map').setView([51.505, -0.09], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // Fix leaflet icon path issues
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'node_modules/leaflet/dist/images/marker-icon-2x.png',
        iconUrl: 'node_modules/leaflet/dist/images/marker-icon.png',
        shadowUrl: 'node_modules/leaflet/dist/images/marker-shadow.png',
    });
}

export function updateMyPos(lat, lon, acc) {
    if (!map) return;
    
    document.getElementById('myLocationBadge').classList.remove('hidden');

    // Marker
    if (myMarker) {
        myMarker.setLatLng([lat, lon]);
    } else {
        const icon = L.divIcon({
            className: 'user-marker',
            html: `<div style="width:18px;height:18px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(59,130,246,0.45);"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9] // Centered
        });
        myMarker = L.marker([lat, lon], { icon, zIndexOffset: 1000 }).addTo(map);
    }

    // Accuracy Circle (Restored)
    if (myCircle) {
        myCircle.setLatLng([lat, lon]);
        myCircle.setRadius(acc);
    } else {
        myCircle = L.circle([lat, lon], {
            radius: acc,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            weight: 2
        }).addTo(map);
    }
    
    if (autoFollow) map.setView([lat, lon]);
}

export function updateUserMarker(jid, lat, lon, acc, time) {
    const name = jid.split('@')[0];
    
    if (!userColors[jid]) {
        userColors[jid] = PALETTE[Object.keys(userColors).length % PALETTE.length];
    }
    const color = userColors[jid];
    const safeAcc = acc || 10;

    if (markers[jid]) {
        markers[jid].marker.setLatLng([lat, lon]);
        markers[jid].circle.setLatLng([lat, lon]).setRadius(safeAcc); // Update circle
        markers[jid].marker.setPopupContent(`<b>${name}</b><br>${time}<br>±${Math.round(safeAcc)}m`);
    } else {
        const icon = L.divIcon({
            className: 'user-marker pulse',
            html: `<div style="width:34px;height:34px;background:${color};border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,0.3);">${name[0].toUpperCase()}</div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        });

        const m = L.marker([lat, lon], { icon })
            .addTo(map)
            .bindPopup(`<b>${name}</b><br>${time}<br>±${Math.round(safeAcc)}m`);

        // Create accuracy circle
        const c = L.circle([lat, lon], {
            radius: safeAcc,
            color: color,
            fillColor: color,
            fillOpacity: 0.1,
            weight: 1
        }).addTo(map);

        markers[jid] = { marker: m, circle: c };
    }
    
    if (autoFollow) map.setView([lat, lon]); // Sync follow behavior

    return { lastUpdate: time };
}

export function removeMarker(jid) {
    if (markers[jid]) {
        map.removeLayer(markers[jid].marker);
        map.removeLayer(markers[jid].circle); // Remove circle
        delete markers[jid];
    }
}

export function centerMap(lat, lon) {
    map.setView([lat, lon], 16);
}

export function fitBounds() {
    const layers = [];
    if (myMarker) layers.push(myMarker);
    Object.values(markers).forEach(m => layers.push(m.marker));
    
    if (layers.length) {
        const group = L.featureGroup(layers);
        map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
}

export function setAutoFollow(enabled) {
    autoFollow = enabled;
}

export function getMarker(jid) {
    return markers[jid] ? markers[jid].marker : null;
}
