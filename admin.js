import './style.css';

let adminToken = sessionStorage.getItem('resqlink_admin_token');

// Utility: Show Toast Notifications
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const bg = type === 'success' ? 'bg-emerald-500' : type === 'warning' ? 'bg-brand' : 'bg-primary';
    const toast = document.createElement('div');
    toast.className = `${bg} text-white px-4 py-2 rounded-lg shadow-lg text-sm font-bold opacity-0 transition-opacity duration-300`;
    toast.textContent = msg;
    container.appendChild(toast);
    
    requestAnimationFrame(() => toast.classList.remove('opacity-0'));
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// UI State Management
function updateView() {
    if (adminToken) {
        document.getElementById('screen-login').classList.add('hidden');
        document.getElementById('screen-dashboard').classList.remove('hidden');
        document.getElementById('btn-logout').classList.remove('hidden');
        document.getElementById('btn-add-camp').classList.remove('hidden');
        loadDashboardData();
    } else {
        document.getElementById('screen-dashboard').classList.add('hidden');
        document.getElementById('btn-logout').classList.add('hidden');
        document.getElementById('btn-add-camp').classList.add('hidden');
        document.getElementById('screen-login').classList.remove('hidden');
    }
}

// Authentication
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = document.getElementById('input-password').value;
    
    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwd })
        });
        
        const data = await res.json();
        if (res.ok && data.success) {
            adminToken = data.token;
            sessionStorage.setItem('resqlink_admin_token', adminToken);
            showToast('Authentication successful', 'success');
            updateView();
        } else {
            showToast(data.error || 'Invalid credentials', 'warning');
        }
    } catch (err) {
        showToast('Server error', 'warning');
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    adminToken = null;
    sessionStorage.removeItem('resqlink_admin_token');
    document.getElementById('input-password').value = '';
    updateView();
    showToast('Logged out');
});

// Data Loading
async function loadDashboardData() {
    await Promise.all([fetchReports(), fetchSubscribers(), fetchVolunteers()]);
}

document.getElementById('btn-refresh-reports').addEventListener('click', () => {
    loadDashboardData();
    showToast('Data refreshed');
});

// Fetch and Render Reports
async function fetchReports() {
    try {
        const res = await fetch('/api/reports');
        if (res.ok) {
            const data = await res.json();
            renderReports(data);
        }
    } catch (err) {
        console.error('Failed to fetch reports', err);
    }
}

function renderReports(reports) {
    const tbody = document.getElementById('reports-table-body');
    tbody.innerHTML = '';
    
    if (reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500">No reports found.</td></tr>`;
        return;
    }
    
    reports.forEach(r => {
        let statusBadge = '';
        if (r.status === 'Confirmed') statusBadge = '<span class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">Confirmed</span>';
        else if (r.status === 'Resolved') statusBadge = '<span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">Resolved</span>';
        else statusBadge = `<span class="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-bold">${r.status}</span>`;

        tbody.insertAdjacentHTML('beforeend', `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-3 border-t border-slate-100">
                    <div class="font-bold text-primary">${r.type}</div>
                    <div class="text-[10px] text-slate-500">${new Date(r.createdAt).toLocaleString()}</div>
                </td>
                <td class="p-3 border-t border-slate-100">
                    <div class="font-semibold text-slate-700">${r.district}</div>
                    <div class="text-[11px] text-slate-500 line-clamp-1">${r.village}</div>
                </td>
                <td class="p-3 border-t border-slate-100">
                    ${statusBadge}
                </td>
                <td class="p-3 border-t border-slate-100">
                    <div class="flex gap-2">
                        ${r.status !== 'Resolved' ? `<button onclick="updateReport('${r._id}', 'Resolved')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-bold transition-colors">Resolve</button>` : ''}
                        <button onclick="deleteReport('${r._id}')" class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-xs font-bold transition-colors">Delete</button>
                    </div>
                </td>
            </tr>
        `);
    });
}

// Fetch and Render Subscribers
async function fetchSubscribers() {
    try {
        const res = await fetch('/api/subscribers');
        if (res.ok) {
            const data = await res.json();
            document.getElementById('subscriber-count').textContent = `${data.length} Total`;
            
            const list = document.getElementById('subscribers-list');
            list.innerHTML = '';
            
            data.forEach(s => {
                const isPending = s.status !== 'Approved';
                list.insertAdjacentHTML('beforeend', `
                    <div class="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100 mb-2">
                        <div>
                            <span class="font-mono text-sm text-slate-700 block">${s.phone || 'No phone provided'}</span>
                            <span class="text-xs font-bold text-blue-600 bg-blue-50 px-2 rounded mt-1 inline-block">${s.district}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            ${isPending ? `<button onclick="approveSubscriber('${s._id}')" class="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded text-[10px] font-bold uppercase transition-colors">Approve</button>` : `<span class="text-[10px] text-emerald-600 font-bold uppercase flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Approved</span>`}
                            <button onclick="deleteSubscriber('${s._id}')" class="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-[10px] font-bold uppercase transition-colors">Reject</button>
                        </div>
                    </div>
                `);
            });
        }
    } catch (err) {
        console.error('Failed to fetch subscribers', err);
    }
}

// Fetch and Render Volunteers
async function fetchVolunteers() {
    try {
        const res = await fetch('/api/volunteers');
        if (res.ok) {
            const data = await res.json();
            document.getElementById('volunteer-count').textContent = `${data.length} Total`;
            
            const list = document.getElementById('volunteers-list');
            list.innerHTML = '';
            
            if(data.length === 0) {
                list.innerHTML = '<div class="text-xs text-slate-500">No volunteers registered yet.</div>';
            }

            data.forEach(v => {
                list.insertAdjacentHTML('beforeend', `
                    <div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <span class="font-bold text-sm text-primary block">${v.name}</span>
                                <span class="font-mono text-xs text-slate-500">${v.phone}</span>
                            </div>
                            <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 rounded-full border border-emerald-200">${v.district}</span>
                        </div>
                        <div class="text-xs text-slate-600 space-y-1 mt-2">
                            <p><strong>Skills:</strong> ${v.skills || 'None'}</p>
                            <p><strong>Eqpt:</strong> ${v.equipment || 'None'}</p>
                        </div>
                    </div>
                `);
            });
        }
    } catch (err) {
        console.error('Failed to fetch volunteers', err);
    }
}

// Global Actions (Exposed to window for inline onclicks)
window.updateReport = async (id, status) => {
    try {
        const res = await fetch(`/api/reports/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            showToast(`Report marked as ${status}`, 'success');
            fetchReports(); // Refresh
        }
    } catch (err) {
        showToast('Failed to update report', 'warning');
    }
};

window.deleteReport = async (id) => {
    if (!confirm('Are you sure you want to delete this report? This cannot be undone.')) return;
    try {
        const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Report deleted', 'success');
            fetchReports(); // Refresh
        }
    } catch (err) {
        showToast('Failed to delete report', 'warning');
    }
};

window.approveSubscriber = async (id) => {
    try {
        const res = await fetch(`/api/subscribers/${id}/approve`, { method: 'PATCH' });
        if (res.ok) {
            showToast('Subscriber approved', 'success');
            fetchSubscribers();
        } else {
            showToast('Failed to approve subscriber. Server error.', 'warning');
        }
    } catch (err) {
        showToast('Failed to approve subscriber', 'warning');
    }
};

window.deleteSubscriber = async (id) => {
    if (!confirm('Are you sure you want to reject/remove this subscriber?')) return;
    try {
        const res = await fetch(`/api/subscribers/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Subscriber removed', 'success');
            fetchSubscribers();
        } else {
            showToast('Failed to remove subscriber. Did you restart the server?', 'warning');
        }
    } catch (err) {
        showToast('Failed to remove subscriber', 'warning');
    }
};

window.bulkApproveSubscribers = async () => {
    try {
        const res = await fetch(`/api/subscribers/bulk-approve`, { method: 'PATCH' });
        if (res.ok) {
            const data = await res.json();
            showToast(data.message, 'success');
            fetchSubscribers();
        }
    } catch (err) {
        showToast('Failed to bulk approve', 'warning');
    }
};

// Broadcast Modal Logic
document.getElementById('btn-open-broadcast').addEventListener('click', () => {
    document.getElementById('modal-broadcast').classList.remove('hidden');
});
document.getElementById('btn-close-broadcast').addEventListener('click', () => {
    document.getElementById('modal-broadcast').classList.add('hidden');
});

document.getElementById('form-broadcast').addEventListener('submit', async (e) => {
    e.preventDefault();
    const district = document.getElementById('select-broadcast-district').value;
    const message = document.getElementById('input-broadcast-msg').value;

    try {
        const res = await fetch('/api/subscribers/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ district, message })
        });
        
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            document.getElementById('modal-broadcast').classList.add('hidden');
            document.getElementById('input-broadcast-msg').value = '';
        } else {
            showToast(data.error || 'Broadcast failed', 'warning');
        }
    } catch (err) {
        showToast('Server error during broadcast', 'warning');
    }
});

// Add Camp Modal Logic
document.getElementById('btn-add-camp').addEventListener('click', () => {
    document.getElementById('modal-add-camp').classList.remove('hidden');
});
document.getElementById('btn-close-camp').addEventListener('click', () => {
    document.getElementById('modal-add-camp').classList.add('hidden');
});

document.getElementById('form-add-camp').addEventListener('submit', async (e) => {
    e.preventDefault();
    const campData = {
        name: document.getElementById('camp-name').value,
        district: document.getElementById('camp-district').value,
        capacity: parseInt(document.getElementById('camp-capacity').value),
        facilities: document.getElementById('camp-facilities').value,
        contact: document.getElementById('camp-contact').value,
        lat: parseFloat(document.getElementById('camp-lat').value),
        lng: parseFloat(document.getElementById('camp-lng').value),
    };

    try {
        const res = await fetch('/api/camps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(campData)
        });
        if (res.ok) {
            showToast('Camp created successfully', 'success');
            document.getElementById('modal-add-camp').classList.add('hidden');
            e.target.reset();
        } else {
            showToast('Failed to create camp', 'warning');
        }
    } catch (err) {
        showToast('Server error while adding camp', 'warning');
    }
});

// Socket.io Admin Logic
let socket;
try {
    socket = io();
    socket.on('sos-message', (data) => {
        const history = document.getElementById('admin-chat-history');
        if(!history) return;
        
        const align = data.role === 'Admin' ? 'items-end' : 'items-start';
        const bg = data.role === 'Admin' ? 'bg-brand text-white' : 'bg-white border border-slate-200 text-slate-800';
        
        history.insertAdjacentHTML('beforeend', `
            <div class="flex flex-col ${align} mb-2">
                <span class="text-[9px] font-bold text-slate-400 mb-0.5">${data.role === 'Admin' ? 'Control Room' : data.sender} - ${new Date(data.timestamp).toLocaleTimeString()}</span>
                <div class="px-3 py-2 rounded-xl text-sm ${bg} max-w-[85%] shadow-sm">
                    ${data.message}
                </div>
            </div>
        `);
        history.scrollTop = history.scrollHeight;
    });
} catch(e) { console.log('Socket.io not loaded'); }

const adminChatForm = document.getElementById('admin-chat-form');
if (adminChatForm) {
    adminChatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('admin-chat-input');
        if(!input.value.trim()) return;
        if(socket) {
            socket.emit('sos-message', { sender: 'Admin', role: 'Admin', message: input.value });
            input.value = '';
        }
    });
}

// Initialize
updateView();
