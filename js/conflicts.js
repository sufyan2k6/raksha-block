/* ==========================================================================
   RAKSHA BLOCK — CONFLICT DETECTION FRONTEND ENGINE
   Audits clashes between train movements and maintenance block requests
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    loadConflicts();
});

let cachedConflicts = [];

async function loadConflicts() {
    const tbody = document.getElementById('conflictsTableBody');
    const countBadge = document.getElementById('conflictRecordCount');

    try {
        const response = await fetch('/api/conflicts');
        if (!response.ok) throw new Error('Failed to fetch conflicts');

        const data = await response.json();
        cachedConflicts = data.conflicts || [];

        renderConflictsTable(cachedConflicts);
        updateConflictMetrics(cachedConflicts);
        if (countBadge) countBadge.textContent = `${cachedConflicts.length} Clashes Audited`;
    } catch (err) {
        console.error('Error loading conflicts:', err);
        if (tbody) {
            tbody.innerHTML = `
                <tr><td colspan="7" class="text-center py-4 text-danger">
                    <i class="bi bi-exclamation-triangle fs-4 mb-2 d-block"></i>
                    <div>Error running conflict detection auditor. Check backend engine connection.</div>
                    <button class="btn btn-outline-secondary btn-sm mt-2" onclick="loadConflicts()">Retry Audit</button>
                </td></tr>
            `;
        }
    }
}

function renderConflictsTable(conflicts) {
    const tbody = document.getElementById('conflictsTableBody');
    if (!tbody) return;

    if (!conflicts || conflicts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-success fw-semibold">
            <i class="bi bi-check-circle fs-4 mb-2 d-block"></i>
            No operational conflicts detected. All corridor block windows are clear.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = conflicts.map(c => {
        const isResolved = c.status === 'Resolved';
        const clashType = c.conflict_type || c.type || 'Operational Clash';
        const isTrainClash = clashType.toLowerCase().includes('train');
        const badgeClass = isTrainClash ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-warning-subtle text-warning border border-warning-subtle';
        const overlapWindow = c.overlap_window || c.time_slot || '14:00 – 16:30';
        const entity1 = c.entity_1 || c.primary_task || 'Work Window';
        const entity2 = c.entity_2 || c.conflicting_entity || 'Train Movement';
        const locationText = c.corridor ? `${c.corridor} (${c.location || 'Section'})` : (c.location || 'Corridor C2');

        return `
            <tr class="${isResolved ? 'table-light opacity-75' : ''}">
                <td class="font-mono fw-bold">${escapeHtml(c.conflict_id)}</td>
                <td><span class="badge ${badgeClass}">${escapeHtml(clashType)}</span></td>
                <td>${escapeHtml(locationText)}</td>
                <td class="fw-semibold text-dark">
                    <span>${escapeHtml(entity1)}</span> 
                    <span class="text-danger mx-1">&times;</span> 
                    <span>${escapeHtml(entity2)}</span>
                </td>
                <td class="font-mono fw-bold text-danger">${escapeHtml(overlapWindow)}</td>
                <td class="small text-secondary" style="max-width: 250px;">${escapeHtml(c.recommendation)}</td>
                <td class="text-end">
                    ${isResolved ? `
                        <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                            <i class="bi bi-check2-circle me-1"></i> Resolved
                        </span>
                    ` : `
                        <button class="btn btn-outline-success btn-sm fw-semibold" onclick="resolveConflict('${c.conflict_id}')">
                            <i class="bi bi-check-lg"></i> Resolve
                        </button>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

function updateConflictMetrics(conflicts) {
    const active = conflicts.filter(c => c.status !== 'Resolved');
    const resolved = conflicts.filter(c => c.status === 'Resolved');
    const trainVsMaint = active.filter(c => (c.conflict_type || c.type || '').toLowerCase().includes('train')).length;
    const maintVsMaint = active.length - trainVsMaint;

    const totalEl = document.getElementById('kpiConflictTotal');
    const trainEl = document.getElementById('kpiTrainVsMaint');
    const maintEl = document.getElementById('kpiMaintVsMaint');
    const rateEl = document.getElementById('kpiResolutionRate');
    const subtextEl = document.getElementById('kpiResolutionSubtext');

    if (totalEl) totalEl.textContent = active.length;
    if (trainEl) trainEl.textContent = trainVsMaint;
    if (maintEl) maintEl.textContent = maintVsMaint >= 0 ? maintVsMaint : 0;

    if (rateEl) {
        if (conflicts.length === 0) {
            rateEl.textContent = '100%';
        } else {
            const pct = Math.round((resolved.length / conflicts.length) * 100);
            rateEl.textContent = `${pct}%`;
        }
    }

    if (subtextEl) {
        subtextEl.textContent = `${resolved.length} of ${conflicts.length} cleared`;
    }
}

async function resolveConflict(conflictId) {
    try {
        const response = await fetch(`/api/conflicts/${conflictId}/resolve`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Failed to resolve conflict');

        const data = await response.json();
        if (typeof showToast === 'function') {
            showToast('Conflict Resolved', `Conflict ${conflictId} marked as resolved.`);
        }

        await loadConflicts();
    } catch (err) {
        console.error('Resolve error:', err);
        alert('Failed to update conflict resolution status.');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
