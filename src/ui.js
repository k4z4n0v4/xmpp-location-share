// Quick palette for markers
const COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'
];

let toastContainer = null;

export function initUI() {
    toastContainer = document.getElementById('toasts');
    
    // Tab switching
    const tabs = document.querySelectorAll('[data-tab]');
    const panels = document.querySelectorAll('[data-panel]');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('tab-active'));
            panels.forEach(p => p.classList.add('hidden'));
            
            tab.classList.add('tab-active');
            document.getElementById(`panel${capitalize(tab.dataset.tab)}`).classList.remove('hidden');
        });
    });
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function toast(msg, type = 'info') {
    if (!toastContainer) return;
    
    const bg = type === 'error' ? 'bg-red-600' : (type === 'success' ? 'bg-green-600' : 'bg-gray-800');
    
    const el = document.createElement('div');
    el.className = `${bg} px-4 py-2 rounded-lg shadow-lg text-sm border border-white/10 transition-all duration-300`;
    el.textContent = msg;
    
    toastContainer.appendChild(el);
    
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

export function updateConnectionStatus(isConnected, text) {
    const el = document.getElementById('connectionStatus');
    const color = isConnected ? 'bg-green-500' : 'bg-red-500';
    el.innerHTML = `<span class="w-2 h-2 ${color} rounded-full ${isConnected ? 'pulse' : ''}"></span><span>${text}</span>`;
    
    // Toggle UI sections
    document.getElementById('connectBtn').classList.toggle('hidden', isConnected);
    document.getElementById('disconnectBtn').classList.toggle('hidden', !isConnected);
    document.getElementById('shareNotConnected').classList.toggle('hidden', isConnected);
    document.getElementById('shareConnected').classList.toggle('hidden', !isConnected);
}

export function renderRoster(contacts) {
    const list = document.getElementById('rosterList');
    if (!contacts.length) {
        list.innerHTML = '<p class="italic text-gray-500 text-xs">No contacts found</p>';
        return;
    }

    // Sort: Online first, then Name
    contacts.sort((a, b) => {
        if (a.online !== b.online) return b.online ? 1 : -1;
        return a.name.localeCompare(b.name);
    });

    list.innerHTML = '';
    
    contacts.forEach(c => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-700/50';
        
        // Map subscription to template ID
        let tmplId = 'icon-none';
        if (c.sub === 'both') tmplId = 'icon-both';
        else if (c.sub === 'to') tmplId = 'icon-to';
        else if (c.sub === 'from') tmplId = 'icon-from';
        
        // Grab template content
        const tmpl = document.getElementById(tmplId);
        const iconHtml = tmpl ? tmpl.innerHTML : '';
        
        // Status Text
        const labels = {
            'both': 'Can share locations',
            'to': 'You follow them',
            'from': 'They follow you',
            'none': 'Not connected'
        };
        const label = labels[c.sub] || 'Unknown';

        div.innerHTML = `
            <div class="relative">
                <div class="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold">
                    ${c.name[0].toUpperCase()}
                </div>
                <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 ${c.online ? 'bg-green-500' : 'bg-gray-500'} rounded-full border-2 border-gray-800"></div>
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">${c.name}</div>
                <div class="flex items-center gap-1 text-xs text-gray-400">
                    ${iconHtml}
                    <span>${label}</span>
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}

export function renderUserList(users, onUserClick) {
    const list = document.getElementById('userList');
    if (Object.keys(users).length === 0) {
        list.innerHTML = '<p class="text-gray-500 text-sm italic">No active location shares</p>';
        return;
    }

    list.innerHTML = '';
    
    Object.entries(users).forEach(([jid, user], idx) => {
        const color = COLORS[idx % COLORS.length];
        const div = document.createElement('div');
        div.className = 'flex items-center gap-3 p-2 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700';
        div.onclick = () => onUserClick(jid);
        
        div.innerHTML = `
            <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style="background:${color}">
                ${jid.split('@')[0][0].toUpperCase()}
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">${jid.split('@')[0]}</div>
                <div class="text-xs text-gray-400">${user.lastUpdate}</div>
            </div>
            <div class="w-2 h-2 bg-green-500 rounded-full pulse"></div>
        `;
        list.appendChild(div);
    });
}
