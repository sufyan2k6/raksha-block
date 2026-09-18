/* ==========================================================================
   RAKSHA BLOCK — UNIFIED APP SHELL FRONTEND ENGINE
   Manages Sidebar, Header, Offcanvas Mobile Drawer, Toasts & Session Profile
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initAppShell();
});

function initAppShell() {
    const currentPath = window.location.pathname;

    // Skip shell initialization on login page
    if (currentPath === '/' || currentPath === '/login' || currentPath.endsWith('index.html')) {
        return;
    }

    // STRICT AUTH GUARD: If raksha_token is missing, redirect immediately to login
    const token = sessionStorage.getItem('raksha_token');
    if (!token) {
        sessionStorage.clear();
        window.location.href = '/';
        return;
    }

    const empId = sessionStorage.getItem('raksha_emp_id');
    const role = sessionStorage.getItem('raksha_user_role');
    const isPlanner = role === 'Railway Planner' || empId === 'EMP001';

    // RBAC ROUTE GUARD: Prevent Department Engineers from directly entering planner URLs
    const plannerOnlyPaths = [
        '/planning', '/block-planning',
        '/block-windows', '/windows',
        '/conflicts', '/conflict-detection',
        '/coordination', '/task-coordination',
        '/priority-analysis', '/priority',
        '/simulator', '/what-if'
    ];

    if (!isPlanner && plannerOnlyPaths.some(p => currentPath === p || currentPath.startsWith(p + '/') || currentPath.endsWith(p + '.html'))) {
        sessionStorage.setItem('raksha_access_denied_msg', `Access Denied: Operational planning and scheduling tools are reserved for Railway Planners. Department users (${role || 'Engineer'}) are limited to maintenance request management.`);
        window.location.href = '/dashboard';
        return;
    }

    renderSidebar(currentPath, isPlanner);
    renderHeader();
    initSessionUser();

    // Flash any pending access denied toast
    const deniedMsg = sessionStorage.getItem('raksha_access_denied_msg');
    if (deniedMsg) {
        sessionStorage.removeItem('raksha_access_denied_msg');
        setTimeout(() => {
            showToast('Access Restricted', deniedMsg, 'danger');
        }, 300);
    }
}

function renderSidebar(currentPath, isPlanner) {
    const sidebarEl = document.getElementById('appSidebar');
    if (!sidebarEl) return;

    let navItems = [];
    if (isPlanner) {
        navItems = [
            { group: 'MAIN', items: [{ name: 'Dashboard', icon: 'bi-grid-1x2-fill', path: '/dashboard' }] },
            { group: 'PLANNING', items: [
                { name: 'Maintenance Requests', icon: 'bi-tools', path: '/requests' },
                { name: 'Train Schedule', icon: 'bi-clock-history', path: '/trains' },
                { name: 'Block Windows', icon: 'bi-calendar3-range', path: '/block-windows' },
                { name: 'Block Planning', icon: 'bi-cpu-fill', path: '/planning' }
            ]},
            { group: 'INTELLIGENCE', items: [
                { name: 'Priority Analysis', icon: 'bi-bar-chart-line-fill', path: '/priority-analysis' },
                { name: 'Conflict Detection', icon: 'bi-exclamation-triangle-fill', path: '/conflicts' },
                { name: 'Task Coordination', icon: 'bi-diagram-3-fill', path: '/coordination' }
            ]},
            { group: 'SIMULATION', items: [
                { name: 'What-If Simulator', icon: 'bi-shuffle', path: '/simulator' }
            ]},
            { group: 'AI ASSISTANT', items: [
                { name: 'Raksha AI', icon: 'bi-robot', path: '/ai' }
            ]},
            { group: 'ANALYTICS', items: [
                { name: 'Reports & Analytics', icon: 'bi-file-earmark-bar-graph-fill', path: '/reports' }
            ]},
            { group: 'SYSTEM', items: [
                { name: 'Settings', icon: 'bi-gear-fill', path: '/settings' }
            ]}
        ];
    } else {
        // Department Field Engineer (P-Way, S&T, TRD)
        const userDept = sessionStorage.getItem('raksha_user_department') || 'Engineering';
        navItems = [
            { group: 'MAIN', items: [{ name: 'Dashboard', icon: 'bi-grid-1x2-fill', path: '/dashboard' }] },
            { group: `${userDept.toUpperCase()} OPERATIONS`, items: [
                { name: 'My Requests', icon: 'bi-tools', path: '/requests' },
                { name: 'Train Schedule', icon: 'bi-clock-history', path: '/trains' }
            ]},
            { group: 'ASSISTANCE', items: [
                { name: 'Raksha AI', icon: 'bi-robot', path: '/ai' }
            ]},
            { group: 'SYSTEM', items: [
                { name: 'Settings', icon: 'bi-gear-fill', path: '/settings' }
            ]}
        ];
    }

    let html = `
        <div class="sidebar-brand">
            <div class="sidebar-brand-icon"><i class="bi bi-train-front-fill"></i></div>
            <div>
                <span class="sidebar-brand-title">RAKSHA BLOCK</span>
                <span class="sidebar-brand-subtitle">Railway Maintenance</span>
            </div>
        </div>
        <nav class="sidebar-nav">
    `;

    navItems.forEach(group => {
        html += `<div class="sidebar-section-header">${group.group}</div>`;
        group.items.forEach(item => {
            const isActive = currentPath === item.path || currentPath.includes(item.path);
            html += `
                <a href="${item.path}" class="sidebar-link ${isActive ? 'active' : ''}">
                    <i class="bi ${item.icon}"></i>
                    <span>${item.name}</span>
                </a>
            `;
        });
    });

    html += `
        </nav>
        <div style="padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,0.08); display:flex; align-items:center; gap:0.75rem;">
            <div style="width:34px; height:34px; background:var(--rb-primary); color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.8rem;" id="navAvatarInitials">--</div>
            <div style="flex:1; overflow:hidden;">
                <div style="font-size:0.85rem; font-weight:600; color:#fff; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;" id="navUserName">Loading...</div>
                <div style="font-size:0.72rem; color:#94a3b8;" id="navUserRole">Loading...</div>
            </div>
            <button onclick="handleAppSignOut()" class="btn btn-link text-secondary p-0" title="Sign Out">
                <i class="bi bi-box-arrow-right" style="font-size:1.1rem;"></i>
            </button>
        </div>
    `;

    sidebarEl.className = 'app-sidebar';
    sidebarEl.innerHTML = html;
}

function renderHeader() {
    const headerEl = document.getElementById('appHeader');
    if (!headerEl) return;

    const pageTitle = document.title.split('-')[1]?.trim() || 'Dashboard';

    headerEl.className = 'app-header';
    headerEl.innerHTML = `
        <div class="d-flex align-items-center gap-3">
            <button class="btn btn-light d-md-none p-1" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar">
                <i class="bi bi-list fs-5"></i>
            </button>
            <h1 class="header-page-title">${pageTitle}</h1>
        </div>
        <div class="d-flex align-items-center gap-3">
            <div class="header-search d-none d-sm-block">
                <i class="bi bi-search"></i>
                <input type="text" class="form-control" placeholder="Search corridors, work orders...">
            </div>
            <a href="/ai" class="btn btn-outline-primary btn-sm rounded-pill px-3 d-flex align-items-center gap-1">
                <i class="bi bi-robot"></i> <span class="d-none d-sm-inline">Raksha AI</span>
            </a>
            <button class="btn btn-light btn-sm rounded-circle p-2 position-relative" id="btnAppNotifications" onclick="showAppNotifications()" title="System Notifications">
                <i class="bi bi-bell"></i>
                <span class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle">
                    <span class="visually-hidden">New alerts</span>
                </span>
            </button>
        </div>
    `;
}

async function showAppNotifications() {
    try {
        let modal = document.getElementById('appNotificationModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'appNotificationModal';
            modal.className = 'modal fade';
            modal.tabIndex = -1;
            modal.innerHTML = `
                <div class="modal-dialog modal-dialog-centered modal-sm">
                    <div class="modal-content border-0 shadow">
                        <div class="modal-header border-bottom py-2">
                            <h6 class="modal-title fw-bold text-dark mb-0"><i class="bi bi-bell-fill text-primary me-2"></i>System Alerts</h6>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-0" id="notificationModalBody" style="max-height:350px; overflow-y:auto;">
                            <div class="p-3 text-center text-muted small"><span class="spinner-border spinner-border-sm me-1"></span> Loading notifications...</div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        const res = await fetch('/api/notifications');
        const data = await res.json();
        const list = data.notifications || [];
        const bodyEl = document.getElementById('notificationModalBody');

        if (!list || list.length === 0) {
            bodyEl.innerHTML = `<div class="p-3 text-center text-muted small"><i class="bi bi-check2-circle me-1"></i> No unread operational alerts.</div>`;
        } else {
            bodyEl.innerHTML = list.map(n => `
                <div class="p-3 border-bottom">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <strong class="small text-dark">${escapeHtml(n.title)}</strong>
                        <span class="text-muted" style="font-size:0.7rem;">${escapeHtml(n.time || 'Recent')}</span>
                    </div>
                    <div class="small text-secondary">${escapeHtml(n.message)}</div>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Failed to load notifications:', err);
    }
}

function initSessionUser() {
    const name = sessionStorage.getItem('raksha_user_name');
    const role = sessionStorage.getItem('raksha_user_role');

    if (!name || !role) {
        sessionStorage.clear();
        window.location.href = '/';
        return;
    }

    const avatarEl = document.getElementById('navAvatarInitials');
    const nameEl = document.getElementById('navUserName');
    const roleEl = document.getElementById('navUserRole');

    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = role;
    if (avatarEl) {
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        avatarEl.textContent = initials || 'U';
    }
}

function handleAppSignOut() {
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = '/';
}

function showToast(title, message, type = 'success') {
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toastId = 'toast_' + Date.now();
    const bgClass = type === 'success' ? 'bg-success text-white' : type === 'danger' ? 'bg-danger text-white' : 'bg-primary text-white';

    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center ${bgClass} border-0 shadow" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    <strong>${title}:</strong> ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    const toastEl = document.getElementById(toastId);
    if (window.bootstrap && bootstrap.Toast) {
        const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
        toast.show();
    }
}

// Global API Helper guaranteeing auth context injection and structured [API ERROR] logging
window.rakshaApiFetch = async function(url, options = {}) {
    options = options || {};
    options.headers = options.headers || {};

    const empId = sessionStorage.getItem('raksha_emp_id');
    const role = sessionStorage.getItem('raksha_user_role');
    const name = sessionStorage.getItem('raksha_user_name');
    const dept = sessionStorage.getItem('raksha_user_department');
    const token = sessionStorage.getItem('raksha_token');

    if (empId && !options.headers['x-user-id']) options.headers['x-user-id'] = empId;
    if (role && !options.headers['x-user-role']) options.headers['x-user-role'] = role;
    if (name && !options.headers['x-user-name']) options.headers['x-user-name'] = name;
    if (dept && !options.headers['x-user-department']) options.headers['x-user-department'] = dept;
    if (token && !options.headers['Authorization']) options.headers['Authorization'] = `Bearer ${token}`;

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            let errorText = '';
            try {
                const clone = response.clone();
                const json = await clone.json();
                errorText = json.error || JSON.stringify(json);
            } catch (e) {
                try {
                    errorText = await response.clone().text();
                } catch (e2) {
                    errorText = response.statusText;
                }
            }

            console.error(`[API ERROR]\nEndpoint: ${url}\nStatus: ${response.status} ${response.statusText}\nResponse:`, errorText);
            showToast('API Error', errorText || `HTTP ${response.status} from ${url}`, 'danger');
        }
        return response;
    } catch (networkErr) {
        console.error(`[API ERROR]\nEndpoint: ${url}\nStatus: NETWORK_FAILED\nResponse:`, networkErr.message);
        showToast('Connection Error', `Failed to reach backend at ${url}`, 'danger');
        throw networkErr;
    }
};

