/* ==========================================================================
   RAKSHA BLOCK — REPORTS & ANALYTICS FRONTEND ENGINE
   Renders verified database statistics, corridor utilization, and performance metrics
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    loadReportsData();
});

async function loadReportsData() {
    try {
        const response = await fetch('/api/reports');
        if (!response.ok) throw new Error('Failed to fetch reports');

        const data = await response.json();
        renderReports(data);
    } catch (err) {
        console.error('Error loading reports:', err);
    }
}

function renderReports(data) {
    const totalEl = document.getElementById('repTotalRequests');
    const plannedEl = document.getElementById('repPlannedTasks');
    const coordEl = document.getElementById('repCoordinatedTasks');
    const effEl = document.getElementById('repCorridorEfficiency');

    if (totalEl) totalEl.textContent = data.totalRequests || 0;
    if (plannedEl) plannedEl.textContent = data.plannedTasks || 0;
    if (coordEl) coordEl.textContent = `${data.coordinatedTasks || 0} Tasks`;
    if (effEl) effEl.textContent = data.overallEfficiency || 'No data available';

    const container = document.getElementById('corridorUtilContainer');
    if (!container) return;

    const list = data.corridorUtilization || [];
    if (list.length === 0) {
        container.innerHTML = `<div class="text-muted small">No corridor utilization telemetry recorded.</div>`;
        return;
    }

    container.innerHTML = list.map(c => {
        const pct = c.percentage || Math.round((c.plannedMinutes / c.maxMinutes) * 100) || 0;
        return `
            <div>
                <div class="d-flex justify-content-between font-semibold small mb-1">
                    <span class="fw-bold text-dark">${escapeHtml(c.corridor)}</span>
                    <span class="font-mono text-primary fw-bold">${c.plannedMinutes} / ${c.maxMinutes} mins (${pct}%)</span>
                </div>
                <div class="progress" style="height: 10px;">
                    <div class="progress-bar ${pct > 80 ? 'bg-warning' : 'bg-primary'}" role="progressbar" style="width: ${pct}%;" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
            </div>
        `;
    }).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
