/* ==========================================================================
   RAKSHA BLOCK — DASHBOARD FRONTEND ENGINE
   Aggregates live operational telemetry, block recommendations & attention alerts
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardMetrics();
    loadRecommendedHero();
    loadAttentionFeed();
});

async function loadDashboardMetrics() {
    try {
        const response = await fetch('/api/reports');
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

            if (blockIdEl) blockIdEl.textContent = plan.block_id || 'B-102';
            if (corridorEl) corridorEl.textContent = plan.corridor || 'Corridor C2';
            if (timeSlotEl) timeSlotEl.textContent = `${plan.start_time} – ${plan.end_time}`;
            if (dateEl) dateEl.textContent = `Target Date: ${plan.date || '2026-09-21'}`;
            if (statusEl) statusEl.textContent = plan.status === 'Approved' ? 'Authorized Plan' : 'Plan Ready';

            const tasks = plan.scheduled_tasks || [];
            if (countEl) countEl.textContent = tasks.length;

            const taskListEl = document.getElementById('heroTaskList');
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
