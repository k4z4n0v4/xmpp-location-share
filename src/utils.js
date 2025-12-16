import { DISCO_IDENTITY, DISCO_FEATURES } from './config.js';

/**
 * Extracts domain from a JID
 * @param {string} jid - The JID to parse
 * @returns {string} The domain portion
 */
export function extractDomain(jid) {
    const bare = (jid || '').trim().split('/')[0];
    const at = bare.indexOf('@');
    return at >= 0 ? bare.slice(at + 1) : bare;
}

/**
 * Computes SHA-1 hash and returns base64 encoded string
 * @param {string} input - String to hash
 * @returns {Promise<string>} Base64 encoded hash
 */
export async function sha1Base64(input) {
    const data = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return btoa(String.fromCharCode(...hashArray));
}

/**
 * Computes XEP-0115 caps verification hash
 * @returns {Promise<string>} The caps hash
 */
export async function computeCapsHash() {
    let S = `${DISCO_IDENTITY.category}/${DISCO_IDENTITY.type}//${DISCO_IDENTITY.name}<`;
    DISCO_FEATURES.forEach(f => S += f + '<');
    return sha1Base64(S);
}

/**
 * Formats time elapsed since a timestamp
 * @param {Date} date - The timestamp
 * @returns {string} Human readable elapsed time
 */
export function formatTimeAgo(date) {
    const seconds = Math.round((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) {
        return `${seconds}s ago`;
    }
    return `${Math.round(seconds / 60)}m ago`;
}
