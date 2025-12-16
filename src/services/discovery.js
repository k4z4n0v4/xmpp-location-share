import { Logger } from './logger.js';

/**
 * XEP-0156 endpoint discovery service
 */
class DiscoveryService {
    /**
     * Discover XMPP connection endpoints for a domain
     * @param {string} domain - Domain to discover endpoints for
     * @returns {Promise<string|null>} WebSocket or BOSH URL, or null if not found
     */
    async discoverEndpoints(domain) {
        Logger.log(`Discovering endpoints for ${domain}...`);
        const result = await this._fetchHostMeta(domain);
        
        const endpoint = result.websocket || result.bosh || null;
        
        if (endpoint) {
            Logger.log(`Found endpoint: ${endpoint}`, 'success');
        } else {
            Logger.log('No endpoints found', 'warn');
        }
        
        return endpoint;
    }

    /**
     * Fetch and parse host-meta from domain
     * @private
     */
    async _fetchHostMeta(domain) {
        const base = `https://${domain}/.well-known/host-meta`;

        // Try JSON first (preferred)
        try {
            const res = await fetch(`${base}.json`, { 
                mode: 'cors', 
                cache: 'no-cache' 
            });
            if (res.ok) {
                const json = await res.json();
                return this._parseJson(json, domain);
            }
        } catch (e) {
            // JSON not available, try XML
        }

        // Fall back to XML
        try {
            const res = await fetch(base, { 
                mode: 'cors', 
                cache: 'no-cache' 
            });
            if (res.ok) {
                const text = await res.text();
                return this._parseXml(text, domain);
            }
        } catch (e) {
            // XML also not available
        }

        return { websocket: null, bosh: null };
    }

    /**
     * Parse JSON host-meta response
     * @private
     */
    _parseJson(doc, domain) {
        const links = Array.isArray(doc?.links) ? doc.links : [];
        return this._extractEndpoints(links, domain);
    }

    /**
     * Parse XML host-meta response
     * @private
     */
    _parseXml(xmlText, domain) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, 'application/xml');
        const links = Array.from(xml.getElementsByTagName('Link')).map(el => ({
            rel: el.getAttribute('rel'),
            href: el.getAttribute('href') || el.getAttribute('template')
        }));
        return this._extractEndpoints(links, domain);
    }

    /**
     * Extract endpoints from parsed links
     * @private
     */
    _extractEndpoints(links, domain) {
        const result = { websocket: null, bosh: null };

        for (const link of links) {
            if (!link || !link.rel) continue;
            
            const href = (link.href || '').replace('{host}', domain);

            if (link.rel === 'urn:xmpp:alt-connections:websocket' && href) {
                // Prefer wss:// over ws://
                if (!result.websocket || href.startsWith('wss://')) {
                    result.websocket = href;
                }
            }
            if (link.rel === 'urn:xmpp:alt-connections:xbosh' && href) {
                result.bosh = href;
            }
        }

        return result;
    }
}

export const Discovery = new DiscoveryService();
