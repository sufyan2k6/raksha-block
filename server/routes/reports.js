/* ==========================================================================
   RAKSHA BLOCK — REPORTS & ANALYTICS REST API
   Dynamically aggregates metrics, corridor utilization and scheduled tasks
   ========================================================================== */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { detectConflicts } = require('../conflictEngine');
const { findCoordinationOpportunities } = require('../coordinationEngine');

// GET /api/reports and /api/reports/kpis
router.get(['/', '/kpis'], (req, res) => {
    try {
        const requests = db.getAllRequests();
        const windows = db.getAllWindows();
        const conflicts = detectConflicts();
        const coordinations = findCoordinationOpportunities();

        const pendingMaintenance = requests.filter(r => r.status === 'Pending' || !r.status).length;
        const highPriority = requests.filter(r => r.priority === 'Critical' || r.priority === 'High').length;
        const availableBlocks = windows.filter(w => w.status === 'Available').length;
        const activeConflicts = conflicts.filter(c => c.status !== 'Resolved').length;
        const plannedTasks = requests.filter(r => r.status === 'Planned' || r.status === 'Scheduled').length;
        const completedTasks = requests.filter(r => r.status === 'Completed').length;

        // Corridor Utilization dynamically calculated
        const corridors = ['Corridor C1', 'Corridor C2', 'Corridor C3'];
        let sumPlannedMinutes = 0;
        let sumCapacityMinutes = 0;

        const corridorUtilization = corridors.map(corridor => {
            const corrReqs = requests.filter(r => r.corridor === corridor && (r.status === 'Planned' || r.status === 'Scheduled'));
            const corrWindows = windows.filter(w => w.corridor === corridor);
            
            const plannedMinutes = corrReqs.reduce((acc, r) => acc + (parseInt(r.duration_minutes, 10) || 0), 0);
            const windowCapacity = corrWindows.reduce((acc, w) => acc + (parseInt(w.duration_minutes, 10) || 0), 0) || 240;
            const maxMinutes = Math.max(windowCapacity, plannedMinutes, 240);

            sumPlannedMinutes += plannedMinutes;
            sumCapacityMinutes += maxMinutes;

            return {
                corridor,
                plannedMinutes,
                maxMinutes,
                percentage: maxMinutes > 0 ? Math.round((plannedMinutes / maxMinutes) * 100) : 0
            };
        });

        const overallEfficiency = sumCapacityMinutes > 0 
            ? `${Math.round((sumPlannedMinutes / sumCapacityMinutes) * 100)}%` 
            : 'No data available';

        const payload = {
            totalRequests: requests.length,
            pendingMaintenance,
            highPriority,
            availableBlocks,
            activeConflicts,
            plannedTasks,
            completedTasks,
            coordinatedTasks: coordinations.length * 2,
            overallEfficiency,
            corridorUtilization
        };

        res.json({
            ...payload,
            kpis: payload,
            summary: payload
        });
    } catch (err) {
        console.error('Error compiling reports:', err);
        res.status(500).json({ error: 'Failed to compile reports.' });
    }
});

module.exports = router;
