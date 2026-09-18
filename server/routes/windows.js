/* ==========================================================================
   RAKSHA BLOCK — BLOCK WINDOWS REST API
   ========================================================================== */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requirePlanner } = require('../middleware/auth');

// GET /api/block-windows
router.get('/', (req, res) => {
    const { corridor } = req.query;
    const windows = db.getAllWindows({ corridor });
    const enriched = windows.map(w => {
        const assignments = db.getBlockAssignmentsByBlockId(w.window_id);
        const assignedTasks = assignments.map(a => {
            const r = db.getRequestById(a.request_id);
            return {
                request_id: a.request_id,
                department: r ? r.department : '',
                work_description: r ? r.work_description : '',
                assigned_start_time: a.assigned_start_time,
                assigned_end_time: a.assigned_end_time,
                duration_minutes: r ? r.duration_minutes : 0
            };
        });
        const occupiedMinutes = assignedTasks.reduce((sum, t) => sum + (parseInt(t.duration_minutes, 10) || 0), 0);
        return {
            ...w,
            assigned_tasks: assignedTasks,
            occupied_minutes: occupiedMinutes,
            remaining_minutes: Math.max(0, (w.duration_minutes || 0) - occupiedMinutes)
        };
    });
    res.json({ count: enriched.length, windows: enriched });
});

// POST /api/block-windows (Planner only)
router.post('/', requirePlanner, async (req, res) => {
    const { corridor, start_time, end_time } = req.body;
    const date = req.body.date || new Date().toISOString().split('T')[0];

    if (!corridor || !start_time || !end_time) {
        return res.status(400).json({ error: 'Required fields missing: Corridor, start time, end time.' });
    }

    // Calculate duration automatically
    const startParts = start_time.split(':').map(Number);
    const endParts = end_time.split(':').map(Number);
    const startMins = startParts[0] * 60 + startParts[1];
    const endMins = endParts[0] * 60 + endParts[1];
    
    if (endMins <= startMins) {
        return res.status(400).json({ error: 'Validation failed: Block start time must precede end time.' });
    }

    const duration = endMins - startMins;

    try {
        const created = await db.createWindow({
            window_id: req.body.window_id,
            corridor,
            date: date || '2026-09-21',
            start_time,
            end_time,
            duration_minutes: duration,
            status: 'Available'
        });

        res.status(201).json({ message: 'Block window created successfully.', window: created });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

// PUT /api/block-windows/:id (Planner only)
router.put('/:id', requirePlanner, async (req, res) => {
    const updated = await db.updateWindow(req.params.id, req.body);
    if (!updated) {
        return res.status(404).json({ error: 'Block window not found.' });
    }
    res.json({ message: 'Block window updated successfully.', window: updated });
});

// DELETE /api/block-windows/:id (Planner only)
router.delete('/:id', requirePlanner, async (req, res) => {
    const success = await db.deleteWindow(req.params.id);
    if (!success) {
        return res.status(404).json({ error: 'Block window not found.' });
    }
    res.json({ message: 'Block window deleted successfully.', id: req.params.id });
});

module.exports = router;
