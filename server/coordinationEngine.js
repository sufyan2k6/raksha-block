/* ==========================================================================
   RAKSHA BLOCK — TASK COORDINATION ENGINE
   Discovers cross-department maintenance tasks compatible for combined blocks
   ========================================================================== */

const db = require('./db');

// In-memory or persisted bundle tracker
const bundledOpportunities = new Set();

function findCoordinationOpportunities() {
    const requests = db.getAllRequests();
    
    // Group requests by Corridor
    const corridorMap = {};
    requests.forEach(req => {
        if (!corridorMap[req.corridor]) corridorMap[req.corridor] = [];
        corridorMap[req.corridor].push(req);
    });

    const opportunities = [];
    let count = 1;

    Object.keys(corridorMap).forEach(corridor => {
        const items = corridorMap[corridor];
        
        // Find pairs with different departments
        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const r1 = items[i];
                const r2 = items[j];

                if (r1.department !== r2.department) {
                    const oppId = `CORD-0${count++}`;
                    const savedMins = Math.min(r1.duration_minutes, r2.duration_minutes);
                    const combinedDur = Math.max(r1.duration_minutes, r2.duration_minutes);
                    const desc1 = r1.work_description || r1.description || r1.asset;
                    const desc2 = r2.work_description || r2.description || r2.asset;
                    const isBundled = bundledOpportunities.has(oppId);

                    opportunities.push({
                        id: opportunities.length + 1,
                        opportunity_id: oppId,
                        coordination_id: oppId,
                        corridor,
                        location: r1.location || corridor,
                        title: `${r1.department} + ${r2.department} Joint Block`,
                        primary_request: {
                            request_id: r1.request_id,
                            department: r1.department,
                            work_description: desc1,
                            duration_minutes: r1.duration_minutes,
                            location: r1.location
                        },
                        shadow_request: {
                            request_id: r2.request_id,
                            department: r2.department,
                            work_description: desc2,
                            duration_minutes: r2.duration_minutes,
                            location: r2.location
                        },
                        tasks: [r1.request_id, r2.request_id],
                        task_details: [
                            { id: r1.request_id, dept: r1.department, asset: desc1, dur: r1.duration_minutes },
                            { id: r2.request_id, dept: r2.department, asset: desc2, dur: r2.duration_minutes }
                        ],
                        time_saved_minutes: savedMins,
                        time_saved_hours: (savedMins / 60).toFixed(1),
                        combined_duration: combinedDur,
                        status: isBundled ? 'Bundled' : 'Available',
                        is_bundled: isBundled,
                        reason: `Both requests operate on ${corridor}. Running in a synchronized shadow possession saves ${savedMins} mins of separate line block downtime.`
                    });

                    // Cap to 2 best opportunities per corridor to avoid combinatorial explosion
                    if (opportunities.filter(o => o.corridor === corridor).length >= 2) break;
                }
            }
        }
    });

    return opportunities;
}

function bundleOpportunityById(oppId) {
    bundledOpportunities.add(oppId);
    db.addNotification('Joint Block Bundled', `Opportunity ${oppId} bundled for coordinated execution.`);
    return true;
}

module.exports = { findCoordinationOpportunities, bundleOpportunityById };
