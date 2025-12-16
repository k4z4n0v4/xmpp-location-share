import L from 'leaflet';
import { CONFIG, COLOR_PALETTE } from '../config.js';
import { UI } from '../ui/controller.js';

/**
 * Leaflet map controller
 */
class MapControllerService {
    constructor() {
        this.map = null;
        this.myMarker = null;
        this.myAccuracyCircle = null;
        this.markers = {};
        this.userColors = {};
        this.autoFollow = false;
    }

    /**
     * Initialize the map
     * @param {string} elementId - ID of the map container element
     */
    init(elementId) {
        this.map = L.map(elementId).setView(CONFIG.defaultMapCenter, CONFIG.defaultMapZoom);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.map);
    }

    /**
     * Get consistent color for a user
     * @param {string} jid - User's JID
     * @returns {string} Hex color
     */
    getUserColor(jid) {
        if (!this.userColors[jid]) {
            this.userColors[jid] = COLOR_PALETTE[Object.keys(this.userColors).length % COLOR_PALETTE.length];
        }
        return this.userColors[jid];
    }

    /**
     * Update or create the current user's marker
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {number} accuracy - Accuracy in meters
     */
    updateMyMarker(lat, lon, accuracy) {
        UI.showMyLocationBadge();

        if (this.myMarker) {
            this.myMarker.setLatLng([lat, lon]);
            this.myAccuracyCircle.setLatLng([lat, lon]).setRadius(accuracy);
        } else {
            this.myAccuracyCircle = L.circle([lat, lon], {
                radius: accuracy,
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.15,
                weight: 2
            }).addTo(this.map);

            const icon = L.divIcon({
                className: 'user-marker',
                html: `<div style="width:18px;height:18px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(59,130,246,0.45);"></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9]
            });

            this.myMarker = L.marker([lat, lon], { icon, zIndexOffset: 1000 })
                .addTo(this.map)
                .bindPopup('<strong>You</strong>');
        }
    }

    /**
     * Update or create a user's marker
     * @param {string} jid - User's JID
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {number} accuracy - Accuracy in meters
     * @param {string} timestamp - ISO timestamp
     * @returns {Object} Marker data
     */
    updateUserMarker(jid, lat, lon, accuracy, timestamp) {
        const color = this.getUserColor(jid);
        const displayName = jid.split('@')[0];
        const safeAccuracy = accuracy || 10;

        if (this.markers[jid]) {
            this.markers[jid].marker.setLatLng([lat, lon]);
            this.markers[jid].accuracy?.setLatLng([lat, lon]).setRadius(safeAccuracy);
        } else {
            const accuracyCircle = L.circle([lat, lon], {
                radius: safeAccuracy,
                color,
                fillColor: color,
                fillOpacity: 0.10,
                weight: 1
            }).addTo(this.map);

            const icon = L.divIcon({
                className: 'user-marker pulse',
                html: `<div style="width:34px;height:34px;background:${color};border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:white;box-shadow:0 2px 10px rgba(0,0,0,0.3);">${displayName.charAt(0).toUpperCase()}</div>`,
                iconSize: [34, 34],
                iconAnchor: [17, 17]
            });

            const marker = L.marker([lat, lon], { icon })
                .addTo(this.map)
                .bindPopup(`<strong>${displayName}</strong>`);

            this.markers[jid] = { marker, accuracy: accuracyCircle };
        }

        // Update stored data
        Object.assign(this.markers[jid], { lat, lon, lastUpdate: timestamp });

        // Update popup content
        this.markers[jid].marker.setPopupContent(
            `<strong>${displayName}</strong><br>` +
            `${lat.toFixed(5)}, ${lon.toFixed(5)}<br>` +
            `±${Math.round(safeAccuracy)}m<br>` +
            `${new Date(timestamp).toLocaleTimeString()}`
        );

        if (this.autoFollow) {
            this.map.setView([lat, lon]);
        }

        return this.markers[jid];
    }

    /**
     * Remove a user's marker from the map
     * @param {string} jid - User's JID
     */
    removeMarker(jid) {
        const data = this.markers[jid];
        if (!data) return;

        this.map.removeLayer(data.marker);
        if (data.accuracy) {
            this.map.removeLayer(data.accuracy);
        }
        delete this.markers[jid];
    }

    /**
     * Fit map bounds to show all markers
     */
    fitAllMarkers() {
        const positions = Object.values(this.markers).map(m => [m.lat, m.lon]);
        
        if (this.myMarker) {
            const ll = this.myMarker.getLatLng();
            positions.push([ll.lat, ll.lng]);
        }
        
        if (positions.length > 0) {
            this.map.fitBounds(positions, { padding: [50, 50] });
        }
    }

    /**
     * Center map on a specific location
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {number} zoom - Zoom level
     */
    centerOn(lat, lon, zoom = 16) {
        this.map.setView([lat, lon], zoom);
    }

    /**
     * Toggle auto-follow mode
     * @returns {boolean} New auto-follow state
     */
    toggleAutoFollow() {
        this.autoFollow = !this.autoFollow;
        UI.setAutoFollow(this.autoFollow);
        return this.autoFollow;
    }

    /**
     * Get all markers
     * @returns {Object} Markers by JID
     */
    getMarkers() {
        return this.markers;
    }
}

export const MapController = new MapControllerService();
