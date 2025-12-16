import { CONFIG } from './config.js';
import { extractDomain } from './utils.js';
import { Logger } from './services/logger.js';
import { Toast } from './services/toast.js';
import { Discovery } from './services/discovery.js';
import { UI } from './ui/controller.js';
import { MapController } from './map/controller.js';
import { LocationSharing } from './location-sharing.js';
import { XMPPClient } from './xmpp/client.js';

/**
 * Bind all event listeners
 */
function bindEvents() {
    // Tab navigation
    document.getElementById('tabContainer').addEventListener('click', (e) => {
        const tab = e.target.closest('[data-tab]');
        if (tab) {
            UI.showTab(tab.dataset.tab);
        }
    });

    // Login form submission
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const { jid, password, boshUrl } = UI.getFormValues();

        if (!jid || !password) {
            Toast.show('Enter JID and password', 'error');
            return;
        }

        let url = boshUrl;

        // Auto-discover if no URL provided
        if (!url) {
            UI.setDiscoveryLoading(true);
            UI.setDiscoveryStatus(`Discovering ${extractDomain(jid)}…`);

            url = await Discovery.discoverEndpoints(extractDomain(jid));

            UI.setDiscoveryLoading(false);

            if (!url) {
                UI.setDiscoveryStatus('Discovery failed. Enter URL manually.');
                Toast.show('No endpoint found', 'error');
                return;
            }

            UI.setBoshUrl(url, true);
            UI.setDiscoveryStatus('Endpoint discovered.');
        }

        XMPPClient.connect(jid, password, url);
    });

    // Auto-discover button
    document.getElementById('discoverBtn').addEventListener('click', async () => {
        const { jid } = UI.getFormValues();
        const domain = extractDomain(jid);

        if (!domain) {
            Toast.show('Enter JID first', 'error');
            return;
        }

        UI.setDiscoveryLoading(true);
        UI.setDiscoveryStatus(`Discovering ${domain}…`);

        const url = await Discovery.discoverEndpoints(domain);

        UI.setDiscoveryLoading(false);

        if (url) {
            UI.setBoshUrl(url, true);  // Mark as from discovery
            UI.setDiscoveryStatus('Endpoint discovered.');
            Toast.show('Endpoint found', 'success');
        } else {
            UI.setDiscoveryStatus('Discovery failed. Enter URL manually.');
            Toast.show('Discovery failed', 'error');
        }
    });

    // Disconnect button
    document.getElementById('disconnectBtn').addEventListener('click', () => {
        LocationSharing.stop();
        XMPPClient.disconnect();
    });

    // Clear log button
    document.getElementById('clearLogBtn').addEventListener('click', () => {
        Logger.clear();
    });

    // Get location button
    document.getElementById('getLocationBtn').addEventListener('click', async () => {
        const loc = await LocationSharing.fetchLocation();
        if (loc) {
            MapController.centerOn(loc.lat, loc.lon, 16);
            Toast.show('Location updated', 'success');
        }
    });

    // Share toggle button
    document.getElementById('shareToggleBtn').addEventListener('click', () => {
        LocationSharing.toggle();
    });

    // Fit markers button
    document.getElementById('fitMarkersBtn').addEventListener('click', () => {
        MapController.fitAllMarkers();
    });

    // Follow button
    document.getElementById('followBtn').addEventListener('click', () => {
        MapController.toggleAutoFollow();
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        XMPPClient.refreshAllLocations();
    });

    // User list clicks (event delegation)
    document.getElementById('userList').addEventListener('click', (e) => {
        const item = e.target.closest('[data-center-jid]');
        if (item) {
            const jid = item.dataset.centerJid;
            const marker = MapController.getMarkers()[jid];
            if (marker) {
                MapController.centerOn(marker.lat, marker.lon, 16);
            }
        }
    });
}

/**
 * Initialize the application
 */
function init() {
    // Initialize services
    Logger.init('debugLog');
    Toast.init('toasts');
    UI.init();
    MapController.init('map');

    // Wire up dependencies
    LocationSharing.setXMPPClient(XMPPClient);

    // Bind event handlers
    bindEvents();

    // Periodic user list update
    setInterval(() => {
        if (Object.keys(MapController.getMarkers()).length > 0) {
            XMPPClient.updateUserList();
        }
    }, CONFIG.userListUpdateInterval);

    Logger.log('XMPP Location Share initialized');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
