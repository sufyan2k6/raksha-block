/* ==========================================================================
   RAKSHA BLOCK — TASK COORDINATION FRONTEND ENGINE
   Evaluates cross-department shadow block bundling opportunities
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    loadCoordinationData();
});

let cachedOpportunities = [];

async function loadCoordinationData() {
    const tbody = document.getElementById('coordinationTableBody');
    const countBadge = document.getElementById('oppRecordCount');

    try {
        const response = await fetch('/api/coordination');
        if (!response.ok) throw new Error('Failed to fetch coordination data');

        const data = await response.json();
        cachedOpportunities = data.opportunities || [];

        renderCoordinationTable(cachedOpportunities);
        updateCoordinationKPIs(cachedOpportunities);
        if (countBadge) countBadge.textContent = `${cachedOpportunities.length} Joint Opportunities`;
    } catch (err) {
        console.error('Error loading coordination data:', err);
        if (tbody) {
            tbody.innerHTML = `
                <tr><td colspan="7" class="text-center py-4 text-danger">
                    <i class="bi bi-exclamation-triangle fs-4 mb-2 d-block"></i>
                    <div>Error loading cross-department coordination opportunities. Check backend engine connection.</div>
                    <button class="btn btn-outline-secondary btn-sm mt-2" onclick="loadCoordinationData()">Retry Connection</button>
                </td></tr>
            `;
        }
    }
}

function renderCoordinationTable(opportunities) {
    const tbody = document.getElementById('coordinationTableBody');
    if (!tbody) return;

    if (!opportunities || opportunities.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">
            <i class="bi bi-inbox fs-4 mb-2 d-block"></i>
            No cross-department bundling opportunities found for active requests.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = opportunities.map(o => {
        const primary = o.primary_request || {};
        const shadow = o.shadow_request || {};
        const isBundled = o.status === 'Bundled' || o.is_bundled;

        return `
            <tr class="${isBundled ? 'table-success-subtle' : ''}">
                <td class="font-mono fw-bold">${escapeHtml(o.opportunity_id || o.coordination_id)}</td>
                <td><span class="fw-semibold text-dark">${escapeHtml(o.corridor)}</span> <small class="text-muted">(${escapeHtml(o.location || 'Section')})</small></td>
                <td>
                    <span class="badge bg-primary-subtle text-primary border border-primary-subtle font-mono">${escapeHtml(primary.request_id || 'Task 1')}</span>
                    <div class="small fw-semibold text-dark mt-1">${escapeHtml(primary.work_description || 'Engineering Work')}</div>
                </td>
                <td>
                    <span class="badge bg-warning-subtle text-warning border border-warning-subtle font-mono">${escapeHtml(shadow.request_id || 'Task 2')}</span>
                    <div class="small fw-semibold text-dark mt-1">${escapeHtml(shadow.work_description || 'Secondary Work')}</div>
                </td>
                <td>
                    <span class="badge bg-secondary-subtle text-secondary border">${escapeHtml(primary.department || 'P-Way')}</span>
                    <span class="text-muted mx-1">+</span>
                    <span class="badge bg-secondary-subtle text-secondary border">${escapeHtml(shadow.department || 'S&T')}</span>
                </td>
                <td class="font-mono fw-bold text-success">
                    +${o.time_saved_minutes} Mins Saved
                </td>
                <td class="text-end">
                    ${isBundled ? `
                        <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                            <i class="bi bi-link-45deg me-1"></i> Bundled
                        </span>
                    ` : `
                        <button class="btn btn-primary btn-sm fw-semibold d-inline-flex align-items-center gap-1" onclick="bundleOpportunity('${o.opportunity_id || o.coordination_id}')">
                            <i class="bi bi-link-45deg"></i> Bundle Block
                        </button>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

function updateCoordinationKPIs(opportunities) {
    const oppTotalEl = document.getElementById('kpiOppTotal');
    const timeSavedEl = document.getElementById('kpiTimeSaved');
    const deptsEl = document.getElementById('kpiDeptsInvolved');
    const synergyEl = document.getElementById('kpiSynergyIndex');

    if (oppTotalEl) oppTotalEl.textContent = opportunities.length;

    if (!opportunities || opportunities.length === 0) {
        if (timeSavedEl) timeSavedEl.textContent = '0.0 hrs';
        if (deptsEl) deptsEl.textContent = '0 Depts';
        if (synergyEl) synergyEl.textContent = 'N/A';
        return;
    }

    const totalMinutesSaved = opportunities.reduce((acc, o) => acc + (o.time_saved_minutes || 0), 0);
    const hoursSaved = (totalMinutesSaved / 60).toFixed(1);

    const deptsSet = new Set();
    opportunities.forEach(o => {
        if (o.primary_request?.department) deptsSet.add(o.primary_request.department);
        if (o.shadow_request?.department) deptsSet.add(o.shadow_request.department);
    });

    if (timeSavedEl) timeSavedEl.textContent = `${hoursSaved} hrs`;
    if (deptsEl) deptsEl.textContent = `${deptsSet.size} Depts`;
    
    // Synergy score calculation based on ratio of bundled opportunities
    const bundledCount = opportunities.filter(o => o.status === 'Bundled' || o.is_bundled).length;
    const synergyRate = Math.min(95, 75 + Math.round((bundledCount / opportunities.length) * 20));
    if (synergyEl) synergyEl.textContent = `${synergyRate}%`;
}

async function bundleOpportunity(oppId) {
    try {
        const response = await fetch(`/api/coordination/${oppId}/bundle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Bundle request failed');

        const data = await response.json();
        if (typeof showToast === 'function') {
            showToast('Block Bundled', `Opportunity ${oppId} bundled into a synchronized shadow block window.`);
        }

        await loadCoordinationData();
    } catch (err) {
        console.error('Bundle error:', err);
        alert('Failed to bundle opportunity.');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
