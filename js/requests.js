/* ==========================================================================
   RAKSHA BLOCK — MAINTENANCE REQUESTS SCRIPT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initRequestsScreen();

    document.getElementById('searchInput')?.addEventListener('input', filterRequests);
    document.getElementById('deptFilter')?.addEventListener('change', filterRequests);
    document.getElementById('priorityFilter')?.addEventListener('change', filterRequests);

    document.getElementById('newRequestForm')?.addEventListener('submit', handleCreateRequest);
});

let allRequests = [];

function initRequestsScreen() {
    // Set form department strictly from authenticated session context
    const userDept = sessionStorage.getItem('raksha_user_department') || (window.currentUser && window.currentUser.department) || 'P-Way';
    const formDeptEl = document.getElementById('formDeptInput');
    if (formDeptEl) {
        formDeptEl.value = userDept === 'ALL' ? 'Operations' : userDept;
    }

    loadRequests();
}

async function loadRequests() {
    const tbody = document.getElementById('requestsTableBody');
    try {
        const token = sessionStorage.getItem('raksha_token');
        const headers = {
            'x-user-department': sessionStorage.getItem('raksha_user_department') || 'ALL',
            'x-user-role': sessionStorage.getItem('raksha_user_role') || 'Railway Planner'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch('/api/maintenance-requests', { headers });

        if (!response.ok) throw new Error('Failed to fetch requests');

        const data = await response.json();
        allRequests = data.requests || [];

        renderRequestsTable(allRequests);
        updateKPICards(allRequests);
    } catch (err) {
        console.error('Error loading requests:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-danger">
                    <i class="bi bi-exclamation-triangle fs-4 mb-2 d-block"></i>
                    <div>Unable to load maintenance requests. Please check backend connection.</div>
                    <button class="btn btn-outline-secondary btn-sm mt-2" onclick="loadRequests()">Retry Connection</button>
                </td>
            </tr>
        `;
    }
}

function renderRequestsTable(requests) {
    const tbody = document.getElementById('requestsTableBody');
    const countBadge = document.getElementById('tableRecordCount');

    if (countBadge) countBadge.textContent = `${requests.length} Records Found`;

    if (!requests || requests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-muted">
                    <i class="bi bi-inbox fs-4 mb-2 d-block"></i>
                    No maintenance work orders found matching the filter criteria.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = requests.map(req => {
        const priorityClass = req.priority === 'Critical' ? 'badge-priority-critical' :
                              req.priority === 'High' ? 'badge-priority-high' :
                              req.priority === 'Medium' ? 'badge-priority-medium' : 'badge-priority-low';

        const statusClass = req.status === 'Scheduled' || req.status === 'Planned' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning';

        return `
            <tr>
                <td class="font-mono fw-bold">${escapeHtml(req.request_id)}</td>
                <td><span class="badge bg-secondary-subtle text-secondary border">${escapeHtml(req.department)}</span></td>
                <td class="fw-semibold text-dark">${escapeHtml(req.work_description)}</td>
                <td>${escapeHtml(req.corridor)} <small class="text-muted">(${escapeHtml(req.location)})</small></td>
                <td class="font-mono">${req.duration_minutes} Mins</td>
                <td><span class="badge ${priorityClass}">${req.priority} Grade</span></td>
                <td>
                    <span class="badge ${statusClass}">${req.status || 'Pending'}</span>
                    ${req.unscheduled_reason ? `<div class="text-danger small mt-1" style="font-size:0.75rem;"><i class="bi bi-info-circle me-1"></i>${escapeHtml(req.unscheduled_reason)}</div>` : ''}
                </td>
                <td class="text-end text-nowrap">
                    ${(req.status === 'Pending' || !req.status) ? `
                        <button class="btn btn-primary btn-sm me-1 py-1 px-2 fw-semibold d-inline-flex align-items-center gap-1" onclick="openFindBlockModal('${req.request_id}')" title="Find Suitable Block Windows">
                            <i class="bi bi-calendar-plus"></i> Find Block
                        </button>
                    ` : `
                        <span class="badge bg-success-subtle text-success border me-1 font-mono">
                            <i class="bi bi-check-circle me-1"></i>${escapeHtml(req.block_id || req.assigned_block_id || 'Scheduled')}
                        </span>
                    `}
                    <button class="btn btn-light btn-sm me-1 py-1 px-2" onclick="viewDetails('${req.request_id}')" title="Inspect Priority Factors">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm py-1 px-2" onclick="deleteRequest('${req.request_id}')" title="Delete Work Order">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.deleteRequest = async function(reqId) {
    if (!confirm(`Are you sure you want to delete maintenance request ${reqId}?`)) return;
    try {
        const token = sessionStorage.getItem('raksha_token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`/api/maintenance-requests/${reqId}`, {
            method: 'DELETE',
            headers
        });

        const data = await response.json();
        if (!response.ok) {
            alert(data.error || 'Failed to delete request.');
            return;
        }

        if (typeof showToast === 'function') {
            showToast('Request Deleted', `Maintenance order ${reqId} deleted.`);
        }
        await loadRequests();
    } catch (err) {
        console.error('Delete request error:', err);
        alert('Server communication error.');
    }
};

function updateKPICards(requests) {
    document.getElementById('kpiTotal').textContent = requests.length;
    document.getElementById('kpiPending').textContent = requests.filter(r => r.status === 'Pending' || !r.status).length;
    document.getElementById('kpiHighPriority').textContent = requests.filter(r => r.priority === 'Critical' || r.priority === 'High').length;
    document.getElementById('kpiScheduled').textContent = requests.filter(r => r.status === 'Scheduled' || r.status === 'Planned').length;
}

function filterRequests() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const dept = document.getElementById('deptFilter').value;
    const priority = document.getElementById('priorityFilter').value;

    const filtered = allRequests.filter(r => {
        const matchesSearch = !search || 
            r.request_id.toLowerCase().includes(search) || 
            r.work_description.toLowerCase().includes(search) ||
            r.location.toLowerCase().includes(search);
        const matchesDept = !dept || r.department === dept;
        const matchesPriority = !priority || r.priority === priority;

        return matchesSearch && matchesDept && matchesPriority;
    });

    renderRequestsTable(filtered);
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('deptFilter').value = '';
    document.getElementById('priorityFilter').value = '';
    renderRequestsTable(allRequests);
}

async function handleCreateRequest(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const reqObj = {
        department: document.getElementById('formDeptInput').value,
        work_description: formData.get('work_description'),
        corridor: formData.get('corridor'),
        location: formData.get('location'),
        duration_minutes: parseInt(formData.get('duration_minutes')) || 120
    };

    try {
        const response = await fetch('/api/maintenance-requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': sessionStorage.getItem('raksha_emp_id') || 'EMP001',
                'x-user-name': sessionStorage.getItem('raksha_user_name') || 'Railway Planner',
                'x-user-department': sessionStorage.getItem('raksha_user_department') || 'P-Way',
                'x-user-role': sessionStorage.getItem('raksha_user_role') || 'Railway Planner'
            },
            body: JSON.stringify(reqObj)
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Failed to submit request.');
            return;
        }

        // Close modal
        const modalEl = document.getElementById('newRequestModal');
        if (window.bootstrap && bootstrap.Modal) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        form.reset();
        
        // Show success toast feedback
        if (typeof showToast === 'function') {
            showToast('Work Order Created', `Request ${data.request.request_id} created with Priority ${data.request.priority}`);
        }

        await loadRequests();
    } catch (err) {
        console.error('Create request error:', err);
        alert('Failed to connect to backend server.');
    }
}

function viewDetails(reqId) {
    window.location.href = '/priority-analysis';
}

window.openFindBlockModal = async function(requestId) {
    console.log('[BLOCK ASSIGNMENT] Request:', requestId);

    const modalEl = document.getElementById('blockAssignmentModal') || document.getElementById('assignBlockModal');
    if (!modalEl) {
        console.error('[BLOCK ASSIGNMENT] Modal element #blockAssignmentModal not found in DOM');
        alert('Modal element not found in DOM.');
        return;
    }

    // Ensure clean backdrop behavior on close
    if (!modalEl._backdropCleanAttached) {
        modalEl.addEventListener('hidden.bs.modal', () => {
            document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('padding-right');
        });
        modalEl._backdropCleanAttached = true;
    }

    // Immediately show modal with loading state
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();

    // Reset and show initial loading state
    const idEl = document.getElementById('modalRequestId');
    const descEl = document.getElementById('modalRequestWorkDesc');
    const listContainer = document.getElementById('candidatesListContainer');
    const infeasibleSection = document.getElementById('infeasibleBlocksSection');

    if (idEl) idEl.textContent = requestId;
    if (descEl) descEl.textContent = 'Loading request details...';
    if (listContainer) {
        listContainer.innerHTML = `
            <div class="text-center py-4 text-muted">
                <div class="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
                <div class="fw-semibold">Loading suitable blocks...</div>
                <small class="text-muted d-block mt-1">Evaluating available block windows against train movements & headways...</small>
            </div>
        `;
    }
    if (infeasibleSection) infeasibleSection.style.display = 'none';

    try {
        const res = await fetch(`/api/block-plans/suitable-blocks/${encodeURIComponent(requestId)}`);
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to fetch suitable blocks');
        }

        const data = await res.json();
        console.log('[BLOCK ASSIGNMENT] API Response:', data);

        const req = data.request || {};

        // Populate Request Card
        if (idEl) idEl.textContent = req.id || req.requestId || requestId;
        const deptEl = document.getElementById('modalRequestDept');
        if (deptEl) deptEl.textContent = req.department || 'P-Way';
        const priorityEl = document.getElementById('modalRequestPriority');
        if (priorityEl) priorityEl.textContent = `${req.priority || 'Medium'} Grade`;
        const statusEl = document.getElementById('modalRequestStatus');
        if (statusEl) statusEl.textContent = req.status || 'Pending';
        const durEl = document.getElementById('modalRequestDuration');
        if (durEl) durEl.textContent = `${req.durationMinutes || req.duration || 60} min`;
        if (descEl) descEl.textContent = req.description || req.workDescription || 'Track Maintenance Work Order';
        const locEl = document.getElementById('modalRequestCorridorLoc');
        if (locEl) locEl.textContent = `Corridor: ${req.corridor || 'Corridor C3'} • Location: ${req.location || 'Section Track'}`;

        const candidates = data.candidates || [];
        console.log('[BLOCK ASSIGNMENT] Rendered candidates:', candidates.length);

        const feasible = candidates.filter(c => c.feasible);
        const infeasible = candidates.filter(c => !c.feasible);

        // Render Feasible Candidates
        if (listContainer) {
            if (feasible.length === 0) {
                listContainer.innerHTML = `
                    <div class="alert alert-warning border-warning d-flex align-items-center gap-2 mb-0">
                        <i class="bi bi-exclamation-triangle-fill fs-5 text-warning"></i>
                        <div>
                            <strong>No Feasible Block Windows Available</strong>
                            <div class="small text-secondary">All current block windows either have train conflicts, insufficient duration, or corridor mismatch.</div>
                        </div>
                    </div>
                `;
            } else {
                listContainer.innerHTML = feasible.map((c, idx) => {
                    const isBestMatch = c.recommended || idx === 0;
                    return `
                        <div class="card ${isBestMatch ? 'border-success shadow-sm' : 'border'} p-3">
                            <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                                <div class="d-flex align-items-center gap-2">
                                    ${isBestMatch ? '<span class="badge bg-success text-white px-2 py-1"><i class="bi bi-star-fill text-warning me-1"></i>BEST MATCH</span>' : ''}
                                    <span class="fs-5 fw-bold font-mono text-dark">${escapeHtml(c.blockId)}</span>
                                    <span class="badge bg-light text-secondary border">${escapeHtml(c.corridor)}</span>
                                </div>
                                <div class="text-end">
                                    <span class="badge bg-primary-subtle text-primary font-mono fs-6">${escapeHtml(c.startTime)} – ${escapeHtml(c.endTime)}</span>
                                    <div class="text-muted small mt-1">Suitability Score: <strong class="text-success font-mono">${c.suitabilityScore}%</strong></div>
                                </div>
                            </div>

                            <div class="row g-2 mb-3 small text-secondary">
                                <div class="col-sm-6">
                                    <i class="bi bi-clock-history me-1 text-primary"></i> <strong>${c.availableMinutes} min</strong> available (${c.requiredMinutes} min required)
                                </div>
                                <div class="col-sm-6 text-sm-end">
                                    <i class="bi bi-shield-check me-1 text-success"></i> <strong>${c.safetyBufferMinutes} min</strong> safety buffer
                                </div>
                            </div>

                            <div class="d-flex flex-wrap gap-2 mb-3 small">
                                <span class="badge bg-success-subtle text-success border border-success-subtle">
                                    <i class="bi bi-check-circle me-1"></i> No train conflict
                                </span>
                                <span class="badge bg-success-subtle text-success border border-success-subtle">
                                    <i class="bi bi-check-circle me-1"></i> No maintenance conflict
                                </span>
                                <span class="badge bg-info-subtle text-info border border-info-subtle">
                                    <i class="bi bi-shield me-1"></i> ${c.safetyBufferMinutes} min buffer
                                </span>
                            </div>

                            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-2 border-top">
                                <small class="text-secondary" style="max-width: 460px;">${escapeHtml(c.suitabilityReason)}</small>
                                <button class="btn btn-success btn-sm fw-bold px-3 py-2 d-inline-flex align-items-center gap-1" onclick="scheduleInBlock('${escapeHtml(req.id || req.requestId || requestId)}', '${escapeHtml(c.blockId)}')">
                                    <i class="bi bi-calendar-check me-1"></i> Schedule in this Block
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Render Infeasible Candidates if any
        if (infeasible.length > 0) {
            if (infeasibleSection) infeasibleSection.style.display = 'block';
            const countLabel = document.getElementById('infeasibleCountLabel');
            if (countLabel) countLabel.textContent = `Infeasible Block Windows (${infeasible.length})`;

            const infeasibleContainer = document.getElementById('infeasibleListContainer');
            if (infeasibleContainer) {
                infeasibleContainer.innerHTML = infeasible.map(c => `
                    <div class="p-2 bg-light border rounded small d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div>
                            <span class="font-mono fw-bold text-muted">${escapeHtml(c.blockId)}</span>
                            <span class="text-secondary ms-2">(${escapeHtml(c.corridor)} • ${escapeHtml(c.startTime)}–${escapeHtml(c.endTime)})</span>
                        </div>
                        <div class="text-danger fw-semibold">
                            <i class="bi bi-x-circle me-1"></i> ${escapeHtml(c.suitabilityReason)}
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (err) {
        console.error('[BLOCK ASSIGNMENT] Error loading suitable blocks:', err);
        if (listContainer) {
            listContainer.innerHTML = `
                <div class="alert alert-danger border-danger d-flex align-items-center gap-2 mb-0">
                    <i class="bi bi-exclamation-octagon-fill fs-5 text-danger"></i>
                    <div>
                        <strong>Unable to find suitable blocks.</strong>
                        <div class="small text-secondary">Please try again. (${escapeHtml(err.message || 'Server communication error')})</div>
                    </div>
                </div>
            `;
        }
    }
};

window.scheduleInBlock = async function(requestId, blockId) {
    if (!confirm(`Confirm assignment of maintenance request ${requestId} into block window ${blockId}?`)) return;

    try {
        const empName = sessionStorage.getItem('raksha_user_name') || 'Rohan Gupta (Railway Planner)';
        const empId = sessionStorage.getItem('raksha_emp_id') || 'EMP001';

        const response = await fetch('/api/block-plans/assign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-name': empName,
                'x-employee-id': empId
            },
            body: JSON.stringify({ requestId, blockId })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(`Assignment Rejected by Backend:\n\n${data.error || 'Validation failed.'}`);
            return;
        }

        // Close modal and cleanly remove backdrop
        const modalEl = document.getElementById('blockAssignmentModal') || document.getElementById('assignBlockModal');
        if (modalEl && window.bootstrap && bootstrap.Modal) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }
        document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');

        if (typeof showToast === 'function') {
            showToast('Work Order Scheduled', `Request ${requestId} successfully scheduled in block ${blockId} (${data.assignment.assigned_start_time}–${data.assignment.assigned_end_time})`);
        } else {
            alert(`Success: Request ${requestId} scheduled in block ${blockId}!`);
        }

        await loadRequests();
    } catch (err) {
        console.error('Assignment error:', err);
        alert('Network or server communication error.');
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
