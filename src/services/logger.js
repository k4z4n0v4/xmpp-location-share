/**
 * Debug logging service
 */
class LoggerService {
    constructor() {
        this._el = null;
    }

    /**
     * Initialize the logger with a DOM element
     * @param {string} elementId - ID of the log container element
     */
    init(elementId) {
        this._el = document.getElementById(elementId);
    }

    /**
     * Log a message
     * @param {string} message - Message to log
     * @param {'info'|'success'|'error'|'warn'} type - Log level
     */
    log(message, type = 'info') {
        if (!this._el) return;

        const colors = {
            info: 'text-gray-400',
            success: 'text-green-400',
            error: 'text-red-400',
            warn: 'text-yellow-400'
        };

        const time = new Date().toLocaleTimeString();
        const p = document.createElement('p');
        p.className = colors[type] || colors.info;
        p.textContent = `[${time}] ${message}`;
        this._el.appendChild(p);
        this._el.scrollTop = this._el.scrollHeight;

        // Also log to console
        const consoleMethods = { info: 'log', success: 'log', error: 'error', warn: 'warn' };
        console[consoleMethods[type] || 'log'](`[${type.toUpperCase()}] ${message}`);
    }

    /**
     * Clear all log entries
     */
    clear() {
        if (this._el) {
            this._el.innerHTML = '<p class="text-gray-500 italic">Logs cleared...</p>';
        }
    }
}

export const Logger = new LoggerService();
