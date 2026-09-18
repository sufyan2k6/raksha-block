/* ==========================================================================
   RAKSHA BLOCK — WHAT-IF SIMULATOR REST API
   Calculates scenario feasibility against live database train & maintenance records
   ========================================================================== */

const express = require('express');
const router = express.Router();
const { generateRecommendedPlan } = require('../planningEngine');
const db = require('../db');

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

// POST /api/what-if and /api/what-if/run
router.post(['/', '/run'], (req, res) => {
    try {
        const corridor = req.body.corridor || req.body.targetCorridor || 'Corridor C2';
        const startTime = req.body.startTime || req.body.startTimeShift || req.body.targetStartTime || '18:30';
        const targetDate = req.body.date || '2026-09-21';

        // 1. Retrieve Current Baseline Plan
        const currentPlan = generateRecommendedPlan(corridor, targetDate);
        const duration = parseInt(req.body.duration || req.body.duration_minutes || currentPlan.total_window_minutes || 150, 10);

        // 2. Compute Simulated Interval
        const startMins = parseMinutes(startTime);
        const endMins = startMins + duration;
        const endTime = formatMinutes(endMins);

        // 3. Evaluate Train Conflicts on target corridor from live database
        const trains = db.getAllTrains({ corridor });
        const conflicts = [];

        trains.forEach(train => {
            const tStart = parseMinutes(train.start_time);
            const tEnd = parseMinutes(train.end_time);

            // Interval intersection: max(start1, start2) < min(end1, end2)
            if (Math.max(startMins, tStart) < Math.min(endMins, tEnd)) {
                conflicts.push({
                    type: 'TRAIN',
                    id: train.train_number,
                    name: `${train.train_type || 'Train'} ${train.train_number} (${train.train_name})`,
                    corridor: train.corridor,
                    trainWindow: `${train.start_time} – ${train.end_time}`,
                    reason: `Train movement (${train.start_time}–${train.end_time}) overlaps proposed maintenance interval (${startTime}–${endTime}).`
                });
            }
        });

        // 4. Evaluate Scheduled Maintenance Conflicts on target corridor
        const requests = db.getAllRequests();
        const existingScheduled = requests.filter(r => 
            r.corridor === corridor && 
            r.status === 'Scheduled' && 
            r.scheduled_slot
        );

        existingScheduled.forEach(reqTask => {
            const slotParts = reqTask.scheduled_slot.split('–').map(s => s.trim());
            if (slotParts.length === 2) {
                const rStart = parseMinutes(slotParts[0]);
                const rEnd = parseMinutes(slotParts[1]);
                if (Math.max(startMins, rStart) < Math.min(endMins, rEnd)) {
                    conflicts.push({
                        type: 'MAINTENANCE',
                        id: reqTask.request_id,
                        name: `${reqTask.department} Maintenance (${reqTask.work_description || reqTask.asset})`,
                        corridor: reqTask.corridor,
                        window: reqTask.scheduled_slot,
                        reason: `Overlaps existing scheduled possession ${reqTask.request_id} (${reqTask.scheduled_slot}).`
                    });
                }
            }
        });

        // 5. Calculate Safety Buffer to nearest corridor train movement
        let minBuffer = 45;
        trains.forEach(train => {
            const tStart = parseMinutes(train.start_time);
            const tEnd = parseMinutes(train.end_time);
            
            // Train after simulated window
            if (tStart >= endMins) {
                const diff = tStart - endMins;
                if (diff < minBuffer) minBuffer = diff;
            }
            // Train before simulated window
            if (tEnd <= startMins) {
                const diff = startMins - tEnd;
                if (diff < minBuffer) minBuffer = diff;
            }
        });

        const feasible = conflicts.length === 0;
        const conflictCount = conflicts.length;
        const safetyBufferMinutes = feasible ? Math.max(minBuffer, 30) : 0;

        let reason = '';
        let summary = '';
        let recommendation = '';

        if (feasible) {
            reason = `No conflicting train movement or maintenance interval found on ${corridor} between ${startTime} and ${endTime}.`;
            summary = `Shifting block start to ${startTime} completely clears all ${corridor} train movements. 0 clashes detected with ${safetyBufferMinutes} minutes safety buffer.`;
            recommendation = `FEASIBLE — Zero train clashes detected in ${startTime} – ${endTime} window.`;
        } else {
            const conflictLabels = conflicts.map(c => c.name || c.id).join(', ');
            reason = `Scenario conflicts with ${conflictLabels}.`;
            summary = `Advancing block start to ${startTime} overlaps with ${conflictLabels}, violating mandatory train headway clearance.`;
            recommendation = `NOT FEASIBLE — Overlaps with ${conflicts[0]?.name || 'scheduled train'}.`;
        }

        // Difference from baseline plan
        const baseWindow = `${currentPlan.start_time} – ${currentPlan.end_time}`;
        const baseConflictsCount = (currentPlan.detected_conflicts || []).length;
        const timeDiffMinutes = startMins - parseMinutes(currentPlan.start_time);
        const shiftDescription = timeDiffMinutes === 0 ? 'No shift' : timeDiffMinutes > 0 ? `+${timeDiffMinutes} mins later` : `${timeDiffMinutes} mins earlier`;

        const responsePayload = {
            success: true,
            scenario: {
                corridor,
                startTime,
                endTime,
                durationMinutes: duration,
                simulatedWindow: `${startTime} – ${endTime}`,
                shiftDescription,
                baselineWindow: baseWindow,
                is_feasible: feasible,
                feasible,
                recommendation,
                comparison_summary: summary,
                conflicts,
                conflictCount
            },
            feasible,
            conflicts,
            conflictCount,
            safetyBufferMinutes,
            reason,

            // Backwards-compatible structure for existing UI components
            is_feasible: feasible,
            recommendation,
            comparison_summary: summary,
            baseline_plan: {
                block_id: currentPlan.block_id || 'B-102',
                window: `${currentPlan.block_id || 'B-102'} (${currentPlan.start_time} – ${currentPlan.end_time})`,
                start_time: currentPlan.start_time,
                end_time: currentPlan.end_time,
                conflicts_count: baseConflictsCount,
                remaining_buffer_minutes: currentPlan.remaining_buffer_minutes || 45,
                status: currentPlan.status
            },
            scenario_plan: {
                block_id: currentPlan.block_id || 'B-102',
                window: `${currentPlan.block_id || 'B-102'} [Simulated] (${startTime} – ${endTime})`,
                start_time: startTime,
                end_time: endTime,
                conflicts_count: conflictCount,
                clashing_trains: conflicts.map(c => c.id),
                remaining_buffer_minutes: safetyBufferMinutes,
                feasibility_status: feasible ? 'FEASIBLE' : 'NOT FEASIBLE'
            }
        };

        res.json(responsePayload);
    } catch (err) {
        console.error('What-If evaluation error:', err);
        res.status(500).json({
            success: false,
            error: 'Unable to evaluate simulation',
            details: err.message
        });
    }
});

module.exports = router;
