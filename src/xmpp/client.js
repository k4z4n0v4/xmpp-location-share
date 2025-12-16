import { Strophe, $iq, $pres } from 'strophe.js';
import { NS, DISCO_IDENTITY, DISCO_FEATURES, CONFIG } from '../config.js';
import { computeCapsHash, formatTimeAgo } from '../utils.js';
import { Logger } from '../services/logger.js';
import { Toast } from '../services/toast.js';
import { UI } from '../ui/controller.js';
import { MapController } from '../map/controller.js';

/**
 * XMPP client for location sharing
 */
class XMPPClientService {
    constructor() {
        this.connection = null;
        this.myJid = null;
        this.capsHash = null;
        this.rosterContacts = {};
    }

    /**
     * Connect to XMPP server
     * @param {string} jid - User JID
     * @param {string} password - Password
     * @param {string} url - WebSocket or BOSH URL
     */
    async connect(jid, password, url) {
        this.capsHash = await computeCapsHash();
        Logger.log(`Caps hash: ${this.capsHash}`);

        this.connection = new Strophe.Connection(url);
        this.connection.connect(jid, password, this._onStatusChange.bind(this));
    }

    /**
     * Disconnect from XMPP server
     */
    disconnect() {
        if (this.connection) {
            this.connection.disconnect();
        }
    }

    /**
     * Check if connected
     * @returns {boolean}
     */
    isConnected() {
        return this.connection?.connected ?? false;
    }

    /**
     * Handle connection status changes
     * @private
     */
    _onStatusChange(status) {
        const statusMap = {
            [Strophe.Status.CONNECTING]: { msg: 'Connecting…', connected: false },
            [Strophe.Status.CONNFAIL]: { msg: 'Connection failed', connected: false, error: true },
            [Strophe.Status.AUTHFAIL]: { msg: 'Authentication failed', connected: false, error: true },
            [Strophe.Status.DISCONNECTING]: { msg: 'Disconnecting…', connected: false },
            [Strophe.Status.DISCONNECTED]: { msg: 'Disconnected', connected: false },
            [Strophe.Status.CONNECTED]: { msg: 'Connected', connected: true }
        };

        const state = statusMap[status] || { msg: 'Unknown', connected: false };
        UI.updateConnectionStatus(state.msg, state.connected);
        Logger.log(`Status: ${state.msg}`, state.error ? 'error' : (state.connected ? 'success' : 'info'));

        if (status === Strophe.Status.CONNECTED) {
            this._onConnected();
        } else if (status === Strophe.Status.DISCONNECTED) {
            this._onDisconnected();
        } else if (state.error) {
            Toast.show(state.msg, 'error');
        }
    }

    /**
     * Handle successful connection
     * @private
     */
    _onConnected() {
        this.myJid = Strophe.getBareJidFromJid(this.connection.jid);
        Toast.show(`Connected as ${this.myJid}`, 'success');

        // Register handlers
        this.connection.addHandler(this._onDiscoInfo.bind(this), NS.DISCO_INFO, 'iq', 'get');
        this.connection.addHandler(this._onPEPEvent.bind(this), NS.PUBSUB_EVENT, 'message');
        this.connection.addHandler(this._onPEPEvent.bind(this), null, 'message', 'headline');
        this.connection.addHandler(this._onPresence.bind(this), null, 'presence');

        // Send presence with caps
        const presence = $pres().c('c', {
            xmlns: NS.CAPS,
            hash: 'sha-1',
            node: CONFIG.capsNode,
            ver: this.capsHash
        });
        this.connection.send(presence.tree());

        this._requestRoster();
        UI.setConnectedState(true);
        UI.showTab('share');
    }

    /**
     * Handle disconnection
     * @private
     */
    _onDisconnected() {
        this.rosterContacts = {};
        UI.setConnectedState(false);
    }

    /**
     * Handle disco#info requests
     * @private
     */
    _onDiscoInfo(iq) {
        const from = iq.getAttribute('from');
        const id = iq.getAttribute('id');
        const query = iq.getElementsByTagNameNS(NS.DISCO_INFO, 'query')[0];
        const node = query?.getAttribute('node');

        const attrs = { xmlns: NS.DISCO_INFO };
        if (node) attrs.node = node;

        const response = $iq({ type: 'result', to: from, id })
            .c('query', attrs)
            .c('identity', DISCO_IDENTITY).up();

        DISCO_FEATURES.forEach(f => response.c('feature', { var: f }).up());
        this.connection.send(response.tree());

        Logger.log(`Disco response sent to ${from}`);
        return true;
    }

    /**
     * Handle presence stanzas
     * @private
     */
    _onPresence(pres) {
        const from = Strophe.getBareJidFromJid(pres.getAttribute('from'));
        const type = pres.getAttribute('type');

        if (from === this.myJid) return true;

        const contact = this.rosterContacts[from];
        if (!contact) return true;

        const wasOnline = contact.online;
        contact.online = !type || type === 'available';

        if (contact.online && !wasOnline) {
            Logger.log(`${from.split('@')[0]} is online`);
            this.requestContactGeoloc(from);
        }

        this._updateRosterUI();
        return true;
    }

    /**
     * Handle PEP events
     * @private
     */
    _onPEPEvent(msg) {
        const from = Strophe.getBareJidFromJid(msg.getAttribute('from'));
        if (from === this.myJid) return true;

        const event = msg.getElementsByTagNameNS(NS.PUBSUB_EVENT, 'event')[0];
        if (!event) return true;

        const items = event.getElementsByTagName('items')[0];
        if (!items || items.getAttribute('node') !== NS.GEOLOC) return true;

        // Handle retract (location cleared)
        if (items.getElementsByTagName('retract')[0]) {
            Logger.log(`${from.split('@')[0]} cleared location`);
            MapController.removeMarker(from);
            this._updateUserList();
            return true;
        }

        const geoloc = items.querySelector('item geoloc');
        if (geoloc) {
            this._processGeoloc(from, geoloc);
        }

        return true;
    }

    /**
     * Process geoloc element
     * @private
     */
    _processGeoloc(from, geoloc) {
        const lat = geoloc.querySelector('lat')?.textContent;
        const lon = geoloc.querySelector('lon')?.textContent;

        if (!lat || !lon) {
            MapController.removeMarker(from);
            this._updateUserList();
            return;
        }

        const accuracy = parseFloat(geoloc.querySelector('accuracy')?.textContent || '10');
        const timestamp = geoloc.querySelector('timestamp')?.textContent || new Date().toISOString();

        Logger.log(
            `Geoloc from ${from.split('@')[0]}: ${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}`,
            'success'
        );
        
        MapController.updateUserMarker(from, parseFloat(lat), parseFloat(lon), accuracy, timestamp);
        this._updateUserList();
    }

    /**
     * Request roster from server
     * @private
     */
    _requestRoster() {
        Logger.log('Requesting roster...');
        const iq = $iq({ type: 'get' }).c('query', { xmlns: NS.ROSTER });
        this.connection.sendIQ(
            iq.tree(),
            this._handleRoster.bind(this),
            () => Logger.log('Roster request failed', 'error')
        );
    }

    /**
     * Handle roster response
     * @private
     */
    _handleRoster(result) {
        this.rosterContacts = {};

        for (const item of result.getElementsByTagName('item')) {
            const jid = item.getAttribute('jid');
            this.rosterContacts[jid] = {
                subscription: item.getAttribute('subscription'),
                name: item.getAttribute('name') || jid.split('@')[0],
                online: false
            };
        }

        Logger.log(`Roster: ${Object.keys(this.rosterContacts).length} contacts`);
        this._updateRosterUI();
    }

    /**
    * Update roster list UI
    * @private
    */
    _updateRosterUI() {
      const entries = Object.entries(this.rosterContacts);
      const list = document.getElementById('rosterList');

      if (entries.length === 0) {
          list.innerHTML = '<p class="italic text-gray-500">No contacts</p>';
          return;
      }

      // Sort: online first, then by name
      const sorted = entries.sort((a, b) => {
          if (a[1].online !== b[1].online) {
              return b[1].online ? 1 : -1;
          }
          return a[1].name.localeCompare(b[1].name);
      });

      list.innerHTML = sorted.map(([jid, data]) => {
          const statusInfo = this._getSubscriptionInfo(data.subscription);
          const onlineClass = data.online ? 'bg-green-500' : 'bg-gray-500';
          const onlineText = data.online ? 'Online' : 'Offline';
          
          return `
              <div class="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-700/50 transition-colors">
                  <div class="relative">
                      <div class="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs font-medium">
                          ${data.name.charAt(0).toUpperCase()}
                      </div>
                      <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 ${onlineClass} rounded-full border-2 border-gray-800" 
                          title="${onlineText}"></div>
                  </div>
                  <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium truncate">${data.name}</div>
                      <div class="flex items-center gap-1 text-xs ${statusInfo.color}">
                          ${statusInfo.icon}
                          <span>${statusInfo.label}</span>
                      </div>
                  </div>
              </div>`;
      }).join('');
    }

    /**
    * Get human-readable subscription info
    * @param {string} subscription - XMPP subscription state
    * @returns {{label: string, color: string, icon: string}}
    * @private
    */
    _getSubscriptionInfo(subscription) {
      const states = {
          'both': {
              label: 'Can share locations',
              color: 'text-green-400',
              icon: `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
              </svg>`
          },
          'to': {
              label: 'You follow them',
              color: 'text-yellow-400',
              icon: `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
              </svg>`
          },
          'from': {
              label: 'They follow you',
              color: 'text-yellow-400',
              icon: `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 17l-5-5m0 0l5-5m-5 5h12"/>
              </svg>`
          },
          'none': {
              label: 'Not connected',
              color: 'text-gray-500',
              icon: `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
              </svg>`
          }
      };

      return states[subscription] || states['none'];
    }

    /**
     * Update user list UI
     */
    updateUserList() {
        const markers = MapController.getMarkers();
        const list = document.getElementById('userList');

        if (Object.keys(markers).length === 0) {
            list.innerHTML = '<p class="text-gray-500 text-sm italic">No active location shares</p>';
            return;
        }

        list.innerHTML = Object.entries(markers).map(([jid, data]) => {
            const color = MapController.getUserColor(jid);
            const name = jid.split('@')[0];
            const ago = formatTimeAgo(new Date(data.lastUpdate));

            return `
                <div class="flex items-center gap-3 p-2 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700"
                     data-center-jid="${jid}">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                         style="background:${color}">${name.charAt(0).toUpperCase()}</div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium truncate">${name}</div>
                        <div class="text-xs text-gray-400">${ago}</div>
                    </div>
                    <div class="w-2 h-2 bg-green-500 rounded-full pulse"></div>
                </div>`;
        }).join('');
    }

    /**
     * Alias for internal update
     * @private
     */
    _updateUserList() {
        this.updateUserList();
    }

    /**
     * Request a contact's geoloc
     * @param {string} jid - Contact's JID
     */
    requestContactGeoloc(jid) {
        const iq = $iq({ type: 'get', to: jid })
            .c('pubsub', { xmlns: NS.PUBSUB })
            .c('items', { node: NS.GEOLOC, max_items: '1' });

        this.connection.sendIQ(
            iq.tree(),
            (result) => {
                const geoloc = result.querySelector('pubsub items item geoloc');
                if (geoloc) this._processGeoloc(jid, geoloc);
            },
            () => Logger.log(`Geoloc request for ${jid.split('@')[0]} failed`, 'warn')
        );
    }

    /**
     * Refresh all contact locations
     */
    refreshAllLocations() {
        Logger.log('Refreshing all locations...');
        Object.entries(this.rosterContacts).forEach(([jid, data]) => {
            if (data.online || data.subscription === 'both') {
                this.requestContactGeoloc(jid);
            }
        });
        Toast.show('Refreshing locations...', 'info');
    }

    /**
     * Publish current location via PEP
     * @param {Object} location - Location data
     */
    publishLocation(location) {
        const timestamp = new Date().toISOString();

        const iq = $iq({ type: 'set', from: this.connection.jid })
            .c('pubsub', { xmlns: NS.PUBSUB })
            .c('publish', { node: NS.GEOLOC })
            .c('item', { id: 'current' })
            .c('geoloc', { xmlns: NS.GEOLOC })
            .c('lat').t(location.lat.toString()).up()
            .c('lon').t(location.lon.toString()).up()
            .c('accuracy').t(Math.round(location.accuracy).toString()).up()
            .c('timestamp').t(timestamp).up();

        if (location.altitude != null) {
            iq.c('alt').t(location.altitude.toString()).up();
        }
        if (location.speed != null) {
            iq.c('speed').t(location.speed.toString()).up();
        }

        this.connection.sendIQ(
            iq.tree(),
            () => Logger.log('Location published', 'success'),
            (err) => Logger.log('Publish failed: ' + (err?.textContent || 'unknown'), 'error')
        );
    }

    /**
     * Publish empty geoloc to clear location
     */
    publishEmptyGeoloc() {
        const iq = $iq({ type: 'set', from: this.connection.jid })
            .c('pubsub', { xmlns: NS.PUBSUB })
            .c('publish', { node: NS.GEOLOC })
            .c('item', { id: 'current' })
            .c('geoloc', { xmlns: NS.GEOLOC });

        this.connection.sendIQ(
            iq.tree(),
            () => Logger.log('Location cleared'),
            () => Logger.log('Clear failed', 'error')
        );
    }
}

export const XMPPClient = new XMPPClientService();
