import { IDENTITY, FEATURES } from './constants.js';

export function getDomain(jid) {
    if (!jid) return '';
    const parts = jid.split('@');
    return parts.length > 1 ? parts[1].split('/')[0] : parts[0];
}

// Basic SHA-1 for caps hash
export async function sha1Base64(str) {
    const buffer = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-1', buffer);
    return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

// XEP-0115 Calculation
export async function getCapsHash() {
    let s = `${IDENTITY.category}/${IDENTITY.type}//${IDENTITY.name}<`;
    for (const f of FEATURES) {
        s += `${f}<`;
    }
    return await sha1Base64(s);
}

export function timeAgo(dateStr) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return `${Math.round(diff)}s ago`;
    return `${Math.round(diff / 60)}m ago`;
}
