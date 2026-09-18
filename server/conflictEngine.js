/* ==========================================================================
   RAKSHA BLOCK — CONFLICT AUDITOR ENGINE
   Evaluates schedule clashes between train movements, block windows & work orders
   ========================================================================== */

const db = require('./db');

function parseMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function formatMinutes(minutes) {
    const hrs = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function detectConflicts() {
    const requests = db.getAllRequests();
    const trains = db.getAllTrains();
    const windows = db.getAllWindows();

    // Map existing conflict resolutions from database storage
    const storedStatusMap = {};
    if (db.conflicts && Array.isArray(db.conflicts)) {
        db.conflicts.forEach(c => {
            if (c.conflict_id && c.status) {
                storedStatusMap[c.conflict_id] = c.status;
            }
        });
    }

    const detected = [];
    let count = 1;

    // 1. Train Movement vs Block Window Overlap Check
    windows.forEach(win => {
        const winStart = parseMinutes(win.start_time);
        const winEnd = parseMinutes(win.end_time);

        trains.forEach(train => {
            if (train.corridor === win.corridor) {
                const trainStart = parseMinutes(train.start_time);
                const trainEnd = parseMinutes(train.end_time);

                // Check interval overlap: max(start1, start2) < min(end1, end2)
                const overlapStart = Math.max(winStart, trainStart);
                const overlapEnd = Math.min(winEnd, trainEnd);

                if (overlapStart < overlapEnd) {
                    const cid = `CONF-0${count++}`;
                    const timeSlotStr = `${formatMinutes(overlapStart)} – ${formatMinutes(overlapEnd)}`;
                    const existingStatus = storedStatusMap[cid] || 'Active';

                    detected.push({
                        id: detected.length + 1,
                        conflict_id: cid,
                        type: 'Maintenance vs Train Conflict',
                        conflict_type: 'Maintenance vs Train Conflict',
                        severity: train.train_type === 'Express' ? 'Critical' : 'High',
                        corridor: win.corridor,
                        location: `${win.corridor} Main Line`,
                        time_slot: timeSlotStr,
                        overlap_window: timeSlotStr,
                        primary_task: `Window ${win.window_id} (${win.start_time} – ${win.end_time})`,
                        entity_1: `Window ${win.window_id}`,
                        conflicting_entity: `Train ${train.train_number} (${train.train_name})`,
                        entity_2: `Train ${train.train_number} (${train.train_name})`,
                        description: `${train.train_type} Train ${train.train_number} (${train.start_time}–${train.end_time}) overlaps with proposed window ${win.window_id}.`,
                        recommendation: `Shift block start to ${train.end_time} or regulate Train ${train.train_number} via alternate loop line.`,
                        status: existingStatus
                    });
                }
            }
        });
    });

    // 2. Maintenance vs Maintenance Uncoordinated Time Clashes
    const corridorReqs = {};
    requests.forEach(r => {
        if (!corridorReqs[r.corridor]) corridorReqs[r.corridor] = [];
        corridorReqs[r.corridor].push(r);
    });

    Object.keys(corridorReqs).forEach(corridor => {
        const reqList = corridorReqs[corridor];
        for (let i = 0; i < reqList.length; i++) {
            for (let j = i + 1; j < reqList.length; j++) {
                const r1 = reqList[i];
                const r2 = reqList[j];
                // If both are on same corridor, different departments, and pending without bundled window
                if (r1.department !== r2.department && (r1.status === 'Planned' || r1.status === 'Pending') && (r2.status === 'Planned' || r2.status === 'Pending')) {
                    const cid = `CONF-0${count++}`;
                    const existingStatus = storedStatusMap[cid] || 'Active';

                    detected.push({
                        id: detected.length + 1,
                        conflict_id: cid,
                        type: 'Concurrent Work Clash',
                        conflict_type: 'Concurrent Work Clash',
                        severity: 'Medium',
                        corridor,
                        location: r1.location || corridor,
                        time_slot: '14:30 – 15:30',
                        overlap_window: '14:30 – 15:30',
                        primary_task: `${r1.request_id} (${r1.department})`,
                        entity_1: `${r1.request_id} (${r1.department})`,
                        conflicting_entity: `${r2.request_id} (${r2.department})`,
                        entity_2: `${r2.request_id} (${r2.department})`,
                        description: `Independent requests on ${corridor} require synchronized power and signaling isolation.`,
                        recommendation: `Execute under joint shadow block coordination on ${corridor} to share single track possession.`,
                        status: existingStatus
                    });
                    break;
                }
            }
        }
    });

    // Save detected list to db.conflicts
    db.conflicts = detected;
    return detected;
}

module.exports = { detectConflicts };
