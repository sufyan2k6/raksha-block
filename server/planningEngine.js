/* ==========================================================================
   RAKSHA BLOCK — CONSTRAINT SCHEDULING & PLANNING ENGINE
   Audits pending work across all departments, matches feasible block windows,
   detects train clashes, and constructs transparent Recommended Draft Plans.
   ========================================================================== */

const db = require('./db');
const { detectConflicts } = require('./conflictEngine');
const { findCoordinationOpportunities } = require('./coordinationEngine');

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

/**
 * Generates an automated recommended block plan from live pending maintenance requests.
 * @param {string} corridor Target corridor (e.g. 'Corridor C2')
 * @param {string} date Target planning date (e.g. '2026-09-21')
 * @param {string} preferredWindowId Optional explicit block window ID
 */
function generateRecommendedPlan(corridor = null, date = null, preferredWindowId = null) {
    // If corridor is not explicitly specified, derive it from active requests or available windows
    if (!corridor) {
        const allPending = (db.getAllRequests() || []).filter(r => r.status === 'Pending' || r.status === 'Planned');
        const allAvailWindows = (db.getAllWindows() || []).filter(w => w.status === 'Available');
        const reqCorrs = [...new Set(allPending.map(r => r.corridor).filter(Boolean))];
        const winCorrs = [...new Set(allAvailWindows.map(w => w.corridor).filter(Boolean))];
        const common = reqCorrs.filter(c => winCorrs.includes(c));
        corridor = common[0] || reqCorrs[0] || winCorrs[0] || null;
    }

    if (!corridor) {
        return {
            plan_id: null,
            block_id: null,
            corridor: null,
            date: date || null,
            start_time: null,
            end_time: null,
            total_window_minutes: 0,
            used_minutes: 0,
            remaining_buffer_minutes: 0,
            satisfaction_score: '0.0%',
            scheduled_tasks: [],
            unscheduled_tasks: [],
            detected_conflicts: [],
            coordination_opportunities: [],
            reasons: [{ title: 'No Operational Data', description: 'No maintenance requests or block windows exist in the system.' }],
            why_this_plan: [{ title: 'No Operational Data', description: 'No maintenance requests or block windows exist in the system.' }],
            recommendation_reason: 'No maintenance requests or block windows are currently available. Create operational data to generate a recommendation.',
            status: 'No Plan',
            approved_by: null,
            approved_at: null
        };
    }

    // 1. Retrieve all candidate requests for this corridor
    // Every valid request with status 'Pending' or 'Planned' is eligible!
    const allCorridorRequests = db.getAllRequests({ corridor });
    const eligibleRequests = allCorridorRequests.filter(r => 
        r.status === 'Pending' || r.status === 'Planned'
    );

    // 2. Evaluate and sort tasks by Priority: Critical (4) > High (3) > Medium (2) > Low (1)
    const priorityWeight = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
    eligibleRequests.sort((a, b) => {
        const pDiff = (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1);
        if (pDiff !== 0) return pDiff;
        return (a.duration_minutes || 60) - (b.duration_minutes || 60);
    });

    // 3. Retrieve available block windows for this corridor (DO NOT hardcode a block!)
    const availableWindows = db.getAllWindows({ corridor }).filter(w => w.status === 'Available');
    const trains = db.getAllTrains({ corridor });
    const corridorConflicts = detectConflicts().filter(c => c.corridor === corridor);
    const coordinations = findCoordinationOpportunities().filter(c => c.corridor === corridor);

    if (availableWindows.length === 0) {
        // No windows available at all: all pending requests remain Pending
        const unscheduled = eligibleRequests.map(r => ({
            request_id: r.request_id,
            department: r.department || 'P-Way',
            corridor: r.corridor || corridor,
            location: r.location || 'Section Track',
            work_description: r.work_description || r.description || r.asset || 'Maintenance Task',
            duration_minutes: r.duration_minutes || 60,
            priority: r.priority || 'Medium',
            reason: `No feasible block window available for ${corridor}.`,
            status: 'Pending'
        }));

        return {
            plan_id: null,
            block_id: null,
            corridor,
            date: date || null,
            start_time: null,
            end_time: null,
            total_window_minutes: 0,
            used_minutes: 0,
            remaining_buffer_minutes: 0,
            satisfaction_score: '0.0%',
            scheduled_tasks: [],
            unscheduled_tasks: unscheduled,
            detected_conflicts: corridorConflicts,
            coordination_opportunities: coordinations,
            reasons: [{ title: 'No Block Windows Open', description: `No available block windows configured for ${corridor}.` }],
            why_this_plan: [{ title: 'No Block Windows Open', description: `No available block windows configured for ${corridor}.` }],
            recommendation_reason: `No block windows available for ${corridor}. Configure a block window to schedule pending work orders.`,
            status: 'Draft Recommended Plan',
            approved_by: null,
            approved_at: null
        };
    }

    // 4. Dynamic Block Window Selection
    // Score each available window based on train conflict clearance and capacity fit
    let selectedWindow = null;

    if (preferredWindowId) {
        selectedWindow = availableWindows.find(w => w.window_id === preferredWindowId);
    }

    if (!selectedWindow) {
        // Evaluate candidate windows
        const scoredWindows = availableWindows.map(w => {
            const wStart = parseMinutes(w.start_time);
            const wEnd = parseMinutes(w.end_time);
            const wDur = w.duration_minutes || (wEnd - wStart);

            // Audit train overlaps during window
            const clashing = trains.filter(t => {
                const tStart = parseMinutes(t.start_time);
                const tEnd = parseMinutes(t.end_time);
                return Math.max(wStart, tStart) < Math.min(wEnd, tEnd);
            });

            // Calculate capacity fit for top-priority pending tasks
            let fittedMinutes = 0;
            for (const req of eligibleRequests) {
                const dur = req.duration_minutes || 60;
                if (fittedMinutes + dur <= wDur) {
                    fittedMinutes += dur;
                }
            }

            return {
                window: w,
                trainClashes: clashing.length,
                clashingTrains: clashing,
                capacity: wDur,
                fittedMinutes,
                score: (clashing.length === 0 ? 100 : 0) + fittedMinutes
            };
        });

        scoredWindows.sort((a, b) => b.score - a.score);
        selectedWindow = scoredWindows[0].window;
    }

    const windowCapacity = selectedWindow.duration_minutes || 150;
    const winStartMins = parseMinutes(selectedWindow.start_time);
    const winEndMins = winStartMins + windowCapacity;

    // Check train clashes for the chosen window
    const windowTrainClashes = trains.filter(t => {
        const tStart = parseMinutes(t.start_time);
        const tEnd = parseMinutes(t.end_time);
        return Math.max(winStartMins, tStart) < Math.min(winEndMins, tEnd);
    });

    // 5. Match and Schedule Eligible Pending Requests into Window
    let scheduledTasks = [];
    let unscheduledTasks = [];
    let currentUsed = 0;

    eligibleRequests.forEach(task => {
        const taskDur = parseInt(task.duration_minutes, 10) || 60;
        const workDesc = task.work_description || task.description || task.asset || 'Maintenance Task';
        const loc = task.location || `${corridor} Section`;

        // Check A: Train conflict on this specific task
        const directClash = corridorConflicts.find(c => 
            (c.conflict_type === 'Train vs Maintenance' || c.conflict_type === 'TRAIN') &&
            c.status !== 'Resolved' &&
            c.entity_1 && c.entity_1.includes(task.request_id)
        );

        if (directClash) {
            unscheduledTasks.push({
                request_id: task.request_id,
                department: task.department || 'P-Way',
                corridor: task.corridor || corridor,
                location: loc,
                work_description: workDesc,
                duration_minutes: taskDur,
                priority: task.priority || 'Medium',
                reason: `Conflicts with train movement: ${directClash.description || 'Schedule overlap with train headway.'}`,
                status: 'Pending'
            });
            return;
        }

        // Check B: Does the window itself clash with a train?
        if (windowTrainClashes.length > 0) {
            const clashTrain = windowTrainClashes[0];
            unscheduledTasks.push({
                request_id: task.request_id,
                department: task.department || 'P-Way',
                corridor: task.corridor || corridor,
                location: loc,
                work_description: workDesc,
                duration_minutes: taskDur,
                priority: task.priority || 'Medium',
                reason: `Conflicts with train ${clashTrain.train_number} (${clashTrain.train_name}) running ${clashTrain.start_time}–${clashTrain.end_time}.`,
                status: 'Pending'
            });
            return;
        }

        // Check C: Resource / Duration Window Capacity Fit
        if (currentUsed + taskDur <= windowCapacity) {
            const taskStart = winStartMins + currentUsed;
            const taskEnd = taskStart + taskDur;

            // Check if coordinated with another task
            const isCoordinated = coordinations.some(c => 
                (c.primary_request?.request_id === task.request_id || c.shadow_request?.request_id === task.request_id)
            );

            let reasonForSelection = '';
            if (isCoordinated) {
                reasonForSelection = `Bundled cross-department possession (${task.department}) sharing corridor window with zero train conflict.`;
            } else if (task.priority === 'Critical' || task.priority === 'High') {
                reasonForSelection = `Selected for ${selectedWindow.window_id} due to ${task.priority} urgency rating and zero train headway conflict.`;
            } else {
                reasonForSelection = `Accommodated within available ${selectedWindow.window_id} track window (${formatMinutes(taskStart)} – ${formatMinutes(taskEnd)}).`;
            }

            scheduledTasks.push({
                request_id: task.request_id,
                department: task.department || 'P-Way',
                corridor: task.corridor || corridor,
                location: loc,
                work_description: workDesc,
                description: workDesc,
                duration_minutes: taskDur,
                priority: task.priority || 'High',
                assigned_block_id: selectedWindow.window_id,
                block_id: selectedWindow.window_id,
                start_time: formatMinutes(taskStart),
                end_time: formatMinutes(taskEnd),
                scheduled_slot: `${formatMinutes(taskStart)} – ${formatMinutes(taskEnd)}`,
                selection_reason: reasonForSelection,
                reason_for_selection: reasonForSelection,
                reason: reasonForSelection,
                status: 'Draft Scheduled'
            });

            currentUsed += taskDur;
        } else {
            // Task cannot fit remaining capacity of this window
            const remainingCapacity = windowCapacity - currentUsed;
            unscheduledTasks.push({
                request_id: task.request_id,
                department: task.department || 'P-Way',
                corridor: task.corridor || corridor,
                location: loc,
                work_description: workDesc,
                duration_minutes: taskDur,
                priority: task.priority || 'Medium',
                reason: `Exceeds remaining window capacity (${remainingCapacity} mins available, requires ${taskDur} mins). Deferred to next window cycle.`,
                status: 'Pending'
            });
        }
    });

    const remainingBuffer = windowCapacity - currentUsed;

    // Headway safety note
    const trainContextNote = windowTrainClashes.length === 0
        ? `Zero mainline train clashes. Preserves a ${remainingBuffer}-minute buffer before adjacent train movements.`
        : `Window overlaps with train ${windowTrainClashes[0].train_number}; human planner review required.`;

    const distinctDepts = Array.from(new Set(scheduledTasks.map(t => t.department)));

    const reasons = [
        {
            title: 'Dynamic Block Window Fit',
            description: `Matched window ${selectedWindow.window_id} (${selectedWindow.start_time} – ${selectedWindow.end_time}, ${windowCapacity} mins) on ${corridor}. Accommodates ${scheduledTasks.length} work orders totaling ${currentUsed} mins.`
        },
        {
            title: 'Train Headway & Timetable Clearance',
            description: trainContextNote
        },
        {
            title: 'Priority-Driven Work Allocation',
            description: `Prioritized ${scheduledTasks.filter(t => t.priority === 'Critical' || t.priority === 'High').length} High/Critical work orders across departments (${distinctDepts.join(', ') || 'P-Way'}).`
        },
        {
            title: 'Unscheduled Work Preservation',
            description: `${unscheduledTasks.length} pending requests retained with explicit deferral reasons for subsequent window cycles.`
        }
    ];

    const hasScheduled = scheduledTasks.length > 0;

    const satisfactionScore = hasScheduled 
        ? `${Math.min(99, Math.round((currentUsed / windowCapacity) * 100))}%`
        : '0.0%';

    const plan = {
        plan_id: hasScheduled ? `PLAN-2026-${selectedWindow.window_id}` : null,
        block_id: hasScheduled ? selectedWindow.window_id : null,
        corridor: selectedWindow.corridor,
        date: hasScheduled ? (selectedWindow.date || date) : null,
        start_time: hasScheduled ? selectedWindow.start_time : null,
        end_time: hasScheduled ? selectedWindow.end_time : null,
        total_window_minutes: windowCapacity,
        used_minutes: currentUsed,
        remaining_buffer_minutes: remainingBuffer,
        satisfaction_score: satisfactionScore,
        scheduled_tasks: scheduledTasks,
        unscheduled_tasks: unscheduledTasks,
        detected_conflicts: corridorConflicts,
        coordination_opportunities: coordinations,
        reasons,
        why_this_plan: reasons,
        recommendation_reason: hasScheduled
            ? `Recommended possession of block ${selectedWindow.window_id} (${selectedWindow.start_time}–${selectedWindow.end_time}) on ${corridor}. Accommodates ${scheduledTasks.length} tasks.`
            : `None of the available block windows can accommodate the pending maintenance requests due to duration or constraint limits.`,
        status: hasScheduled ? 'Draft Recommended Plan' : 'No Feasible Plan',
        approved_by: null,
        approved_at: null
    };

    return plan;
}

/**
 * Deterministically evaluates suitable block window candidates for a specific maintenance request.
 * Checks corridor matching, capacity, train conflicts, maintenance conflicts, and safety buffers.
 * @param {string} requestId Request ID (e.g. 'M-127')
 */
function findSuitableBlocks(requestId) {
    const req = db.getRequestById(requestId);
    if (!req) {
        throw new Error(`Maintenance request ${requestId} not found.`);
    }

    const allWindows = db.getAllWindows();
    const allTrains = db.getAllTrains();
    const allConflicts = detectConflicts();
    const allAssignments = db.getAllBlockAssignments();

    const reqDur = parseInt(req.duration_minutes, 10) || 60;
    const reqCorridor = req.corridor || null;

    const candidates = [];

    allWindows.forEach(win => {
        const blockId = win.window_id;
        const winCorridor = win.corridor;
        const startTime = win.start_time;
        const endTime = win.end_time;
        const winStartMins = parseMinutes(startTime);
        const winEndMins = parseMinutes(endTime);
        const totalDuration = win.duration_minutes || (winEndMins - winStartMins);

        // Calculate existing block occupancy
        const existingInBlock = allAssignments.filter(a => a.block_id === blockId && a.status !== 'Cancelled');
        const usedMinutes = existingInBlock.reduce((acc, a) => {
            const task = db.getRequestById(a.request_id);
            return acc + (task ? (parseInt(task.duration_minutes, 10) || 0) : 0);
        }, 0);

        const availableMinutes = Math.max(0, totalDuration - usedMinutes);
        const requiredMinutes = reqDur;
        const safetyBufferMinutes = Math.max(0, availableMinutes - requiredMinutes);

        const conflicts = [];

        // Check 1: Corridor match
        const corridorMatch = winCorridor && reqCorridor && (winCorridor.trim().toLowerCase() === reqCorridor.trim().toLowerCase());
        if (!corridorMatch) {
            conflicts.push(`Corridor mismatch: Request is on ${reqCorridor} while window is on ${winCorridor}.`);
        }

        // Check 2: Duration / Capacity fits
        if (totalDuration < requiredMinutes) {
            conflicts.push(`Block total duration (${totalDuration} mins) is shorter than task duration (${requiredMinutes} mins).`);
        } else if (availableMinutes < requiredMinutes) {
            conflicts.push(`Insufficient remaining capacity: ${availableMinutes} mins available (${usedMinutes} mins used by existing assignments), but task requires ${requiredMinutes} mins.`);
        }

        // Check 3: Train movement conflicts
        const clashingTrains = allTrains.filter(t => {
            if (t.corridor !== winCorridor) return false;
            const tStart = parseMinutes(t.start_time);
            const tEnd = parseMinutes(t.end_time);
            return Math.max(winStartMins, tStart) < Math.min(winEndMins, tEnd);
        });

        clashingTrains.forEach(t => {
            conflicts.push(`Conflicts with train ${t.train_number} (${t.train_name}) running ${t.start_time}–${t.end_time}.`);
        });

        // Check 4: Maintenance / spatial conflicts
        const directClashes = allConflicts.filter(c => 
            c.status !== 'Resolved' && 
            (c.entity_1?.includes(requestId) || c.entity_2?.includes(requestId) || c.request_id === req.id || c.request_id === req.request_id)
        );
        directClashes.forEach(c => {
            if (!conflicts.some(ex => ex.includes(c.entity_1 || 'conflict'))) {
                conflicts.push(`Active conflict: ${c.description}`);
            }
        });

        // Check 5: Block status
        if (win.status !== 'Available') {
            conflicts.push(`Block window status is '${win.status}'.`);
        }

        const conflictCount = conflicts.length;
        const feasible = corridorMatch && availableMinutes >= requiredMinutes && clashingTrains.length === 0 && win.status === 'Available';

        // Deterministic suitability score calculation (0 - 100)
        let suitabilityScore = 0;
        let suitabilityReason = '';

        if (feasible) {
            let score = 70; // Base score for clean feasible fit

            // Buffer score (+0 to +15 pts): Optimal buffer is between 15 and 60 minutes
            if (safetyBufferMinutes >= 15 && safetyBufferMinutes <= 60) {
                score += 15;
            } else if (safetyBufferMinutes > 60) {
                score += 10;
            } else {
                score += 5; // tight buffer (<15 mins)
            }

            // Priority score (+2 to +10 pts)
            if (req.priority === 'Critical') score += 10;
            else if (req.priority === 'High') score += 8;
            else if (req.priority === 'Medium') score += 5;
            else score += 2;

            // Synergy score (+5 pts) if bundling with existing assignments without clash
            if (existingInBlock.length > 0) {
                score += 5;
            }

            suitabilityScore = Math.min(100, Math.max(50, score));

            if (existingInBlock.length > 0) {
                suitabilityReason = `Excellent match: Bundles with ${existingInBlock.length} existing task(s) in ${blockId} with ${safetyBufferMinutes} min safety buffer and zero train conflict.`;
            } else if (safetyBufferMinutes >= 30) {
                suitabilityReason = `Task fits within the block with no train conflict and sufficient buffer (${safetyBufferMinutes} min buffer).`;
            } else {
                suitabilityReason = `Feasible window with tight buffer (${safetyBufferMinutes} min). No train conflicts on ${winCorridor}.`;
            }
        } else {
            // Infeasible: Deterministic penalty score
            if (!corridorMatch) {
                suitabilityScore = 10;
                suitabilityReason = `Corridor mismatch: Request is on ${reqCorridor} but block is on ${winCorridor}.`;
            } else if (clashingTrains.length > 0) {
                suitabilityScore = 20;
                suitabilityReason = `Conflicts with train ${clashingTrains[0].train_number} (${clashingTrains[0].train_name}) running ${clashingTrains[0].start_time}–${clashingTrains[0].end_time}.`;
            } else if (availableMinutes < requiredMinutes) {
                suitabilityScore = Math.max(5, Math.round((availableMinutes / requiredMinutes) * 30));
                suitabilityReason = `Exceeds available duration: Requires ${requiredMinutes} mins but only ${availableMinutes} mins available in ${blockId}.`;
            } else {
                suitabilityScore = 15;
                suitabilityReason = conflicts[0] || 'Block window constraints not satisfied.';
            }
        }

        candidates.push({
            blockId,
            corridor: winCorridor,
            startTime,
            endTime,
            availableMinutes,
            requiredMinutes,
            feasible,
            conflictCount,
            conflicts,
            safetyBufferMinutes,
            suitabilityScore,
            suitabilityReason,
            recommended: false
        });
    });

    // Sort candidates: Feasible first, then descending by suitabilityScore, then by corridor match
    candidates.sort((a, b) => {
        if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
        return b.suitabilityScore - a.suitabilityScore;
    });

    // Mark the top feasible candidate as recommended
    const topFeasible = candidates.find(c => c.feasible);
    if (topFeasible) {
        topFeasible.recommended = true;
    }

    return {
        success: true,
        requestId: req.request_id,
        request: {
            id: req.request_id,
            requestId: req.request_id,
            description: req.work_description || req.description || req.asset,
            workDescription: req.work_description || req.description || req.asset,
            department: req.department,
            corridor: req.corridor,
            location: req.location,
            duration: reqDur,
            durationMinutes: reqDur,
            priority: req.priority,
            status: req.status
        },
        candidates
    };
}

module.exports = { 
    generateRecommendedPlan, 
    findSuitableBlocks, 
    parseMinutes, 
    formatMinutes 
};
