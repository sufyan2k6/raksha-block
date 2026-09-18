/* ==========================================================================
   RAKSHA BLOCK — MAINTENANCE REQUESTS REST API
   Full REST CRUD with Server-Side Department Security & Priority Engine
   ========================================================================== */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { calculatePriority } = require('../priorityEngine');
const { getAuthUser, requireDepartmentEngineer } = require('../middleware/auth');

// GET /api/maintenance-requests - List & Filter
router.get('/', (req, res) => {
    try {
        const authUser = getAuthUser(req);
        let { department, priority, status, search } = req.query;

        // Non-planner department engineers automatically view their own department's requests if department filter is unspecified
        if (!authUser.isPlanner && !department) {
            department = authUser.department;
        }

        const requests = db.getAllRequests({ department, priority, status, search });

        const normalized = requests.map(r => ({
            ...r,
            work_description: r.work_description || r.description || `${r.asset || 'Track Rail'} - ${r.maintenance_type || 'Maintenance'}`,
            description: r.description || r.work_description || r.asset,
            reason: r.reason || r.priority_reason || 'Operational priority evaluation based on track condition.'
        }));

        res.json({
            count: normalized.length,
            requests: normalized
        });
    } catch (err) {
        console.error('Error fetching maintenance requests:', err);
        res.status(500).json({ error: 'Unable to load maintenance requests.' });
    }
});

// GET /api/maintenance-requests/:id - Single Detail
router.get('/:id', (req, res) => {
    try {
        const item = db.getRequestById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Maintenance request not found.' });
        }
        const normalized = {
            ...item,
            work_description: item.work_description || item.description || `${item.asset || 'Track Rail'} - ${item.maintenance_type || 'Maintenance'}`,
            description: item.description || item.work_description || item.asset,
            reason: item.reason || item.priority_reason || 'Operational priority evaluation.'
        };
        res.json(normalized);
    } catch (err) {
        res.status(500).json({ error: 'Unable to retrieve request details.' });
    }
});

// POST /api/maintenance-requests - Create Request (Department Engineers only, Planners return 403)
router.post('/', requireDepartmentEngineer, async (req, res) => {
    try {
        const authUser = req.user || getAuthUser(req);
        const body = req.body;

        const workDesc = (body.work_description || body.description || body.asset || '').trim();
        const location = (body.location || '').trim();
        const corridor = (body.corridor || '').trim();
        const duration_minutes = parseInt(body.duration_minutes, 10);

        // Validation
        const errors = [];
        if (!workDesc) errors.push('Work description / Asset is required.');
        if (!location) errors.push('Location is required.');
        if (!corridor) errors.push('Corridor is required.');
        if (!duration_minutes || duration_minutes <= 0) errors.push('Estimated duration must be greater than 0 minutes.');

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(' ') });
        }

        const urgency = body.urgency || (duration_minutes >= 120 ? 'High' : 'Medium');
        const asset_risk = body.asset_risk || 'High';
        const traffic_impact = body.traffic_impact || 'Medium';
        const due_date = body.due_date || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
        const asset = body.asset ? body.asset.trim() : (workDesc.split('-')[0].trim() || 'Track Bed Asset');
        const maintenance_type = body.maintenance_type ? body.maintenance_type.trim() : 'Track Alignment & Inspection';

        // BACKEND PRIORITY ENGINE
        const priorityResult = calculatePriority({
            urgency,
            asset_risk,
            traffic_impact,
            due_date,
            duration_minutes
        });

        // CRITICAL SECURITY RULE: Department MUST come from authenticated user context!
        const payload = {
            employee_id: authUser.employeeId,
            submitted_by: authUser.name,
            department: authUser.department, // Server enforced!
            asset,
            maintenance_type,
            location,
            corridor,
            duration_minutes,
            urgency,
            asset_risk,
            due_date,
            traffic_impact,
            description: workDesc,
            work_description: workDesc,
            priority: priorityResult.priority,
            priority_reason: priorityResult.priority_reason,
            reason: priorityResult.priority_reason
        };

        const createdRecord = await db.createRequest(payload);
        res.status(201).json({
            message: 'Maintenance request created successfully.',
            request: createdRecord
        });
    } catch (err) {
        console.error('Error creating maintenance request:', err);
        res.status(500).json({ error: 'Server error while creating maintenance request.' });
    }
});

// PUT /api/maintenance-requests/:id - Edit Request
router.put('/:id', async (req, res) => {
    try {
        const reqId = req.params.id;
        const existing = db.getRequestById(reqId);
        if (!existing) {
            return res.status(404).json({ error: 'Maintenance request not found.' });
        }

        const body = req.body;

        // Validation
        const errors = [];
        if (body.asset !== undefined && !body.asset.trim()) errors.push('Asset cannot be empty.');
        if (body.maintenance_type !== undefined && !body.maintenance_type.trim()) errors.push('Maintenance type cannot be empty.');
        if (body.location !== undefined && !body.location.trim()) errors.push('Location cannot be empty.');
        if (body.duration_minutes !== undefined && parseInt(body.duration_minutes, 10) <= 0) errors.push('Duration must be greater than 0.');

        if (errors.length > 0) {
            return res.status(400).json({ error: errors.join(' ') });
        }

        // Check if priority fields changed
        const urgency = body.urgency || existing.urgency;
        const asset_risk = body.asset_risk || existing.asset_risk;
        const traffic_impact = body.traffic_impact || existing.traffic_impact;
        const due_date = body.due_date || existing.due_date;
        const duration_minutes = body.duration_minutes || existing.duration_minutes;

        const priorityResult = calculatePriority({
            urgency, asset_risk, traffic_impact, due_date, duration_minutes
        });

        const updatePayload = {
            ...body,
            priority: priorityResult.priority,
            priority_reason: priorityResult.priority_reason
        };

        const updated = await db.updateRequest(reqId, updatePayload);
        res.json({
            message: 'Maintenance request updated successfully.',
            request: updated
        });
    } catch (err) {
        console.error('Error updating request:', err);
        res.status(500).json({ error: 'Server error while updating request.' });
    }
});

// PATCH /api/maintenance-requests/:id/status - Update Status
router.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['Pending', 'Planned', 'In Progress', 'Completed', 'Rejected'];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const updated = await db.updateStatus(req.params.id, status);
        if (!updated) {
            return res.status(404).json({ error: 'Maintenance request not found.' });
        }

        res.json({
            message: `Request status updated to ${status}.`,
            request: updated
        });
    } catch (err) {
        res.status(500).json({ error: 'Unable to update status.' });
    }
});

// DELETE /api/maintenance-requests/:id - Delete Request
router.delete('/:id', async (req, res) => {
    try {
        const reqId = req.params.id;
        const success = await db.deleteRequest(reqId);
        if (!success) {
            return res.status(404).json({ error: 'Maintenance request not found.' });
        }

        res.json({ message: 'Maintenance request deleted successfully.', request_id: reqId });
    } catch (err) {
        res.status(500).json({ error: 'Unable to delete maintenance request.' });
    }
});

module.exports = router;
