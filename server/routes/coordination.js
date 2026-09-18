/* ==========================================================================
   RAKSHA BLOCK — TASK COORDINATION REST API
   Identifies cross-department bundling opportunities and handles bundling
   ========================================================================== */

const express = require('express');
const router = express.Router();
const { findCoordinationOpportunities, bundleOpportunityById } = require('../coordinationEngine');
const { requirePlanner } = require('../middleware/auth');

// GET /api/coordination
router.get('/', (req, res) => {
    try {
        const opportunities = findCoordinationOpportunities();
        res.json({
            count: opportunities.length,
            opportunities
        });
    } catch (err) {
        console.error('Error in GET /api/coordination:', err);
        res.status(500).json({ error: 'Failed to load coordination opportunities.' });
    }
});

// POST /api/coordination/:id/bundle (Planner only)
router.post('/:id/bundle', requirePlanner, (req, res) => {
    try {
        const oppId = req.params.id;
        bundleOpportunityById(oppId);
        res.json({
            message: `Opportunity ${oppId} successfully bundled into joint block.`,
            opportunity_id: oppId,
            status: 'Bundled'
        });
    } catch (err) {
        console.error('Error bundling opportunity:', err);
        res.status(500).json({ error: 'Failed to bundle coordination opportunity.' });
    }
});

module.exports = router;
