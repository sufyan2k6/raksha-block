/* ==========================================================================
   RAKSHA BLOCK — BLOCK WINDOWS SCRIPT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    loadWindows();

    document.getElementById('addWindowForm')?.addEventListener('submit', handleAddWindow);
});

async function loadWindows() {
    const tbody = document.getElementById('windowsTableBody');
    try {
        const response = await fetch('/api/block-windows');
        if (!response.ok) throw new Error('Failed to fetch windows');

        const data = await response.json();
        const windows = data.windows || [];

        renderWindowsTable(windows);
        updateWindowKPIs(windows);
    } catch (err) {
        console.error('Error loading block windows:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-danger">
                    <i class="bi bi-exclamation-triangle fs-4 mb-2 d-block"></i>
                    <div>Unable to load block windows. Please check backend connection.</div>
                </td>
            </tr>
        `;
    }
}

function renderWindowsTable(windows) {
    const tbody = document.getElementById('windowsTableBody');
    const countBadge = document.getElementById('windowRecordCount');

    if (countBadge) countBadge.textContent = `${windows.length} Windows`;

    if (!windows || windows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-muted">
                    <i class="bi bi-inbox fs-4 mb-2 d-block"></i>
                    No block windows configured.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = windows.map(w => {
        const assignedTasks = w.assigned_tasks || [];
        const hasAssignments = assignedTasks.length > 0;
        const statusBadge = !hasAssignments ? `<span class="badge bg-success-subtle text-success">${w.status || 'Available'}</span>` :
                            w.remaining_minutes === 0 ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle">Fully Booked</span>` :
                            `<span class="badge bg-info-subtle text-info border border-info-subtle">Assigned (${w.occupied_minutes}/${w.duration_minutes}m)</span>`;

        return `
            <tr>
                <td class="font-mono fw-bold">${w.window_id}</td>
                <td class="fw-semibold text-dark">${escapeHtml(w.corridor)}</td>
                <td>${escapeHtml(w.date || '2026-09-21')}</td>
                <td class="font-mono text-primary fw-semibold">${w.start_time} – ${w.end_time}</td>
                <td class="font-mono">
                    ${w.duration_minutes} Mins
                    ${hasAssignments ? `<div class="small text-muted font-mono" style="font-size:0.75rem;">${assignedTasks.map(t => t.request_id).join(', ')} (${w.occupied_minutes}m used)</div>` : ''}
                </td>
                <td>${statusBadge}</td>
                <td class="text-end">
                    <button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="deleteWindow('${w.id}')" title="Delete Block Window">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.deleteWindow = async function(id) {
    if (!confirm('Are you sure you want to delete this block window?')) return;
    try {
        const response = await fetch(`/api/block-windows/${id}`, { method: 'DELETE' });
        const res = await response.json();
        if (!response.ok) {
            alert(res.error || 'Failed to delete block window.');
            return;
        }
        if (typeof showToast === 'function') {
            showToast('Window Deleted', 'Block window slot removed.');
        }
        await loadWindows();
    } catch (err) {
        console.error('Delete window error:', err);
        alert('Server communication error.');
    }
};

function updateWindowKPIs(windows) {
    document.getElementById('kpiWindowTotal').textContent = windows.length;
    const totalMins = windows.reduce((acc, w) => acc + (parseInt(w.duration_minutes) || 0), 0);
    const hrs = (totalMins / 60).toFixed(1);
    document.getElementById('kpiTotalHours').textContent = `${hrs} hrs`;
}

async function handleAddWindow(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const winObj = {
        corridor: formData.get('corridor'),
        date: formData.get('date'),
        start_time: formData.get('start_time'),
        end_time: formData.get('end_time')
    };

    if (winObj.start_time >= winObj.end_time) {
        alert('Validation error: Start time must precede end time for the same date.');
        return;
    }

    try {
        const response = await fetch('/api/block-windows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(winObj)
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Failed to create block window.');
            return;
        }

        const modalEl = document.getElementById('addWindowModal');
        if (window.bootstrap && bootstrap.Modal) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        form.reset();

        if (typeof showToast === 'function') {
            showToast('Block Window Created', `Window ${data.window.window_id} created for ${data.window.corridor}`);
        }

        await loadWindows();
    } catch (err) {
        console.error('Create window error:', err);
        alert('Failed to connect to backend server.');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
