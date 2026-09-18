/* ==========================================================================
   RAKSHA BLOCK — BLOCK PLANNING & RECOMMENDED PLAN FRONTEND ENGINE
   Evaluates constraint-based schedule recommendations and human approval
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    loadPlanningPage();

    document.getElementById('btnRegeneratePlan')?.addEventListener('click', generateNewPlan);
    document.getElementById('btnRunPlanning')?.addEventListener('click', generateNewPlan);
    document.getElementById('planningCorridorSelect')?.addEventListener('change', generateNewPlan);
    document.getElementById('planningDateInput')?.addEventListener('change', generateNewPlan);
    document.getElementById('btnApprovePlan')?.addEventListener('click', approveCurrentPlan);
    document.getElementById('btnRejectPlan')?.addEventListener('click', rejectCurrentPlan);
});

let activePlanData = null;

function getSelectedPlanningParams() {
    const corridor = document.getElementById('planningCorridorSelect')?.value || 'Corridor C2';
    const date = document.getElementById('planningDateInput')?.value || '2026-09-21';
    return { corridor, date };
}

async function loadPlanningPage() {
    try {
        const { corridor, date } = getSelectedPlanningParams();
        const response = await fetch(`/api/block-plans/recommended?corridor=${encodeURIComponent(corridor)}&date=${encodeURIComponent(date)}`);
        if (!response.ok) throw new Error('Failed to fetch recommended plan');

        activePlanData = await response.json();
        renderPlan(activePlanData);
    } catch (err) {
        console.error('Error loading planning page:', err);
        const tbody = document.getElementById('planTasksTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-4 text-danger">
                        <i class="bi bi-exclamation-triangle fs-4 mb-2 d-block"></i>
                        <div>Unable to load recommended block plan. Check backend engine connection.</div>
                        <button class="btn btn-outline-secondary btn-sm mt-2" onclick="loadPlanningPage()">Retry Loading</button>
                    </td>
                </tr>
            `;
        }
    }
}

async function generateNewPlan() {
    const btn = document.getElementById('btnRegeneratePlan');
    const runBtn = document.getElementById('btnRunPlanning');
    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Optimizing...';
        }
        if (runBtn) {
            runBtn.disabled = true;
            runBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Running Engine...';
        }

        const { corridor, date } = getSelectedPlanningParams();
        const response = await fetch('/api/block-plans/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ corridor, date })
        });

        if (!response.ok) throw new Error('Failed to generate plan');

        const data = await response.json();
        activePlanData = data.plan;
        renderPlan(activePlanData);

        if (typeof showToast === 'function') {
            showToast('Plan Generated', `Recommended Block Plan ${activePlanData.plan_id} created with ${activePlanData.scheduled_tasks.length} tasks.`);
        }
    } catch (err) {
        console.error('Plan generation error:', err);
        alert('Failed to run planning engine.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> <span>Generate Plan</span>';
        }
        if (runBtn) {
            runBtn.disabled = false;
            runBtn.innerHTML = '<i class="bi bi-cpu"></i> Run Auto-Planning Engine';
        }
    }
}

async function approveCurrentPlan() {
    if (!activePlanData) return;

    const btn = document.getElementById('btnApprovePlan');
    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Authorizing...';
        }

        const user = window.currentUser || { name: 'Rohan Gupta (Railway Planner)' };
        const response = await fetch('/api/block-plans/approve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-name': user.name || 'Rohan Gupta (Railway Planner)'
            }
        });

        if (!response.ok) throw new Error('Failed to approve plan');

        const data = await response.json();
        activePlanData = data.plan;
        renderPlan(activePlanData);

        if (typeof showToast === 'function') {
            showToast('Plan Authorized & Approved', `Plan ${activePlanData.plan_id} officially signed by ${activePlanData.approved_by || 'Planner'}`);
        }
    } catch (err) {
        console.error('Approve error:', err);
        alert('Failed to authorize plan.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> <span>Approve Plan</span>';
        }
    }
}

async function rejectCurrentPlan() {
    const btn = document.getElementById('btnRejectPlan');
    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Rejecting...';
        }

        const user = window.currentUser || { name: 'Rohan Gupta (Railway Planner)' };
        const response = await fetch('/api/block-plans/reject', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-name': user.name || 'Rohan Gupta (Railway Planner)'
            }
        });

        if (!response.ok) throw new Error('Failed to reject plan');

        const data = await response.json();
        activePlanData = data.plan;
        renderPlan(activePlanData);

        if (typeof showToast === 'function') {
            showToast('Plan Rejected', `Plan ${activePlanData.plan_id} marked as Rejected. Re-planning required.`);
        }
    } catch (err) {
        console.error('Reject error:', err);
        alert('Failed to reject plan.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-x-circle"></i> <span>Reject</span>';
        }
    }
}

function renderPlan(plan) {
    if (!plan) return;

    const planIdEl = document.getElementById('planIdText');
    const planDetailsEl = document.getElementById('planDetailsText');
    const planScoreEl = document.getElementById('planScoreText');
    const badge = document.getElementById('planStatusBadge');
    const approvedByEl = document.getElementById('approvedByText');
    const approvedAtEl = document.getElementById('approvedAtText');

    const hasTasks = plan.scheduled_tasks && plan.scheduled_tasks.length > 0;
    const hasValidBlock = plan.block_id && plan.block_id !== 'NONE';

    if (planIdEl) planIdEl.textContent = plan.plan_id ? `Plan ${plan.plan_id}` : 'No Active Plan';
    if (planDetailsEl) {
        if (hasValidBlock && hasTasks) {
            const timeSlot = (plan.start_time && plan.end_time) ? `(${plan.start_time} – ${plan.end_time})` : '';
            planDetailsEl.textContent = `Target Corridor: ${plan.corridor || 'Unassigned'} • Date: ${plan.date || 'Today'} • Window: ${plan.block_id} ${timeSlot}`;
        } else {
            planDetailsEl.textContent = plan.recommendation_reason || (plan.corridor ? `Target Corridor: ${plan.corridor} • No active block window open.` : 'No operational planning data available.');
        }
    }
    if (planScoreEl) planScoreEl.textContent = plan.satisfaction_score || '0.0%';

    // Check if URL specifies proposed simulated scenario modification
    const urlParams = new URLSearchParams(window.location.search);
    const propStart = urlParams.get('proposedStart');
    const propEnd = urlParams.get('proposedEnd');
    if (propStart && propEnd) {
        const alertEl = document.getElementById('simulationProposalAlert');
        const detEl = document.getElementById('proposalDetails');
        if (alertEl) alertEl.style.setProperty('display', 'flex', 'important');
        if (detEl) detEl.textContent = `Scenario shifted window to ${propStart} – ${propEnd}. Review below before approving.`;
        if (planDetailsEl) {
            planDetailsEl.textContent = `Target Corridor: Corridor C2 • Date: 2026-09-21 • Proposed Shift: (${propStart} – ${propEnd})`;
        }
    }

    const isApproved = plan.status === 'Approved';
    const isRejected = plan.status === 'Rejected';

    if (badge) {
        if (isApproved) {
            badge.className = 'badge bg-success-subtle text-success border border-success-subtle';
            badge.textContent = 'Authorized & Approved Plan';
        } else if (isRejected) {
            badge.className = 'badge bg-danger-subtle text-danger border border-danger-subtle';
            badge.textContent = 'Rejected Plan (Draft Revision Needed)';
        } else {
            badge.className = 'badge bg-warning-subtle text-warning border border-warning-subtle';
            badge.textContent = 'Draft Recommended Plan';
        }
    }

    if (approvedByEl) {
        approvedByEl.textContent = isApproved 
            ? `Authorized by: ${plan.approved_by || 'Railway Planner'}` 
            : 'Status: Awaiting Planner Signature';
    }

    if (approvedAtEl) {
        approvedAtEl.textContent = isApproved 
            ? `Approved on: ${new Date(plan.approved_at || Date.now()).toLocaleString()}` 
            : "Click 'Approve Plan' above to confirm & authorize timetable publish.";
    }

    // Update Count Badges
    const scheduledBadge = document.getElementById('scheduledTasksCountBadge');
    if (scheduledBadge) scheduledBadge.textContent = `${(plan.scheduled_tasks || []).length} Tasks Planned`;

    const unscheduledBadge = document.getElementById('unscheduledTasksCountBadge');
    if (unscheduledBadge) unscheduledBadge.textContent = `${(plan.unscheduled_tasks || []).length} Pending Tasks`;

    // Render Scheduled Tasks Table
    const tbody = document.getElementById('planTasksTableBody');
    const tasks = plan.scheduled_tasks || [];

    if (tbody) {
        if (!tasks || tasks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">No scheduled tasks in this plan.</td></tr>`;
        } else {
            tbody.innerHTML = tasks.map(t => {
                const duration = t.duration_minutes ? `${t.duration_minutes} Mins` : '60 Mins';
                const corridorName = t.corridor || plan.corridor || 'Corridor C2';
                const assignedBlock = t.assigned_block_id || t.block_id || plan.block_id || 'B-105';
                const startTime = t.start_time || 'N/A';
                const endTime = t.end_time || 'N/A';
                const reason = t.reason_for_selection || t.selection_reason || t.reason || 'Optimal constraint fit within window';

                const priorityClass = t.priority === 'Critical' ? 'badge-priority-critical' :
                                      t.priority === 'High' ? 'badge-priority-high' :
                                      t.priority === 'Medium' ? 'badge-priority-medium' : 'badge-priority-low';

                return `
                    <tr>
                        <td class="font-mono fw-bold">${escapeHtml(t.request_id)}</td>
                        <td><span class="badge bg-secondary-subtle text-secondary border">${escapeHtml(t.department || 'P-Way')}</span></td>
                        <td class="text-dark fw-semibold">${escapeHtml(corridorName)}</td>
                        <td class="font-mono">${escapeHtml(duration)}</td>
                        <td><span class="badge ${priorityClass}">${escapeHtml(t.priority || 'High')}</span></td>
                        <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle font-mono">${escapeHtml(assignedBlock)}</span></td>
                        <td class="font-mono text-success fw-bold">${escapeHtml(startTime)}</td>
                        <td class="font-mono text-danger fw-bold">${escapeHtml(endTime)}</td>
                        <td class="small text-secondary" style="max-width: 260px;">${escapeHtml(reason)}</td>
                        <td>
                            <span class="badge bg-success-subtle text-success border border-success-subtle">
                                <i class="bi bi-check2 me-1"></i> ${escapeHtml(t.status || 'Draft Scheduled')}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Render Remaining Pending Work Orders (Unscheduled Tasks)
    const unscheduledTbody = document.getElementById('unscheduledTasksTableBody');
    const unscheduledTasks = plan.unscheduled_tasks || [];

    if (unscheduledTbody) {
        if (!unscheduledTasks || unscheduledTasks.length === 0) {
            unscheduledTbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4 text-success">
                        <i class="bi bi-check-circle-fill me-1"></i> All eligible pending work orders successfully scheduled into block windows.
                    </td>
                </tr>
            `;
        } else {
            unscheduledTbody.innerHTML = unscheduledTasks.map(u => {
                const duration = u.duration_minutes ? `${u.duration_minutes} Mins` : '60 Mins';
                const corridorLoc = `${u.corridor || plan.corridor || 'Corridor C2'} (${u.location || 'Section Track'})`;
                const priorityClass = u.priority === 'Critical' ? 'badge-priority-critical' :
                                      u.priority === 'High' ? 'badge-priority-high' :
                                      u.priority === 'Medium' ? 'badge-priority-medium' : 'badge-priority-low';

                return `
                    <tr>
                        <td class="font-mono fw-bold">${escapeHtml(u.request_id)}</td>
                        <td><span class="badge bg-secondary-subtle text-secondary border">${escapeHtml(u.department || 'P-Way')}</span></td>
                        <td class="text-secondary small">${escapeHtml(corridorLoc)}</td>
                        <td class="font-mono">${escapeHtml(duration)}</td>
                        <td><span class="badge ${priorityClass}">${escapeHtml(u.priority || 'Medium')}</span></td>
                        <td>
                            <span class="badge bg-warning-subtle text-warning border border-warning-subtle">
                                <i class="bi bi-clock me-1"></i> ${escapeHtml(u.status || 'Pending')}
                            </span>
                        </td>
                        <td class="small text-danger fw-semibold">
                            <i class="bi bi-exclamation-triangle me-1"></i> ${escapeHtml(u.reason || 'No feasible block window available')}
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Render Dynamic "Why This Plan?" Explanations
    const reasonsContainer = document.getElementById('whyThisPlanContainer');
    if (reasonsContainer) {
        const reasons = plan.reasons || [];
        if (reasons.length > 0) {
            reasonsContainer.innerHTML = reasons.map(r => `
                <div class="d-flex align-items-start gap-2 p-2 bg-light rounded border">
                    <i class="bi bi-check-circle-fill text-success fs-5 mt-1"></i>
                    <div>
                        <div class="fw-semibold small text-dark">${escapeHtml(r.title)}</div>
                        <small class="text-secondary">${escapeHtml(r.description)}</small>
                    </div>
                </div>
            `).join('');
        } else {
            reasonsContainer.innerHTML = `
                <div class="d-flex align-items-start gap-2 p-2 bg-light rounded border">
                    <i class="bi bi-check-circle-fill text-success fs-5 mt-1"></i>
                    <div>
                        <div class="fw-semibold small text-dark">Optimal Constraint Alignment</div>
                        <small class="text-secondary">${escapeHtml(plan.recommendation_reason || 'Satisfies all corridor track and timetable constraints.')}</small>
                    </div>
                </div>
            `;
        }
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
