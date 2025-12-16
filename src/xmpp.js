import { Strophe, $iq, $pres } from 'strophe.js';
import { NS, FEATURES } from './constants.js';
import { getCapsHash, timeAgo } from './utils.js';
import * as UI from './ui.js';
import * as Map from './map.js';

let connection = null;
let myJid = null;
let roster = {};

export const isConnected = () => connection && connection.connected;

export async function connect(jid, password, url) {
    const capsVer = await getCapsHash();
    
    connection = new Strophe.Connection(url);
    
    connection.connect(jid, password, (status) => {
        if (status === Strophe.Status.CONNECTED) {
            myJid = Strophe.getBareJidFromJid(connection.jid);
            UI.updateConnectionStatus(true, 'Connected');
            console.log(`Logged in as ${myJid}`);
            
            const p = $pres().c('c', { 
                xmlns: NS.CAPS, 
                hash: 'sha-1', 
                node: 'https://xmpp-location.app', 
                ver: capsVer 
            });
            connection.send(p);
            
            setupHandlers();
            fetchRoster();
            
            document.querySelector('[data-tab="share"]').click();
            
        } else if (status === Strophe.Status.DISCONNECTED) {
            UI.updateConnectionStatus(false, 'Disconnected');
            connection = null;
            roster = {};
        } else if (status === Strophe.Status.CONNFAIL) {
            UI.toast('Connection failed', 'error');
            UI.updateConnectionStatus(false, 'Failed');
        } else {
            UI.updateConnectionStatus(false, 'Connecting...');
        }
    });
}

export function disconnect() {
    if (connection) {
        publishRetract(); 
        connection.flush();
        connection.disconnect();
    }
}

function setupHandlers() {
    connection.addHandler((iq) => {
        const from = iq.getAttribute('from');
        const id = iq.getAttribute('id');
        
        const reply = $iq({ type: 'result', to: from, id })
            .c('query', { xmlns: NS.DISCO_INFO })
            .c('identity', { category: 'client', type: 'web', name: 'WebLoc' }).up();
            
        FEATURES.forEach(f => reply.c('feature', { var: f }).up());
        
        connection.send(reply);
        return true;
    }, NS.DISCO_INFO, 'iq', 'get');

    connection.addHandler((msg) => {
        const from = Strophe.getBareJidFromJid(msg.getAttribute('from'));
        if (from === myJid) return true;

        const items = msg.querySelector(`event[xmlns="${NS.PUBSUB_EVENT}"] items[node="${NS.GEOLOC}"]`);
        if (!items) return true;

        if (items.querySelector('retract')) {
            console.log(`${from} stopped sharing`);
            Map.removeMarker(from);
            UI.renderUserList({}, null);
            return true;
        }

        const geoloc = items.querySelector('item geoloc');
        if (geoloc) {
            handleGeoloc(from, geoloc);
        }
        return true;
    }, null, 'message');

    connection.addHandler((pres) => {
        const from = Strophe.getBareJidFromJid(pres.getAttribute('from'));
        const type = pres.getAttribute('type');
        
        if (from !== myJid && roster[from]) {
            roster[from].online = (!type || type === 'available');
            UI.renderRoster(Object.values(roster));
            
            if (roster[from].online) requestLoc(from);
        }
        return true;
    }, null, 'presence');
}

function handleGeoloc(from, xml) {
    const lat = xml.querySelector('lat')?.textContent;
    const lon = xml.querySelector('lon')?.textContent;
    
    if (lat && lon) {
        const acc = xml.querySelector('accuracy')?.textContent || 10;
        const ts = timeAgo(new Date());
        
        const data = Map.updateUserMarker(from, lat, lon, acc, ts);
        
        UI.renderUserList({ [from]: data }, (jid) => {
            const m = Map.getMarker(jid);
            if (m) Map.centerMap(m.getLatLng().lat, m.getLatLng().lng);
        });
        
        console.log(`Loc from ${from.split('@')[0]}`);
    }
}

function fetchRoster() {
    const iq = $iq({ type: 'get' }).c('query', { xmlns: NS.ROSTER });
    connection.sendIQ(iq, (res) => {
        const items = res.querySelectorAll('item');
        items.forEach(item => {
            const jid = item.getAttribute('jid');
            roster[jid] = {
                jid,
                name: item.getAttribute('name') || jid.split('@')[0],
                sub: item.getAttribute('subscription'),
                online: false
            };
        });
        UI.renderRoster(Object.values(roster));
        console.log(`Roster loaded (${items.length})`);
    });
}

export function requestLoc(jid) {
    const iq = $iq({ type: 'get', to: jid })
        .c('pubsub', { xmlns: NS.PUBSUB })
        .c('items', { node: NS.GEOLOC, max_items: '1' });
        
    connection.send(iq);
}

export function publishLocation(coords) {
    if (!connection) return;
    
    const iq = $iq({ type: 'set' })
        .c('pubsub', { xmlns: NS.PUBSUB })
        .c('publish', { node: NS.GEOLOC })
        .c('item', { id: 'current' })
        .c('geoloc', { xmlns: NS.GEOLOC })
        .c('lat').t(coords.latitude).up()
        .c('lon').t(coords.longitude).up()
        .c('accuracy').t(Math.round(coords.accuracy)).up()
        .c('timestamp').t(new Date().toISOString()).up();
        
    if (coords.altitude) iq.c('alt').t(coords.altitude).up();
    if (coords.speed) iq.c('speed').t(coords.speed).up();
        
    connection.sendIQ(iq, 
        () => console.log('Published location'),
        (err) => console.warn('Publish failed')
    );
}

export function publishRetract() {
    if (!connection) return;
    
    const iq = $iq({ type: 'set' })
        .c('pubsub', { xmlns: NS.PUBSUB })
        .c('publish', { node: NS.GEOLOC })
        .c('item', { id: 'current' })
        .c('geoloc', { xmlns: NS.GEOLOC });

    connection.sendIQ(iq, () => console.log('Location cleared'));
}

export async function discover(domain) {
    console.log(`Discovering ${domain}...`);

    try {
        const res = await fetch(`https://${domain}/.well-known/host-meta.json`, { mode: 'cors' });
        if (res.ok) {
            const json = await res.json();
            const link = json.links.find(l => l.rel === 'urn:xmpp:alt-connections:websocket');
            if (link) return link.href;
        }
    } catch (e) { /* ignore */ }

    try {
        const res = await fetch(`https://${domain}/.well-known/host-meta`, { mode: 'cors' });
        if (res.ok) {
            const text = await res.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');
            const links = xml.getElementsByTagName('Link');
            
            for (let i = 0; i < links.length; i++) {
                if (links[i].getAttribute('rel') === 'urn:xmpp:alt-connections:websocket') {
                    let href = links[i].getAttribute('href');
                    return href.replace('{host}', domain);
                }
            }
        }
    } catch (e) { /* ignore */ }

    return null;
}
