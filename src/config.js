/**
 * Application configuration constants
 */
export const CONFIG = Object.freeze({
    capsNode: 'https://xmpp-location.app',
    defaultMapCenter: [51.505, -0.09],
    defaultMapZoom: 13,
    toastDuration: 3500,
    userListUpdateInterval: 5000,
    geolocationOptions: {
        enableHighAccuracy: true,
        timeout: 10000
    }
});

/**
 * XMPP namespace constants
 */
export const NS = Object.freeze({
    GEOLOC: 'http://jabber.org/protocol/geoloc',
    GEOLOC_NOTIFY: 'http://jabber.org/protocol/geoloc+notify',
    PUBSUB: 'http://jabber.org/protocol/pubsub',
    PUBSUB_EVENT: 'http://jabber.org/protocol/pubsub#event',
    DISCO_INFO: 'http://jabber.org/protocol/disco#info',
    CAPS: 'http://jabber.org/protocol/caps',
    ROSTER: 'jabber:iq:roster'
});

/**
 * XEP-0030 Disco identity for this client
 */
export const DISCO_IDENTITY = Object.freeze({
    category: 'client',
    type: 'web',
    name: 'XMPP Location Share'
});

/**
 * XEP-0030 features advertised by this client
 */
export const DISCO_FEATURES = Object.freeze([
    'http://jabber.org/protocol/disco#info',
    'http://jabber.org/protocol/geoloc',
    'http://jabber.org/protocol/geoloc+notify',
    'http://jabber.org/protocol/pubsub#event',
    'http://jabber.org/protocol/caps'
].sort());

/**
 * Color palette for user markers
 */
export const COLOR_PALETTE = Object.freeze([
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4'
]);
