/* ==========================================================================
   RAKSHA BLOCK — WHAT-IF SIMULATOR FRONTEND ENGINE
   Interactively evaluates timetable shifts and renders feasibility outcomes
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('simulatorForm');
    const btn = document.getElementById('btnRunSimulation');
    const timeShiftSelect = document.getElementById('timeShiftSelect');
    const corridorSelect = document.getElementById('targetCorridorSelect');
    const useScenarioBtn = document.getElementById('btnUseScenario');

    if (form) {
        form.addEventListener('submit', runSimulation);
    }
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            runSimulation();
        });
    }
    if (timeShiftSelect) {
        timeShiftSelect.addEventListener('change', () => runSimulation());
    }
    if (corridorSelect) {
        corridorSelect.addEventListener('change', () => runSimulation());
    }
    if (useScenarioBtn) {
        useScenarioBtn.addEventListener('click', handleUseScenario);
    }

    // Run initial simulation on load
    runSimulation();
});

let currentScenarioData = null;

function handleUseScenario() {
    if (!currentScenarioData) {
        showSimulatorError('No scenario available to apply.');
        return;
    }

    const scen = currentScenarioData.scenario || currentScenarioData.scenario_plan || {};
    const startTime = scen.startTime || (scen.window ? scen.window.split('–')[0].trim() : '18:30');
    const endTime = scen.endTime || (scen.window ? scen.window.split('–')[1].trim() : '21:00');

    if (typeof showToast === 'function') {
        showToast('Scenario Selected', `Sending proposed ${startTime} – ${endTime} slot to Block Planning...`);
    }

    setTimeout(() => {
        window.location.href = `/planning?proposedStart=${encodeURIComponent(startTime)}&proposedEnd=${encodeURIComponent(endTime)}`;
    }, 400);
}

async function runSimulation(e) {
    if (e && e.preventDefault) e.preventDefault();

    const timeShiftEl = document.getElementById('timeShiftSelect');
    const corridorEl = document.getElementById('targetCorridorSelect');
    const btn = document.getElementById('btnRunSimulation');
    const alertEl = document.getElementById('simulatorAlert');

    if (alertEl) alertEl.style.display = 'none';

    const startTime = timeShiftEl ? timeShiftEl.value : '18:30';
    const corridor = corridorEl ? corridorEl.value : 'Corridor C2';

    const requestPayload = {
        startTime,
        corridor,
        targetStartTime: startTime,
        startTimeShift: startTime,
        targetCorridor: corridor
    };

    console.log('[SIMULATOR] Request:', requestPayload);

    // Set loading state
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Simulating...';
    }

    const box = document.getElementById('simulatedPlanBox');
    if (box) {
        box.innerHTML = `
            <div class="text-center py-4 text-muted">
                <div class="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
                <div>Calculating timetable interval feasibility...</div>
            </div>
        `;
    }

    try {
        const token = sessionStorage.getItem('raksha_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch('/api/what-if', {
            method: 'POST',
            headers,
            body: JSON.stringify(requestPayload)
        });

        const data = await response.json();
        console.log('[SIMULATOR] Response:', data);

        if (!response.ok || data.success === false) {
            throw new Error(data.error || data.details || 'Simulation calculation failed');
        }

        currentScenarioData = data;
        renderSimulationResults(data);
        console.log('[SIMULATOR] Rendered result:', data.feasible ? 'FEASIBLE' : 'NOT FEASIBLE');
    } catch (err) {
        console.error('[SIMULATOR] Error:', err);
        showSimulatorError(err.message || 'Unable to evaluate timetable simulation.');
        if (box) {
            box.innerHTML = `
                <div class="alert alert-danger small py-3 mb-0">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i> ${escapeHtml(err.message || 'Error running simulation.')}
                </div>
            `;
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-play-fill fs-5"></i> <span>Run Simulation</span>';
        }
    }
}

function showSimulatorError(msg) {
    const alertEl = document.getElementById('simulatorAlert');
    const msgEl = document.getElementById('simulatorAlertMsg');
    if (alertEl && msgEl) {
        msgEl.textContent = msg;
        alertEl.style.display = 'block';
    } else {
        alert(msg);
    }
}

function renderSimulationResults(data) {
    if (!data) return;

    const isFeasible = data.feasible === true || data.is_feasible === true;
    const scen = data.scenario || {};
    const scenPlan = data.scenario_plan || {};
    const basePlan = data.baseline_plan || {};
    const conflicts = data.conflicts || [];
    const conflictCount = data.conflictCount !== undefined ? data.conflictCount : conflicts.length;
    const bufferMins = data.safetyBufferMinutes !== undefined ? data.safetyBufferMinutes : (scenPlan.remaining_buffer_minutes || 0);

    // 1. Update Baseline Card
    const baseTimeSlotEl = document.getElementById('baseTimeSlot');
    const baseConflictsEl = document.getElementById('baseConflicts');
    const baseBufferEl = document.getElementById('baseBuffer');

    if (baseTimeSlotEl) baseTimeSlotEl.textContent = basePlan.window || '14:00 – 16:30';
    if (baseConflictsEl) {
        baseConflictsEl.innerHTML = basePlan.conflicts_count > 0
            ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1"><i class="bi bi-exclamation-circle me-1"></i> ${basePlan.conflicts_count} Overlap (Freight T310 Clash)</span>`
            : `<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1"><i class="bi bi-check2 me-1"></i> 0 Overlaps</span>`;
    }
    if (baseBufferEl) baseBufferEl.textContent = `${basePlan.remaining_buffer_minutes || 45} Minutes Buffer`;

    // 2. Update Scenario Card
    const box = document.getElementById('simulatedPlanBox');
    const slotDisplay = scen.startTime && scen.endTime 
        ? `${scen.startTime} – ${scen.endTime}` 
        : (scenPlan.window || 'Simulated Window');

    if (box) {
        let conflictsHtml = '';
        if (conflictCount === 0) {
            conflictsHtml = '<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1"><i class="bi bi-check2-circle me-1"></i> 0 Conflicts (Clear Track Path)</span>';
        } else {
            conflictsHtml = `
                <div class="mb-1">
                    <span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">
                        <i class="bi bi-exclamation-triangle-fill me-1"></i> ${conflictCount} Clash Detected
                    </span>
                </div>
                <div class="small text-danger">
                    ${conflicts.map(c => `<div>&bull; ${escapeHtml(c.name || c.id)}: ${escapeHtml(c.reason || 'Headway overlap')}</div>`).join('')}
                </div>
            `;
        }

        box.innerHTML = `
            <div class="mb-3">
                <div class="small text-muted">Simulated Time Slot (${escapeHtml(scen.corridor || 'Corridor')})</div>
                <div class="fs-5 font-mono fw-bold text-primary">${escapeHtml(slotDisplay)}</div>
            </div>
            <div class="mb-3">
                <div class="small text-muted">Detected Conflicts</div>
                <div>${conflictsHtml}</div>
            </div>
            <div>
                <div class="small text-muted">Safety Buffer Remaining</div>
                <div class="fw-bold ${isFeasible ? 'text-success' : 'text-danger'}">
                    <i class="bi ${isFeasible ? 'bi-shield-check' : 'bi-shield-x'} me-1"></i> ${bufferMins} Minutes Buffer Remaining
                </div>
            </div>
        `;
    }

    // 3. Update Recommendation Banner
    const banner = document.getElementById('recommendationBanner');
    const feasText = document.getElementById('simFeasibilityText');
    const sumText = document.getElementById('simSummaryText');
    const useBtn = document.getElementById('btnUseScenario');

    if (banner) {
        banner.className = isFeasible 
            ? 'card border-success shadow-sm bg-success-subtle border-0 mb-4' 
            : 'card border-danger shadow-sm bg-danger-subtle border-0 mb-4';
        
        const iconEl = banner.querySelector('i');
        if (iconEl) {
            iconEl.className = isFeasible 
                ? 'bi bi-check-circle-fill text-success fs-2' 
                : 'bi bi-x-circle-fill text-danger fs-2';
        }
        
        if (feasText) {
            feasText.className = isFeasible ? 'fw-bold text-success mb-1' : 'fw-bold text-danger mb-1';
            feasText.textContent = data.reason || data.recommendation || (isFeasible ? 'FEASIBLE' : 'NOT FEASIBLE');
        }
        if (sumText) {
            sumText.textContent = data.comparison_summary || (isFeasible 
                ? `Simulated slot ${slotDisplay} clears all scheduled trains with ${bufferMins} mins headway buffer.` 
                : `Target slot ${slotDisplay} overlaps with scheduled traffic on ${scen.corridor || 'Corridor'}.`);
        }
        banner.style.display = 'block';
    }

    if (useBtn) {
        useBtn.style.display = isFeasible ? 'inline-flex' : 'none';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
