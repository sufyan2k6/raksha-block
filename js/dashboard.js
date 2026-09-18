/* ==========================================================================
   RAKSHA BLOCK — DASHBOARD FRONTEND ENGINE
   Aggregates live operational telemetry, block recommendations & attention alerts
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    adaptDashboardForRole();
    loadDashboardMetrics();
    loadRecommendedHero();
    loadAttentionFeed();
});

function adaptDashboardForRole() {
    const empId = sessionStorage.getItem('raksha_emp_id');
    const role = sessionStorage.getItem('raksha_user_role');
    const dept = sessionStorage.getItem('raksha_user_department') || 'P-Way';
    const isPlanner = role === 'Railway Planner' || empId === 'EMP001';

    if (!isPlanner) {
        // Adjust Hero Card Action Buttons
        const heroActions = document.querySelector('.card.border-primary .col-lg-3');
        if (heroActions) {
            heroActions.innerHTML = `
                <a href="/requests" class="btn btn-primary fw-semibold py-2 w-100 d-flex align-items-center justify-content-center gap-2">
                    <i class="bi bi-tools"></i> <span>My Requests</span>
                </a>
                <a href="/trains" class="btn btn-outline-secondary fw-semibold py-2 w-100 d-flex align-items-center justify-content-center gap-2">
                    <i class="bi bi-clock-history"></i> <span>Train Movements</span>
                </a>
            `;
        }

        // Adjust Quick Actions: strictly remove planner links (/conflicts, /planning)
        const qaContainer = document.querySelector('.card .card-body .row.g-2');
        if (qaContainer) {
            qaContainer.innerHTML = `
                <div class="col-6">
                    <a href="/requests" class="btn btn-outline-primary w-100 text-start p-3 d-flex align-items-center gap-2">
                        <i class="bi bi-plus-circle fs-5"></i>
                        <div>
                            <div class="fw-bold small">New Request</div>
                            <div class="text-muted" style="font-size:0.75rem;">Create ${escapeHtml(dept)} Order</div>
                        </div>
                    </a>
                </div>
                <div class="col-6">
                    <a href="/requests" class="btn btn-outline-secondary w-100 text-start p-3 d-flex align-items-center gap-2">
                        <i class="bi bi-card-checklist fs-5"></i>
                        <div>
                            <div class="fw-bold small">My Work Orders</div>
                            <div class="text-muted" style="font-size:0.75rem;">View Department Status</div>
                        </div>
                    </a>
                </div>
                <div class="col-6">
                    <a href="/trains" class="btn btn-outline-info w-100 text-start p-3 d-flex align-items-center gap-2">
                        <i class="bi bi-clock-history fs-5"></i>
                        <div>
                            <div class="fw-bold small">Train Movements</div>
                            <div class="text-muted" style="font-size:0.75rem;">Live Section Schedule</div>
                        </div>
                    </a>
                </div>
                <div class="col-6">
                    <a href="/settings" class="btn btn-outline-secondary w-100 text-start p-3 d-flex align-items-center gap-2">
                        <i class="bi bi-gear fs-5"></i>
                        <div>
                            <div class="fw-bold small">Settings</div>
                            <div class="text-muted" style="font-size:0.75rem;">User Preferences</div>
                        </div>
                    </a>
                </div>
            `;
        }

        // Adjust attention required link
        const attentionLink = document.querySelector('a[href="/conflicts"]');
        if (attentionLink) {
            attentionLink.href = '/requests';
            attentionLink.textContent = 'View Requests';
        }
    }
}

async function loadDashboardMetrics() {
    try {
        const fetchFn = window.rakshaApiFetch || fetch;
        const response = await fetchFn('/api/reports');
        if (!response.ok) throw new Error('Failed to fetch metrics');

        const data = await response.json();
        
        const pendingEl = document.getElementById('kpiPendingReqs');
        const highEl = document.getElementById('kpiHighPriority');
        const blocksEl = document.getElementById('kpiAvailableBlocks');
        const conflictsEl = document.getElementById('kpiActiveConflicts');

        if (pendingEl) pendingEl.textContent = data.pendingMaintenance !== undefined ? data.pendingMaintenance : 0;
        if (highEl) highEl.textContent = data.highPriority !== undefined ? data.highPriority : 0;
        if (blocksEl) blocksEl.textContent = data.availableBlocks !== undefined ? data.availableBlocks : 0;
        if (conflictsEl) conflictsEl.textContent = data.activeConflicts !== undefined ? data.activeConflicts : 0;
    } catch (err) {
        console.error('Error loading dashboard metrics:', err);
    }
}

async function loadRecommendedHero() {
    try {
        const response = await fetch('/api/block-plans/recommended?corridor=Corridor%20C2&date=2026-09-21');
        if (!response.ok) throw new Error('Failed to fetch plan');

        const plan = await response.json();

        if (plan) {
            const blockIdEl = document.getElementById('heroBlockId');
            const corridorEl = document.getElementById('heroCorridor');
            const timeSlotEl = document.getElementById('heroTimeSlot');
            const dateEl = document.getElementById('heroDate');
            const statusEl = document.getElementById('heroStatusBadge');
            const countEl = document.getElementById('heroTaskCount');
            const taskListEl = document.getElementById('heroTaskList');

            const tasks = plan.scheduled_tasks || [];
            const hasValidBlock = plan.block_id && plan.block_id !== 'NONE' && plan.block_id !== 'null';

            if (hasValidBlock && tasks.length > 0) {
                if (blockIdEl) blockIdEl.textContent = plan.block_id;
                if (corridorEl) corridorEl.textContent = plan.corridor || 'Corridor C2';
                if (timeSlotEl) timeSlotEl.textContent = `${plan.start_time} – ${plan.end_time}`;
                if (dateEl) dateEl.textContent = `Target Date: ${plan.date || 'Today'}`;
                if (statusEl) statusEl.textContent = plan.status === 'Approved' ? 'Authorized Plan' : 'Plan Ready';
                if (countEl) countEl.textContent = tasks.length;

                if (taskListEl) {
                    taskListEl.innerHTML = tasks.slice(0, 3).map(t => {
                        const desc = t.work_description || t.description || t.asset || 'Maintenance Work';
                        return `
                            <li class="d-flex align-items-center gap-2 mb-1">
                                <i class="bi bi-check-circle-fill text-success"></i> 
                                <span class="fw-semibold text-dark">${escapeHtml(desc)}</span>
                                <span class="badge bg-secondary-subtle text-secondary small">${escapeHtml(t.department || 'P-Way')}</span>
                            </li>
                        `;
                    }).join('');
                }
            } else {
                if (blockIdEl) blockIdEl.textContent = 'NO BLOCK';
                if (corridorEl) corridorEl.textContent = plan.corridor || 'Corridor C2';
                if (timeSlotEl) timeSlotEl.textContent = 'No Active Window';
                if (dateEl) dateEl.textContent = `Target Date: Today`;
                if (statusEl) statusEl.textContent = 'Awaiting Plan';
                if (countEl) countEl.textContent = '0';
                if (taskListEl) {
                    taskListEl.innerHTML = `<li class="text-muted small">No scheduled tasks currently allocated. Create requests and block windows to generate schedules.</li>`;
                }
            }
        }
    } catch (err) {
        console.error('Error loading recommended block hero:', err);
    }
}

async function loadAttentionFeed() {
    const listEl = document.getElementById('attentionList');
    if (!listEl) return;

    try {
        const [reqRes, confRes] = await Promise.all([
            fetch('/api/maintenance-requests'),
            fetch('/api/conflicts')
        ]);

        const reqData = await reqRes.json();
        const confData = await confRes.json();

        const criticalReq = (reqData.requests || []).find(r => r.priority === 'Critical' || r.priority === 'High');
        const activeConf = (confData.conflicts || []).find(c => c.status !== 'Resolved');

        let html = '';

        if (criticalReq) {
            const desc = criticalReq.work_description || criticalReq.description || criticalReq.asset;
            html += `
                <div class="list-group-item p-3">
                    <div class="d-flex w-100 justify-content-between align-items-center mb-1">
                        <span class="badge bg-danger-subtle text-danger border border-danger-subtle">High Priority Request</span>
                        <small class="text-muted font-mono">${escapeHtml(criticalReq.request_id)}</small>
                    </div>
                    <div class="fw-semibold text-dark">${escapeHtml(desc)} on ${escapeHtml(criticalReq.corridor)}</div>
                    <small class="text-secondary">${escapeHtml(criticalReq.reason || criticalReq.priority_reason || 'Requires expedited block scheduling.')}</small>
                </div>
            `;
        }

        if (activeConf) {
            html += `
                <div class="list-group-item p-3">
                    <div class="d-flex w-100 justify-content-between align-items-center mb-1">
                        <span class="badge bg-warning-subtle text-warning border border-warning-subtle">Train Clash Warning</span>
                        <small class="text-muted font-mono">${escapeHtml(activeConf.conflict_id)}</small>
                    </div>
                    <div class="fw-semibold text-dark">${escapeHtml(activeConf.description)}</div>
                    <small class="text-secondary">${escapeHtml(activeConf.recommendation)}</small>
                </div>
            `;
        }

        if (!criticalReq && !activeConf) {
            html = `<div class="p-3 text-center text-success small"><i class="bi bi-check-circle me-1"></i> All systems clear. No urgent attention items.</div>`;
        }

        listEl.innerHTML = html;
    } catch (err) {
        console.error('Error loading attention feed:', err);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
