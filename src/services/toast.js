import { CONFIG } from '../config.js';

/**
 * Toast notification service
 */
class ToastService {
    constructor() {
        this._container = null;
    }

    /**
     * Initialize toast service with container element
     * @param {string} containerId - ID of the toast container element
     */
    init(containerId) {
        this._container = document.getElementById(containerId);
    }

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {'info'|'success'|'error'|'location'} type - Toast type
     */
    show(message, type = 'info') {
        if (!this._container) return;

        const colors = {
            info: 'bg-gray-800',
            success: 'bg-green-600',
            error: 'bg-red-600',
            location: 'bg-indigo-600'
        };

        const toast = document.createElement('div');
        toast.className = `${colors[type] || colors.info} px-4 py-2 rounded-lg shadow-lg text-sm max-w-xs border border-white/10 transition-opacity duration-300`;
        toast.textContent = message;
        this._container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, CONFIG.toastDuration);
    }
}

export const Toast = new ToastService();
