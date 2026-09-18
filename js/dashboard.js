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

function isPlannerUser() {
    const empId = (sessionStorage.getItem('raksha_emp_id') || '').trim().toUpperCase();
    const role = (sessionStorage.getItem('raksha_user_role') || '').trim().toLowerCase();
    const dept = (sessionStorage.getItem('raksha_user_department') || '').trim().toLowerCase();
    return empId === 'EMP001' || role.includes('planner') || (dept === 'operations' && !role.includes('controller'));
}

function adaptDashboardForRole() {
    const dept = sessionStorage.getItem('raksha_user_department') || 'P-Way';
    const isPlanner = isPlannerUser();

    const qaContainer = document.getElementById('quickActionsRow');
    const heroActiveActions = document.getElementById('heroActiveActions');
    const heroEmptyActions = document.getElementById('heroEmptyActions');
    const attentionLink = document.querySelector('a[href="/conflicts"], a[href="/requests"]');

    if (!isPlanner) {
        // Department Engineer Role: P-Way, S&T, TRD
        if (heroActiveActions) {
            heroActiveActions.innerHTML = `
                <a href="/requests" class="btn btn-primary fw-semibold py-2 w-100 d-flex align-items-center justify-content-center gap-2">
                    <i class="bi bi-tools"></i> <span>My Requests</span>
                </a>
                <a href="/trains" class="btn btn-outline-secondary fw-semibold py-2 w-100 d-flex align-items-center justify-content-center gap-2">
                    <i class="bi bi-clock-history"></i> <span>Train Movements</span>
                </a>
            `;
        }
        if (heroEmptyActions) {
            heroEmptyActions.innerHTML = `
                <a href="/requests" class="btn btn-primary fw-semibold py-2 w-100 d-flex align-items-center justify-content-center gap-2">
                    <i class="bi bi-plus-circle"></i> <span>New Maintenance Request</span>
                </a>
                <a href="/trains" class="btn btn-outline-secondary fw-semibold py-2 w-100 d-flex align-items-center justify-content-center gap-2">
                    <i class="bi bi-clock-history"></i> <span>Train Movements</span>
                </a>
            `;
        }

        // Adjust Quick Actions: strictly for department field engineers (New Request, My Work Orders, Train Movements, Settings)
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

        if (attentionLink) {
            attentionLink.href = '/requests';
            attentionLink.textContent = 'View Requests';
        }
    } else {
        // Railway Planner Role: Strictly NO "Add Request", NO "New Work Order"
        if (qaContainer) {
            qaContainer.innerHTML = `
                <div class="col-6">
                    <a href="/trains" class="btn btn-outline-secondary w-100 text-start p-3 d-flex align-items-center gap-2">
                        <i class="bi bi-clock-history fs-5"></i>
                        <div>
                            <div class="fw-bold small">Train Timetable</div>
                            <div class="text-muted" style="font-size:0.75rem;">View Section Movements</div>
                        </div>
                    </a>
                </div>
                <div class="col-6">
                    <a href="/block-windows" class="btn btn-outline-primary w-100 text-start p-3 d-flex align-items-center gap-2">
                        <i class="bi bi-calendar2-week fs-5"></i>
                        <div>
                            <div class="fw-bold small">Block Windows</div>
                            <div class="text-muted" style="font-size:0.75rem;">Available Windows</div>
                        </div>
                    </a>
                </div>
                <div class="col-6">
                    <a href="/conflicts" class="btn btn-outline-danger w-100 text-start p-3 d-flex align-items-center gap-2">
                        <i class="bi bi-shield-exclamation fs-5"></i>
                        <div>
                            <div class="fw-bold small">Check Conflicts</div>
                            <div class="text-muted" style="font-size:0.75rem;">Audit Clashes</div>
                        </div>
                    </a>
                </div>
                <div class="col-6">
                    <a href="/planning" class="btn btn-outline-success w-100 text-start p-3 d-flex align-items-center gap-2">
                        <i class="bi bi-cpu fs-5"></i>
                        <div>
                            <div class="fw-bold small">Block Plan</div>
                            <div class="text-muted" style="font-size:0.75rem;">Generate & Approve</div>
                        </div>
                    </a>
                </div>
            `;
        }

        if (attentionLink) {
            attentionLink.href = '/conflicts';
            attentionLink.textContent = 'View All';
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
        const fetchFn = window.rakshaApiFetch || fetch;
        const response = await fetchFn('/api/block-plans/recommended');
        if (!response.ok) throw new Error('Failed to fetch recommended plan');

        const plan = await response.json();

        const emptyContainer = document.getElementById('heroEmptyState');
        const activeContainer = document.getElementById('heroActiveState');
        const statusBadge = document.getElementById('heroStatusBadge');

        if (!plan || !plan.hasRecommendation) {
            // True Data-Driven Empty / Infeasible State
            if (activeContainer) activeContainer.style.display = 'none';
            if (emptyContainer) emptyContainer.style.display = 'block';

            const titleEl = document.getElementById('heroEmptyTitle');
            const msgEl = document.getElementById('heroEmptyMessage');
            const hintEl = document.getElementById('heroEmptyHint');

            if (plan && plan.state === 'NO_WINDOWS') {
                if (statusBadge) statusBadge.textContent = 'Window Required';
                if (titleEl) titleEl.textContent = plan.title || 'No block recommendation available yet';
                if (msgEl) msgEl.textContent = plan.message || 'Maintenance requests are pending, but no block window is available. Create a suitable block window first.';
                if (hintEl) {
                    hintEl.innerHTML = plan.corridor 
                        ? `<i class="bi bi-geo-alt me-1"></i>Corridor: ${escapeHtml(plan.corridor)} (Pending work orders require block possession)`
                        : `<i class="bi bi-info-circle me-1"></i>Pending work orders require a matching block window.`;
                }
            } else if (plan && plan.state === 'NO_REQUESTS') {
                if (statusBadge) statusBadge.textContent = 'No Requests';
                if (titleEl) titleEl.textContent = plan.title || 'No recommendation available yet';
                if (msgEl) {
                    msgEl.textContent = isPlannerUser()
                        ? 'Block windows are configured, but no maintenance requests are pending from engineering departments.'
                        : (plan.message || 'Block windows are configured, but no maintenance requests are pending.');
                }
                if (hintEl) {
                    hintEl.innerHTML = plan.corridor 
                        ? `<i class="bi bi-geo-alt me-1"></i>Corridor: ${escapeHtml(plan.corridor)}`
                        : `<i class="bi bi-info-circle me-1"></i>No work orders pending.`;
                }
            } else if (plan && plan.state === 'NO_FEASIBLE') {
                if (statusBadge) statusBadge.textContent = 'No Fit Found';
                if (titleEl) titleEl.textContent = plan.title || 'No suitable block found';
                if (msgEl) msgEl.textContent = plan.message || 'None of the available block windows can accommodate the pending maintenance requests.';
                if (hintEl) {
                    hintEl.innerHTML = plan.corridor 
                        ? `<i class="bi bi-geo-alt me-1"></i>Corridor: ${escapeHtml(plan.corridor)} (Unresolved constraints or duration overflow)`
                        : `<i class="bi bi-exclamation-triangle me-1"></i>Unresolved constraints prevent block recommendation.`;
                }
            } else {
                // Completely empty database state (TEST A: 0 requests, 0 blocks)
                if (statusBadge) statusBadge.textContent = 'No Recommendation';
                if (titleEl) titleEl.textContent = 'No recommendation available yet';
                if (msgEl) {
                    msgEl.textContent = isPlannerUser()
                        ? 'Configure corridor block windows and review maintenance requests once submitted by engineering departments.'
                        : 'Submit maintenance requests and view block windows to generate a block recommendation.';
                }
                if (hintEl) hintEl.innerHTML = '<i class="bi bi-info-circle me-1"></i>There is currently no planning data available.';
            }
        } else {
            // Actual recommendation generated and available!
            if (emptyContainer) emptyContainer.style.display = 'none';
            if (activeContainer) activeContainer.style.display = 'block';

            const blockIdEl = document.getElementById('heroBlockId');
            const corridorEl = document.getElementById('heroCorridor');
            const timeSlotEl = document.getElementById('heroTimeSlot');
            const dateEl = document.getElementById('heroDate');
            const countEl = document.getElementById('heroTaskCount');
            const conflictEl = document.getElementById('heroConflictCount');
            const taskListEl = document.getElementById('heroTaskList');

            const tasks = plan.scheduled_tasks || [];

            if (blockIdEl) blockIdEl.textContent = plan.block_id || '--';
            if (corridorEl) corridorEl.textContent = plan.corridor || '--';
            if (timeSlotEl) timeSlotEl.textContent = `${plan.start_time} – ${plan.end_time}`;
            if (dateEl) dateEl.textContent = plan.date ? `Target Date: ${plan.date}` : 'Target Date: Today';
            if (statusBadge) statusBadge.textContent = plan.status === 'Approved' ? 'Authorized Plan' : 'Plan Ready';
            if (countEl) countEl.textContent = tasks.length;
            if (conflictEl) conflictEl.textContent = plan.conflict_count || (plan.detected_conflicts || []).length || 0;

            if (taskListEl) {
                if (tasks.length > 0) {
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
                } else {
                    taskListEl.innerHTML = `<li class="text-muted small">No scheduled tasks currently allocated.</li>`;
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
