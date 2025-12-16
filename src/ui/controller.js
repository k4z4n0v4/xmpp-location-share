import { extractDomain } from '../utils.js';

/**
 * UI controller for managing DOM state
 */
class UIController {
    constructor() {
        this.elements = {};
        this._urlManuallyEdited = false;
        this._lastAutoDomain = '';
    }

    /**
     * Initialize UI controller by caching DOM elements
     */
    init() {
        this.elements = {
            connectionStatus: document.getElementById('connectionStatus'),
            connectBtn: document.getElementById('connectBtn'),
            disconnectBtn: document.getElementById('disconnectBtn'),
            shareNotConnected: document.getElementById('shareNotConnected'),
            shareConnected: document.getElementById('shareConnected'),
            shareToggleBtn: document.getElementById('shareToggleBtn'),
            sharingStatus: document.getElementById('sharingStatus'),
            lastShareTime: document.getElementById('lastShareTime'),
            currentLocationText: document.getElementById('currentLocationText'),
            userList: document.getElementById('userList'),
            rosterList: document.getElementById('rosterList'),
            myLocationBadge: document.getElementById('myLocationBadge'),
            followBtn: document.getElementById('followBtn'),
            discoveryStatus: document.getElementById('discoveryStatus'),
            discoverBtn: document.getElementById('discoverBtn'),
            jid: document.getElementById('jid'),
            password: document.getElementById('password'),
            boshUrl: document.getElementById('boshUrl'),
            shareInterval: document.getElementById('shareInterval')
        };

        // Set up auto-fill listeners
        this._setupAutoFill();
    }

    /**
     * Set up JID to URL auto-fill behavior
     * @private
     */
    _setupAutoFill() {
        // Track manual edits to URL field
        this.elements.boshUrl.addEventListener('input', () => {
            const currentUrl = this.elements.boshUrl.value.trim();
            const expectedAutoUrl = this._buildWebSocketUrl(this._lastAutoDomain);
            
            // If user typed something different from what we auto-filled, mark as manual
            if (currentUrl && currentUrl !== expectedAutoUrl) {
                this._urlManuallyEdited = true;
            }
            
            // If user clears the field, allow auto-fill again
            if (!currentUrl) {
                this._urlManuallyEdited = false;
            }
        });

        // Auto-fill URL as user types JID
        this.elements.jid.addEventListener('input', () => {
            this._updateUrlFromJid();
        });
    }

    /**
     * Build WebSocket URL from domain
     * @param {string} domain - Domain name
     * @returns {string} WebSocket URL
     * @private
     */
    _buildWebSocketUrl(domain) {
        if (!domain) return '';
        return `wss://${domain}:5281/xmpp-websocket`;
    }

    /**
     * Update URL field based on current JID
     * @private
     */
    _updateUrlFromJid() {
        // Don't override manual edits
        if (this._urlManuallyEdited) return;

        const jid = this.elements.jid.value;
        const domain = extractDomain(jid);

        // Only update if we have a domain
        if (domain && domain.includes('.')) {
            this._lastAutoDomain = domain;
            this.elements.boshUrl.value = this._buildWebSocketUrl(domain);
        } else if (!domain) {
            // Clear if no domain
            this._lastAutoDomain = '';
            this.elements.boshUrl.value = '';
        }
    }

    /**
     * Switch to a specific tab
     * @param {string} tabName - Name of tab to show
     */
    showTab(tabName) {
        document.querySelectorAll('[data-panel]').forEach(panel => {
            panel.classList.toggle('hidden', panel.dataset.panel !== tabName);
        });
        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.classList.toggle('tab-active', btn.dataset.tab === tabName);
        });
    }

    /**
     * Update connection status display
     * @param {string} status - Status text
     * @param {boolean} isConnected - Whether connected
     */
    updateConnectionStatus(status, isConnected) {
        const el = this.elements.connectionStatus;
        const color = isConnected ? 'bg-green-500' : 'bg-red-500';
        const pulse = isConnected ? 'pulse' : '';
        el.innerHTML = `<span class="w-2 h-2 ${color} rounded-full ${pulse}"></span><span>${status}</span>`;
    }

    /**
     * Set UI to connected or disconnected state
     * @param {boolean} connected - Whether connected
     */
    setConnectedState(connected) {
        this.elements.connectBtn.classList.toggle('hidden', connected);
        this.elements.disconnectBtn.classList.toggle('hidden', !connected);
        this.elements.shareNotConnected.classList.toggle('hidden', connected);
        this.elements.shareConnected.classList.toggle('hidden', !connected);

        if (!connected) {
            this.elements.rosterList.innerHTML = '<p class="italic text-gray-500">Connect to see contacts</p>';
        }
    }

    /**
     * Update UI for sharing state
     * @param {boolean} isSharing - Whether currently sharing
     */
    setSharingState(isSharing) {
        const btn = this.elements.shareToggleBtn;

        if (isSharing) {
            btn.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" stroke-width="2"/>
                </svg>
                Stop Publishing`;
            btn.className = 'w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition flex items-center justify-center gap-2';
        } else {
            btn.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z"/>
                </svg>
                Start Publishing`;
            btn.className = 'w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition flex items-center justify-center gap-2';
        }

        this.elements.sharingStatus.classList.toggle('hidden', !isSharing);
    }

    /**
     * Update last share time display
     */
    updateLastShareTime() {
        this.elements.lastShareTime.textContent = `Last published: ${new Date().toLocaleTimeString()}`;
    }

    /**
     * Update current location display
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {number} accuracy - Accuracy in meters
     */
    updateCurrentLocation(lat, lon, accuracy) {
        this.elements.currentLocationText.innerHTML =
            `${lat.toFixed(5)}, ${lon.toFixed(5)}<br>` +
            `<span class="text-gray-500">Accuracy: ±${Math.round(accuracy)}m</span>`;
    }

    /**
     * Set location fetching state
     */
    setLocationFetching() {
        this.elements.currentLocationText.textContent = 'Fetching GPS…';
    }

    /**
     * Set location error state
     * @param {string} message - Error message
     */
    setLocationError(message) {
        this.elements.currentLocationText.textContent = `Error: ${message}`;
    }

    /**
     * Show the "my location" badge on the map
     */
    showMyLocationBadge() {
        this.elements.myLocationBadge.classList.remove('hidden');
    }

    /**
     * Update auto-follow button state
     * @param {boolean} enabled - Whether auto-follow is enabled
     */
    setAutoFollow(enabled) {
        const btn = this.elements.followBtn;
        btn.textContent = enabled ? 'Disable Auto-Follow' : 'Enable Auto-Follow';
        btn.classList.toggle('bg-indigo-600', enabled);
        btn.classList.toggle('hover:bg-indigo-700', enabled);
        btn.classList.toggle('bg-gray-700', !enabled);
        btn.classList.toggle('hover:bg-gray-600', !enabled);
    }

    /**
     * Set discovery button loading state
     * @param {boolean} loading - Whether discovery is in progress
     */
    setDiscoveryLoading(loading) {
        const btn = this.elements.discoverBtn;
        btn.disabled = loading;
        btn.classList.toggle('opacity-60', loading);
        btn.classList.toggle('cursor-not-allowed', loading);
    }

    /**
     * Update discovery status text
     * @param {string} message - Status message
     */
    setDiscoveryStatus(message) {
        this.elements.discoveryStatus.textContent = message;
    }

    /**
     * Get form values
     * @returns {{jid: string, password: string, boshUrl: string}}
     */
    getFormValues() {
        return {
            jid: this.elements.jid.value.trim(),
            password: this.elements.password.value,
            boshUrl: this.elements.boshUrl.value.trim()
        };
    }

    /**
     * Set BOSH URL field value
     * @param {string} url - URL to set
     * @param {boolean} fromDiscovery - Whether this came from auto-discovery
     */
    setBoshUrl(url, fromDiscovery = false) {
        this.elements.boshUrl.value = url;
        
        // Discovery results should be treated as "manual" to prevent overwriting
        if (fromDiscovery && url) {
            this._urlManuallyEdited = true;
        }
    }

    /**
     * Reset URL field to allow auto-fill again
     */
    resetUrlAutoFill() {
        this._urlManuallyEdited = false;
        this._updateUrlFromJid();
    }

    /**
     * Get share interval in milliseconds
     * @returns {number}
     */
    getShareInterval() {
        return parseInt(this.elements.shareInterval.value, 10) * 1000;
    }
}

export const UI = new UIController();
