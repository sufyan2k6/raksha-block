/* ==========================================================================
   RAKSHA BLOCK — TRAIN SCHEDULE SCRIPT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    loadTrains();

    document.getElementById('trainSearchInput')?.addEventListener('input', filterTrains);
    document.getElementById('trainCorridorFilter')?.addEventListener('change', filterTrains);

    document.getElementById('addTrainForm')?.addEventListener('submit', handleAddTrain);
});

let allTrains = [];

async function loadTrains() {
    const tbody = document.getElementById('trainsTableBody');
    try {
        const response = await fetch('/api/trains');
        if (!response.ok) throw new Error('Failed to fetch trains');

        const data = await response.json();
        allTrains = data.trains || [];

        renderTrainsTable(allTrains);
        updateTrainKPIs(allTrains);
    } catch (err) {
        console.error('Error loading train schedule:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-danger">
                    <i class="bi bi-exclamation-triangle fs-4 mb-2 d-block"></i>
                    <div>Unable to load train schedule. Please check backend connection.</div>
                </td>
            </tr>
        `;
    }
}

function renderTrainsTable(trains) {
    const tbody = document.getElementById('trainsTableBody');
    const countBadge = document.getElementById('trainRecordCount');

    if (countBadge) countBadge.textContent = `${trains.length} Trains`;

    if (!trains || trains.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-muted">
                    <i class="bi bi-inbox fs-4 mb-2 d-block"></i>
                    No train movements found matching filter.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = trains.map(t => {
        const badgeClass = t.train_type === 'Freight' ? 'bg-warning-subtle text-warning border-warning-subtle' :
                           t.train_type.includes('Express') ? 'bg-primary-subtle text-primary border-primary-subtle' : 'bg-secondary-subtle text-secondary';

        return `
            <tr>
                <td class="font-mono fw-bold">${t.train_number}</td>
                <td class="fw-semibold text-dark">${escapeHtml(t.train_name)}</td>
                <td><span class="badge border ${badgeClass}">${t.train_type}</span></td>
                <td>${escapeHtml(t.corridor)}</td>
                <td>${escapeHtml(t.origin || 'Entry')} &rarr; ${escapeHtml(t.destination || 'Exit')}</td>
                <td class="font-mono text-primary fw-semibold">${t.start_time} – ${t.end_time}</td>
                <td><span class="badge bg-success-subtle text-success">${t.status || 'Scheduled'}</span></td>
                <td class="text-end">
                    <button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="deleteTrain('${t.id}')" title="Delete Train">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.deleteTrain = async function(id) {
    if (!confirm('Are you sure you want to delete this train movement?')) return;
    try {
        const response = await fetch(`/api/trains/${id}`, { method: 'DELETE' });
        const res = await response.json();
        if (!response.ok) {
            alert(res.error || 'Failed to delete train.');
            return;
        }
        if (typeof showToast === 'function') {
            showToast('Train Deleted', `Train timetable record removed.`);
        }
        await loadTrains();
    } catch (err) {
        console.error('Delete train error:', err);
        alert('Server communication error.');
    }
};

function updateTrainKPIs(trains) {
    document.getElementById('kpiTrainTotal').textContent = trains.length;
    const freight = trains.filter(t => t.train_type === 'Freight').length;
    document.getElementById('kpiFreightCount').textContent = freight;
    document.getElementById('kpiPassengerCount').textContent = trains.length - freight;
}

function filterTrains() {
    const search = document.getElementById('trainSearchInput').value.toLowerCase().trim();
    const corridor = document.getElementById('trainCorridorFilter').value;

    const filtered = allTrains.filter(t => {
        const matchesSearch = !search || t.train_number.toLowerCase().includes(search) || t.train_name.toLowerCase().includes(search);
        const matchesCorridor = !corridor || t.corridor === corridor;
        return matchesSearch && matchesCorridor;
    });

    renderTrainsTable(filtered);
}

function resetTrainFilters() {
    document.getElementById('trainSearchInput').value = '';
    document.getElementById('trainCorridorFilter').value = '';
    renderTrainsTable(allTrains);
}

async function handleAddTrain(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const trainObj = {
        train_number: formData.get('train_number'),
        train_name: formData.get('train_name'),
        train_type: formData.get('train_type'),
        corridor: formData.get('corridor'),
        start_time: formData.get('start_time'),
        end_time: formData.get('end_time')
    };

    if (trainObj.end_time <= trainObj.start_time) {
        alert('Validation error: Train arrival/end time must be after start time.');
        return;
    }

    try {
        const token = sessionStorage.getItem('raksha_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch('/api/trains', {
            method: 'POST',
            headers,
            body: JSON.stringify(trainObj)
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Failed to save train.');
            return;
        }

        const modalEl = document.getElementById('addTrainModal');
        if (window.bootstrap && bootstrap.Modal) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

        form.reset();

        if (typeof showToast === 'function') {
            showToast('Train Added', `Train ${data.train.train_number} added to ${data.train.corridor}`);
        }

        await loadTrains();
    } catch (err) {
        console.error('Add train error:', err);
        alert('Failed to connect to backend server.');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
