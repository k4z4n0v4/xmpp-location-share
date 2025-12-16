import { CONFIG } from './config.js';
import { Logger } from './services/logger.js';
import { Toast } from './services/toast.js';
import { UI } from './ui/controller.js';
import { MapController } from './map/controller.js';

/**
 * Location sharing service
 */
class LocationSharingService {
    constructor() {
        this.isSharing = false;
        this.intervalId = null;
        this.currentLocation = null;
        this._xmppClient = null;
    }

    /**
     * Set XMPP client reference (to avoid circular imports)
     * @param {Object} client - XMPP client instance
     */
    setXMPPClient(client) {
        this._xmppClient = client;
    }

    /**
     * Fetch current GPS location
     * @returns {Promise<Object|null>} Location data or null on error
     */
    async fetchLocation() {
        if (!navigator.geolocation) {
            Toast.show('Geolocation not supported', 'error');
            return null;
        }

        UI.setLocationFetching();

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    this.currentLocation = {
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                        accuracy: pos.coords.accuracy,
                        altitude: pos.coords.altitude,
                        speed: pos.coords.speed
                    };

                    UI.updateCurrentLocation(
                        this.currentLocation.lat,
                        this.currentLocation.lon,
                        this.currentLocation.accuracy
                    );

                    MapController.updateMyMarker(
                        this.currentLocation.lat,
                        this.currentLocation.lon,
                        this.currentLocation.accuracy
                    );

                    Logger.log(
                        `GPS: ${this.currentLocation.lat.toFixed(5)}, ${this.currentLocation.lon.toFixed(5)}`,
                        'success'
                    );
                    
                    resolve(this.currentLocation);
                },
                (err) => {
                    UI.setLocationError(err.message);
                    Toast.show(err.message, 'error');
                    Logger.log(`GPS error: ${err.message}`, 'error');
                    resolve(null);
                },
                CONFIG.geolocationOptions
            );
        });
    }

    /**
     * Start periodic location publishing
     */
    start() {
        if (!this._xmppClient?.isConnected()) {
            Toast.show('Not connected', 'error');
            return;
        }

        this.isSharing = true;
        const interval = UI.getShareInterval();

        UI.setSharingState(true);
        this._publishOnce();
        this.intervalId = setInterval(() => this._publishOnce(), interval);

        Toast.show('Publishing started', 'success');
        Logger.log('Started publishing', 'success');
    }

    /**
     * Stop location publishing
     */
    stop() {
        this.isSharing = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        if (this._xmppClient?.isConnected()) {
            this._xmppClient.publishEmptyGeoloc();
        }

        UI.setSharingState(false);
        Toast.show('Publishing stopped', 'info');
        Logger.log('Stopped publishing');
    }

    /**
     * Toggle sharing on/off
     */
    toggle() {
        if (this.isSharing) {
            this.stop();
        } else {
            this.start();
        }
    }

    /**
     * Fetch and publish location once
     * @private
     */
    async _publishOnce() {
        const location = await this.fetchLocation();
        if (location && this._xmppClient) {
            this._xmppClient.publishLocation(location);
            UI.updateLastShareTime();
            MapController.centerOn(location.lat, location.lon, 16);
        }
    }
}

export const LocationSharing = new LocationSharingService();
