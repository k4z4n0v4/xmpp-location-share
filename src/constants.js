export const NS = {
    GEOLOC: 'http://jabber.org/protocol/geoloc',
    PUBSUB: 'http://jabber.org/protocol/pubsub',
    PUBSUB_EVENT: 'http://jabber.org/protocol/pubsub#event',
    DISCO_INFO: 'http://jabber.org/protocol/disco#info',
    CAPS: 'http://jabber.org/protocol/caps',
    ROSTER: 'jabber:iq:roster'
};

// Features we support
export const FEATURES = [
    NS.DISCO_INFO,
    NS.GEOLOC,
    'http://jabber.org/protocol/geoloc+notify',
    NS.PUBSUB_EVENT,
    NS.CAPS
].sort();

export const IDENTITY = {
    category: 'client',
    type: 'web',
    name: 'XMPP Location Share'
};
