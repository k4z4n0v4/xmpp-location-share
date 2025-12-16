import * as UI from './ui.js';
import * as Map from './map.js';
import * as XMPP from './xmpp.js';
import { getDomain } from './utils.js';

let shareInterval = null;
let isUrlManual = false; 

const GEO_OPTS = {
    enableHighAccuracy: true,
    timeout: 10000
};

document.addEventListener('DOMContentLoaded', () => {
    UI.initUI();
    Map.initMap();
    bindEvents();
});

function bindEvents() {
    const jidInput = document.getElementById('jid');
    const urlInput = document.getElementById('boshUrl');

    urlInput.addEventListener('input', () => {
        isUrlManual = urlInput.value.trim().length > 0;
    });

    jidInput.addEventListener('input', () => {
        if (isUrlManual) return;

        const domain = getDomain(jidInput.value);
        if (domain && domain.includes('.')) {
            urlInput.value = `wss://${domain}:5281/xmpp-websocket`;
        } else {
            urlInput.value = '';
        }
    });

    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const jid = jidInput.value;
        const pass = document.getElementById('password').value;
        const url = urlInput.value;
        
        if (jid && pass && url) {
            XMPP.connect(jid, pass, url);
        } else {
            UI.toast('Fill all fields', 'error');
        }
    });

    document.getElementById('discoverBtn').addEventListener('click', async () => {
        const jid = jidInput.value;
        const domain = getDomain(jid);
        if (!domain) return UI.toast('Enter JID first', 'warn');
        
        const url = await XMPP.discover(domain);
        
        if (url) {
            urlInput.value = url;
            isUrlManual = true; 
            UI.toast('Found endpoint!', 'success');
        } else {
            UI.toast('Discovery failed (enter manually)', 'error');
        }
    });

    document.getElementById('getLocationBtn').onclick = () => {
        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude, accuracy } = pos.coords;
            Map.updateMyPos(latitude, longitude, accuracy);
            Map.centerMap(latitude, longitude);
            
            document.getElementById('currentLocationText').innerHTML = 
                `${latitude.toFixed(5)}, ${longitude.toFixed(5)} <br> (±${Math.round(accuracy)}m)`;
        }, err => {
            UI.toast(err.message, 'error');
        }, GEO_OPTS); 
    };

    const toggleBtn = document.getElementById('shareToggleBtn');
    toggleBtn.onclick = () => {
        if (shareInterval) {
            // Stop
            clearInterval(shareInterval);
            shareInterval = null;
            
            if (XMPP.isConnected()) XMPP.publishRetract();

            toggleBtn.textContent = 'Start Publishing';
            toggleBtn.className = 'w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition';
            document.getElementById('sharingStatus').classList.add('hidden');
        } else {
            // Start
            if (!XMPP.isConnected()) return UI.toast('Not connected!', 'error');
            
            toggleBtn.textContent = 'Stop Publishing';
            toggleBtn.className = 'w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition';
            document.getElementById('sharingStatus').classList.remove('hidden');
            
            publishOnce();
            const secs = document.getElementById('shareInterval').value;
            shareInterval = setInterval(publishOnce, secs * 1000);
        }
    };
    
    document.getElementById('fitMarkersBtn').onclick = () => Map.fitBounds();
    document.getElementById('followBtn').onclick = (e) => {
        const isActive = e.target.classList.contains('bg-indigo-600');
        e.target.classList.toggle('bg-indigo-600');
        e.target.classList.toggle('bg-gray-700');
        Map.setAutoFollow(!isActive);
    };
    
    document.getElementById('disconnectBtn').onclick = () => {
        if(shareInterval) toggleBtn.click();
        XMPP.disconnect();
    }
}

function publishOnce() {
    navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        XMPP.publishLocation(pos.coords); 
        Map.updateMyPos(latitude, longitude, accuracy);
        document.getElementById('lastShareTime').textContent = 'Last: ' + new Date().toLocaleTimeString();
    }, err => {
        console.error('GPS Error', err);
    }, GEO_OPTS);
}
