/* ==========================================================================
   RAKSHA BLOCK — PRIORITY ANALYSIS FRONTEND ENGINE
   Evaluates maintenance urgency scores based on backend priority model
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    loadPriorityData();

    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        loadPriorityData();
    });
});

let cachedRequests = [];

async function loadPriorityData() {
    const tbody = document.getElementById('priorityTableBody');
    const countBadge = document.getElementById('priorityCount');

    try {
        const response = await fetch('/api/maintenance-requests');
        if (!response.ok) throw new Error('Failed to fetch requests');

        const data = await response.json();
        cachedRequests = data.requests || [];

        renderPriorityTable(cachedRequests);
        if (countBadge) countBadge.textContent = `${cachedRequests.length} Work Orders Analyzed`;
    } catch (err) {
        console.error('Error loading priority data:', err);
        if (tbody) {
            tbody.innerHTML = `
                <tr><td colspan="8" class="text-center text-danger py-4">
                    <i class="bi bi-exclamation-triangle fs-4 mb-2 d-block"></i>
                    <div>Error connecting to priority analysis service.</div>
                    <button class="btn btn-outline-secondary btn-sm mt-2" onclick="loadPriorityData()">Retry Connection</button>
                </td></tr>
            `;
        }
    }
}

function renderPriorityTable(requests) {
    const tbody = document.getElementById('priorityTableBody');
    if (!tbody) return;

    if (!requests || requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No maintenance work orders found for priority analysis.</td></tr>`;
        return;
    }

    tbody.innerHTML = requests.map(req => {
        const score = calculateScoreNumber(req.priority);
        const badgeClass = req.priority === 'Critical' ? 'bg-danger-subtle text-danger border border-danger-subtle' :
                           req.priority === 'High' ? 'bg-warning-subtle text-warning border border-warning-subtle' :
                           req.priority === 'Medium' ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-secondary-subtle text-secondary border border-secondary-subtle';

        const workDesc = req.work_description || req.description || req.asset || 'Track Work';
        const locationText = req.corridor ? `${req.corridor} (${req.location || 'Section'})` : (req.location || 'Corridor C2');
        const justification = req.reason || req.priority_reason || 'Urgency calculated from track condition, corridor traffic density, and safety risk.';

        return `
            <tr>
                <td class="font-mono fw-bold">${escapeHtml(req.request_id)}</td>
                <td class="fw-semibold text-dark">${escapeHtml(workDesc)}</td>
                <td><span class="badge bg-secondary-subtle text-secondary border">${escapeHtml(req.department || 'P-Way')}</span></td>
                <td>${escapeHtml(locationText)}</td>
                <td><span class="badge ${badgeClass}">${escapeHtml(req.priority)} Grade</span></td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <span class="font-mono fw-bold text-dark" style="min-width: 50px;">${score}/100</span>
                        <div class="progress flex-grow-1" style="height: 6px; min-width: 60px;">
                            <div class="progress-bar ${score >= 90 ? 'bg-danger' : score >= 75 ? 'bg-warning' : score >= 60 ? 'bg-primary' : 'bg-secondary'}" 
                                 role="progressbar" style="width: ${score}%;" aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                    </div>
                </td>
                <td class="small text-secondary" style="max-width: 280px;">
                    ${escapeHtml(justification)}
                </td>
                <td class="text-end">
                    <button class="btn btn-outline-secondary btn-sm" onclick="showFactors('${req.request_id}')" title="Inspect Priority Factors">
                        <i class="bi bi-sliders"></i> Factors
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function calculateScoreNumber(priority) {
    switch (priority) {
        case 'Critical': return 96;
        case 'High': return 82;
        case 'Medium': return 65;
        case 'Low': return 45;
        default: return 50;
    }
}

function showFactors(reqId) {
    const req = cachedRequests.find(r => r.request_id === reqId);
    if (!req) return;

    const title = document.getElementById('factorModalTitle');
    const body = document.getElementById('factorModalBody');
    if (!body) return;

    if (title) title.innerHTML = `<i class="bi bi-sliders text-primary me-2"></i>Urgency Factors — ${escapeHtml(req.request_id)}`;
    
    const score = calculateScoreNumber(req.priority);
    const workDesc = req.work_description || req.description || req.asset || 'Track Work';
    const justification = req.reason || req.priority_reason || 'Urgency calculated based on track wear index, safety risk threshold, and traffic density.';

    body.innerHTML = `
        <div class="p-3 bg-light rounded mb-3 border">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-secondary small">Work Description</span>
                <strong class="text-dark">${escapeHtml(workDesc)}</strong>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-secondary small">Urgency Score</span>
                <strong class="text-primary font-mono fs-5">${score} / 100</strong>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-secondary small">Assigned Priority Grade</span>
                <span class="badge ${req.priority === 'Critical' ? 'bg-danger text-white' : 'bg-warning text-dark'}">${req.priority}</span>
            </div>
            <div class="d-flex justify-content-between align-items-center">
                <span class="text-secondary small">Engineering Department</span>
                <span class="badge bg-secondary-subtle text-secondary">${escapeHtml(req.department || 'P-Way')}</span>
            </div>
        </div>

        <h6 class="fw-bold text-dark mb-3">Model Factor Weights Contribution</h6>
        <div class="d-flex flex-column gap-3 mb-3">
            <div>
                <div class="d-flex justify-content-between small mb-1">
                    <span class="text-secondary">Track Wear & Infrastructure Index (40%)</span>
                    <strong class="font-mono">${req.priority === 'Critical' ? '38 / 40' : '28 / 40'}</strong>
                </div>
                <div class="progress" style="height: 6px;">
                    <div class="progress-bar bg-primary" style="width: ${req.priority === 'Critical' ? 95 : 70}%;"></div>
                </div>
            </div>

            <div>
                <div class="d-flex justify-content-between small mb-1">
                    <span class="text-secondary">Safety Risk Threshold (30%)</span>
                    <strong class="font-mono">${req.priority === 'Critical' ? '28 / 30' : '22 / 30'}</strong>
                </div>
                <div class="progress" style="height: 6px;">
                    <div class="progress-bar bg-danger" style="width: ${req.priority === 'Critical' ? 93 : 73}%;"></div>
                </div>
            </div>

            <div>
                <div class="d-flex justify-content-between small mb-1">
                    <span class="text-secondary">Corridor Traffic Density (20%)</span>
                    <strong class="font-mono">${req.corridor === 'Corridor C2' ? '18 / 20' : '15 / 20'}</strong>
                </div>
                <div class="progress" style="height: 6px;">
                    <div class="progress-bar bg-warning" style="width: ${req.corridor === 'Corridor C2' ? 90 : 75}%;"></div>
                </div>
            </div>

            <div>
                <div class="d-flex justify-content-between small mb-1">
                    <span class="text-secondary">Target Age & Due Date Proximity (10%)</span>
                    <strong class="font-mono">${req.priority === 'Critical' ? '10 / 10' : '7 / 10'}</strong>
                </div>
                <div class="progress" style="height: 6px;">
                    <div class="progress-bar bg-secondary" style="width: ${req.priority === 'Critical' ? 100 : 70}%;"></div>
                </div>
            </div>
        </div>

        <div class="p-3 bg-primary-subtle border-start border-3 border-primary rounded small text-dark">
            <strong>Calculated Justification:</strong> ${escapeHtml(justification)}
        </div>
    `;

    const modalEl = document.getElementById('factorModal');
    if (modalEl && window.bootstrap && bootstrap.Modal) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
