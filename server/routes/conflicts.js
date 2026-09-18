/* ==========================================================================
   RAKSHA BLOCK — CONFLICT DETECTION REST API
   Audits timetable clashes and handles planner resolution persistence
   ========================================================================== */

const express = require('express');
const router = express.Router();
const { detectConflicts } = require('../conflictEngine');
const db = require('../db');
const { requirePlanner } = require('../middleware/auth');

// GET /api/conflicts
router.get('/', (req, res) => {
    try {
        const conflicts = detectConflicts();
        res.json({
            count: conflicts.length,
            activeCount: conflicts.filter(c => c.status !== 'Resolved').length,
            conflicts
        });
    } catch (err) {
        console.error('Error in GET /api/conflicts:', err);
        res.status(500).json({ error: 'Failed to run conflict detection auditor.' });
    }
});

// PATCH /api/conflicts/:id/resolve (Planner only)
router.patch('/:id/resolve', requirePlanner, (req, res) => {
    try {
        const conflictId = req.params.id;
        const conflicts = detectConflicts();
        const target = conflicts.find(c => c.conflict_id === conflictId || String(c.id) === conflictId);

        if (!target) {
            return res.status(404).json({ error: `Conflict ${conflictId} not found.` });
        }

        target.status = 'Resolved';
        db.conflicts = conflicts;
        db.addNotification('Conflict Resolved', `Conflict ${conflictId} marked as resolved by railway planner.`);

        res.json({
            message: `Conflict ${conflictId} marked as resolved.`,
            status: 'Resolved',
            conflict: target
        });
    } catch (err) {
        console.error('Error resolving conflict:', err);
        res.status(500).json({ error: 'Failed to resolve conflict.' });
    }
});

module.exports = router;
