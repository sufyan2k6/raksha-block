/* ==========================================================================
   RAKSHA BLOCK — BLOCK PLANNING & RECOMMENDED PLAN REST API
   Generates recommended plans, handles planner approval and persistent state
   ========================================================================== */

const express = require('express');
const router = express.Router();
const { generateRecommendedPlan, findSuitableBlocks, parseMinutes, formatMinutes } = require('../planningEngine');
const db = require('../db');
const { requirePlanner } = require('../middleware/auth');

// In-memory active plan reference backed by db
let activePlan = null;
// GET /api/block-plans/recommended
router.get('/recommended', (req, res) => {
    try {
        const explicitCorridor = req.query.corridor || null;
        const explicitDate = req.query.date || null;

        const allRequests = (db.getAllRequests() || []).filter(r => r.status === 'Pending' || r.status === 'Planned');
        const allWindows = (db.getAllWindows() || []).filter(w => w.status === 'Available');

        // Check if active approved plan exists in db
        if (db.blockPlans && db.blockPlans.length > 0) {
            const approvedPlan = db.blockPlans.find(p => {
                if (p.status !== 'Approved') return false;
                if (explicitCorridor && p.corridor !== explicitCorridor) return false;
                if (explicitDate && p.date !== explicitDate) return false;
                return true;
            });
            if (approvedPlan && approvedPlan.scheduled_tasks && approvedPlan.scheduled_tasks.length > 0) {
                return res.json({
                    ...approvedPlan,
                    hasRecommendation: true,
                    state: 'RECOMMENDED',
                    title: 'Authorized Block Plan',
                    task_count: approvedPlan.scheduled_tasks.length,
                    conflict_count: 0
                });
            }
        }

        // TEST A: 0 requests AND 0 block windows -> True clean empty state
        if (allRequests.length === 0 && allWindows.length === 0) {
            return res.json({
                hasRecommendation: false,
                state: 'NO_DATA',
                title: 'No recommendation available yet',
                message: 'Create maintenance requests and block windows to generate a block recommendation. There is currently no planning data available.',
                corridor: null,
                block_id: null,
                date: null,
                start_time: null,
                end_time: null,
                scheduled_tasks: [],
                unscheduled_tasks: [],
                task_count: 0,
                conflict_count: 0
            });
        }

        // TEST B: Requests exist, but 0 block windows
        if (allRequests.length > 0 && allWindows.length === 0) {
            const reqCorridor = explicitCorridor || allRequests[0].corridor || null;
            return res.json({
                hasRecommendation: false,
                state: 'NO_WINDOWS',
                title: 'No block recommendation available yet',
                message: 'Maintenance requests are pending, but no block window is available. Create a suitable block window first.',
                corridor: reqCorridor,
                date: null,
                block_id: null,
                start_time: null,
                end_time: null,
                scheduled_tasks: [],
                unscheduled_tasks: allRequests,
                task_count: 0,
                conflict_count: 0
            });
        }

        // Windows exist, but 0 requests
        if (allRequests.length === 0 && allWindows.length > 0) {
            const winCorridor = explicitCorridor || allWindows[0].corridor || null;
            return res.json({
                hasRecommendation: false,
                state: 'NO_REQUESTS',
                title: 'No recommendation available yet',
                message: 'Block windows are configured, but no maintenance requests are pending. Create maintenance requests to generate a block recommendation.',
                corridor: winCorridor,
                date: null,
                block_id: null,
                start_time: null,
                end_time: null,
                scheduled_tasks: [],
                unscheduled_tasks: [],
                task_count: 0,
                conflict_count: 0
            });
        }

        // TEST C & D: Both requests and windows exist!
        // Find which corridor to plan for
        let targetCorridor = explicitCorridor;
        if (!targetCorridor) {
            const reqCorrs = [...new Set(allRequests.map(r => r.corridor).filter(Boolean))];
            const winCorrs = [...new Set(allWindows.map(w => w.corridor).filter(Boolean))];
            const common = reqCorrs.filter(c => winCorrs.includes(c));
            targetCorridor = common[0] || reqCorrs[0] || winCorrs[0] || null;
        }

        const targetDate = explicitDate || null;

        // Generate data-driven recommendation directly from live operational state
        const plan = generateRecommendedPlan(targetCorridor, targetDate || '2026-09-21');
        activePlan = plan;

        const hasTasks = plan && plan.scheduled_tasks && plan.scheduled_tasks.length > 0;
        const hasValidBlock = plan && plan.block_id && plan.block_id !== 'NONE' && plan.block_id !== 'null';

        if (hasTasks && hasValidBlock) {
            return res.json({
                ...plan,
                hasRecommendation: true,
                state: 'RECOMMENDED',
                title: 'Recommended Block Plan Ready',
                task_count: plan.scheduled_tasks.length,
                conflict_count: (plan.detected_conflicts || []).length
            });
        } else {
            // TEST D: Requests and blocks exist, but no feasible recommendation
            return res.json({
                hasRecommendation: false,
                state: 'NO_FEASIBLE',
                title: 'No suitable block found',
                message: plan.recommendation_reason || (plan.reasons && plan.reasons[0] && plan.reasons[0].description) || 'None of the available block windows can accommodate the pending maintenance requests without critical conflicts.',
                corridor: targetCorridor,
                date: targetDate,
                block_id: null,
                start_time: null,
                end_time: null,
                scheduled_tasks: [],
                unscheduled_tasks: plan ? (plan.unscheduled_tasks || []) : [],
                task_count: 0,
                conflict_count: (plan && plan.detected_conflicts || []).length
            });
        }
    } catch (err) {
        console.error('Error fetching recommended plan:', err);
        res.status(500).json({ error: 'Failed to generate recommended plan.' });
    }
});

// POST /api/block-plans/generate (Planner only)
router.post('/generate', requirePlanner, (req, res) => {
    try {
        const { corridor, date } = req.body;
        const allRequests = (db.getAllRequests() || []).filter(r => r.status === 'Pending' || r.status === 'Planned');
        const allWindows = (db.getAllWindows() || []).filter(w => w.status === 'Available');
        const reqCorrs = [...new Set(allRequests.map(r => r.corridor).filter(Boolean))];
        const winCorrs = [...new Set(allWindows.map(w => w.corridor).filter(Boolean))];
        const common = reqCorrs.filter(c => winCorrs.includes(c));
        const targetCorridor = corridor || common[0] || reqCorrs[0] || winCorrs[0] || null;

        if (!targetCorridor) {
            return res.status(400).json({ error: 'No operational corridor data available to plan.' });
        }

        activePlan = generateRecommendedPlan(targetCorridor, date || '2026-09-21');
        activePlan.status = 'Draft Recommended Plan';
        activePlan.approved_by = null;
        activePlan.approved_at = null;

        db.addNotification('Recommended Block Plan Generated', `Generated plan ${activePlan.plan_id || 'Draft'} for ${activePlan.corridor} with ${activePlan.scheduled_tasks ? activePlan.scheduled_tasks.length : 0} scheduled tasks.`);
        res.json({ message: 'Block plan generated successfully.', plan: activePlan });
    } catch (err) {
        console.error('Error generating plan:', err);
        res.status(500).json({ error: 'Failed to generate plan.' });
    }
});

// POST /api/block-plans/approve (Planner only)
router.post('/approve', requirePlanner, (req, res) => {
    try {
        if (!activePlan || !activePlan.scheduled_tasks || activePlan.scheduled_tasks.length === 0) {
            return res.status(400).json({ error: 'No active recommended plan with scheduled tasks to approve.' });
        }

        const empName = req.headers['x-user-name'] || 'Rohan Gupta (Railway Planner)';
        activePlan.status = 'Approved';
        activePlan.approved_by = empName;
        activePlan.approved_at = new Date().toISOString();

        // Persist scheduled status to db.requests
        if (activePlan.scheduled_tasks && Array.isArray(activePlan.scheduled_tasks)) {
            activePlan.scheduled_tasks.forEach(t => {
                db.updateRequest(t.request_id, {
                    status: 'Scheduled',
                    scheduled_slot: `${t.start_time} – ${t.end_time}`,
                    block_id: t.assigned_block_id || activePlan.block_id,
                    assigned_block_id: t.assigned_block_id || activePlan.block_id,
                    start_time: t.start_time,
                    end_time: t.end_time,
                    selection_reason: t.reason_for_selection || t.selection_reason,
                    unscheduled_reason: null
                });
            });
        }

        // Unscheduled tasks remain Pending and retain their explicit exclusion reason
        if (activePlan.unscheduled_tasks && Array.isArray(activePlan.unscheduled_tasks)) {
            activePlan.unscheduled_tasks.forEach(t => {
                db.updateRequest(t.request_id, {
                    status: 'Pending',
                    unscheduled_reason: t.reason
                });
            });
        }

        // Persist into db.blockPlans and save
        if (!db.blockPlans) db.blockPlans = [];
        const existingIdx = db.blockPlans.findIndex(p => p.plan_id === activePlan.plan_id);
        if (existingIdx >= 0) {
            db.blockPlans[existingIdx] = activePlan;
        } else {
            db.blockPlans.push(activePlan);
        }

        db.addNotification('Block Plan Approved & Authorized', `Plan ${activePlan.plan_id} for ${activePlan.corridor} authorized by ${empName}.`);

        res.json({
            message: 'Block plan authorized and saved successfully.',
            plan: activePlan
        });
    } catch (err) {
        console.error('Error approving plan:', err);
        res.status(500).json({ error: 'Failed to approve plan.' });
    }
});

// POST /api/block-plans/reject (Planner only)
router.post('/reject', requirePlanner, (req, res) => {
    try {
        if (!activePlan) {
            return res.status(400).json({ error: 'No active recommended plan to reject.' });
        }

        const empName = req.headers['x-user-name'] || 'Rohan Gupta (Railway Planner)';
        activePlan.status = 'Rejected';
        activePlan.rejected_by = empName;
        activePlan.rejected_at = new Date().toISOString();

        // Revert scheduled status in db.requests if they were scheduled
        if (activePlan.scheduled_tasks && Array.isArray(activePlan.scheduled_tasks)) {
            activePlan.scheduled_tasks.forEach(t => {
                db.updateRequest(t.request_id, {
                    status: 'Pending',
                    scheduled_slot: null,
                    block_id: null
                });
            });
        }

        if (!db.blockPlans) db.blockPlans = [];
        const existingIdx = db.blockPlans.findIndex(p => p.plan_id === activePlan.plan_id);
        if (existingIdx >= 0) {
            db.blockPlans[existingIdx] = activePlan;
        } else {
            db.blockPlans.push(activePlan);
        }

        db.addNotification('Block Plan Rejected', `Plan ${activePlan.plan_id} was rejected by ${empName}. Re-planning required.`);

        res.json({
            message: 'Block plan rejected.',
            plan: activePlan
        });
    } catch (err) {
        console.error('Error rejecting plan:', err);
        res.status(500).json({ error: 'Failed to reject plan.' });
    }
});

// GET /api/block-plans/suitable-blocks/:requestId (Planner only)
router.get('/suitable-blocks/:requestId', requirePlanner, (req, res) => {
    try {
        const { requestId } = req.params;
        const result = findSuitableBlocks(requestId);
        res.json(result);
    } catch (err) {
        console.error(`Error finding suitable blocks for ${req.params.requestId}:`, err);
        const status = err.message && err.message.includes('not found') ? 404 : 500;
        res.status(status).json({ error: err.message || 'Failed to evaluate suitable blocks.' });
    }
});

// POST /api/block-plans/assign (Planner only)
router.post('/assign', requirePlanner, async (req, res) => {
    try {
        const { requestId, blockId } = req.body;
        if (!requestId || !blockId) {
            return res.status(400).json({ error: 'Both requestId and blockId are required.' });
        }

        // 1. Load request from database
        const request = db.getRequestById(requestId);
        if (!request) {
            return res.status(404).json({ error: `Maintenance request ${requestId} not found.` });
        }

        // 2. Load block from database
        const block = db.getAllWindows().find(w => w.window_id === blockId || w.id == blockId);
        if (!block) {
            return res.status(404).json({ error: `Block window ${blockId} not found.` });
        }

        // 3. Verify request is Pending
        if (request.status !== 'Pending') {
            return res.status(400).json({ 
                error: `Invalid assignment: Request ${requestId} has status '${request.status}', but only 'Pending' requests can be assigned to a block.` 
            });
        }

        // 4. Verify block is Available
        if (block.status !== 'Available') {
            return res.status(400).json({ 
                error: `Invalid assignment: Block window ${block.window_id} has status '${block.status}'.` 
            });
        }

        // 5. Verify same corridor
        if (request.corridor && block.corridor && request.corridor.trim().toLowerCase() !== block.corridor.trim().toLowerCase()) {
            return res.status(400).json({ 
                error: `Corridor constraint failed: Request ${requestId} operates on ${request.corridor}, but block ${block.window_id} is located on ${block.corridor}.` 
            });
        }

        // 6. Verify duration fits
        const reqDur = parseInt(request.duration_minutes, 10) || 60;
        const winStartMins = parseMinutes(block.start_time);
        const winEndMins = parseMinutes(block.end_time);
        const blockDur = block.duration_minutes || (winEndMins - winStartMins);

        const existingAssignments = db.getBlockAssignmentsByBlockId(block.window_id);
        const usedMinutes = existingAssignments.reduce((acc, a) => {
            const task = db.getRequestById(a.request_id);
            return acc + (task ? (parseInt(task.duration_minutes, 10) || 0) : 0);
        }, 0);

        const availableMinutes = blockDur - usedMinutes;
        if (availableMinutes < reqDur) {
            return res.status(400).json({ 
                error: `Duration constraint failed: Block ${block.window_id} has only ${availableMinutes} mins remaining (${usedMinutes} mins occupied), but request ${requestId} requires ${reqDur} mins.` 
            });
        }

        // 7. Recalculate train conflicts
        const trains = db.getAllTrains({ corridor: block.corridor });
        const clashingTrains = trains.filter(t => {
            const tStart = parseMinutes(t.start_time);
            const tEnd = parseMinutes(t.end_time);
            return Math.max(winStartMins, tStart) < Math.min(winEndMins, tEnd);
        });

        if (clashingTrains.length > 0) {
            const ct = clashingTrains[0];
            return res.status(400).json({ 
                error: `Train conflict constraint failed: Block window ${block.window_id} conflicts with train ${ct.train_number} (${ct.train_name}) operating between ${ct.start_time} and ${ct.end_time}.` 
            });
        }

        // 8. Prevent duplicate active assignment
        const existingForReq = db.getBlockAssignmentByRequestId(requestId);
        if (existingForReq) {
            return res.status(400).json({ 
                error: `Duplicate assignment constraint failed: Request ${requestId} is already assigned to block ${existingForReq.block_id}.` 
            });
        }

        // 9. Calculate slot
        const taskStartMins = winStartMins + usedMinutes;
        const taskEndMins = taskStartMins + reqDur;
        const assigned_start_time = formatMinutes(taskStartMins);
        const assigned_end_time = formatMinutes(taskEndMins);

        // 10. Planner user attribution
        const empName = req.headers['x-user-name'] || 'Rohan Gupta (Railway Planner)';
        const empId = req.headers['x-employee-id'] || 'EMP001';

        // 11. Create persistent block assignment record in database
        const assignment = await db.createBlockAssignment({
            request_id: request.request_id,
            block_id: block.window_id,
            assigned_start_time,
            assigned_end_time,
            status: 'Confirmed',
            assigned_by: empName,
            employee_id: empId
        });

        // 12. Update maintenance request: Pending -> Scheduled
        await db.updateRequest(request.request_id, {
            status: 'Scheduled',
            block_id: block.window_id,
            assigned_block_id: block.window_id,
            start_time: assigned_start_time,
            end_time: assigned_end_time,
            scheduled_slot: `${assigned_start_time} – ${assigned_end_time}`,
            selection_reason: `Manual planner assignment to ${block.window_id} (${assigned_start_time}–${assigned_end_time}) with zero train conflicts.`,
            unscheduled_reason: null,
            assigned_by: empName,
            scheduled_at: new Date().toISOString()
        });

        db.addNotification(
            'Work Order Assigned to Block', 
            `Request ${request.request_id} (${request.department}) successfully scheduled in block ${block.window_id} by ${empName}.`
        );

        res.json({
            success: true,
            message: `Maintenance request ${request.request_id} successfully scheduled in block ${block.window_id}.`,
            assignment,
            request: db.getRequestById(request.request_id),
            block
        });
    } catch (err) {
        console.error('Error assigning request to block:', err);
        res.status(500).json({ error: err.message || 'Internal server error while assigning block.' });
    }
});

// DELETE /api/block-plans/assign/:requestId (Planner only)
router.delete('/assign/:requestId', requirePlanner, async (req, res) => {
    try {
        const { requestId } = req.params;
        const assignment = db.getBlockAssignmentByRequestId(requestId);
        if (assignment) {
            await db.deleteBlockAssignment(assignment.id);
        }
        await db.updateRequest(requestId, {
            status: 'Pending',
            block_id: null,
            assigned_block_id: null,
            scheduled_slot: null,
            unscheduled_reason: null
        });
        res.json({ success: true, message: `Assignment for ${requestId} cleared.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
