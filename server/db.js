/* ==========================================================================
   RAKSHA BLOCK — SUPABASE POSTGRESQL DATABASE SERVICE
   Direct Relational Integration with Supabase PostgreSQL
   (Replaces temporary data_store.json runtime storage)
   ========================================================================== */

require('dotenv').config();
const { supabase } = require('./supabaseClient');

class DatabaseService {
    constructor() {
        this.supabase = supabase;
        this.departments = [];
        this.corridors = [];
        this.profiles = [];
        this.assets = [];
        this.requests = [];
        this.trains = [];
        this.windows = [];
        this.blockAssignments = [];
        this.blockPlans = [];
        this.scheduledTasks = [];
        this.conflicts = [];
        this.coordinationBundles = [];
        this.notifications = [];
        this.userPreferences = {};
        this.auditLogs = [];

        this.deptMap = {};
        this.corrMap = {};
        this.profMap = {};

        this.isInitialized = false;
        this.initPromise = this.reloadFromSupabase();
    }

    /**
     * Reloads all operational state directly from Supabase PostgreSQL tables.
     */
    async reloadFromSupabase() {
        if (!this.supabase) {
            console.error('⚠️ [SUPABASE DB] Supabase client is not available!');
            return;
        }

        try {
            // 1. Departments
            const { data: depts, error: deptErr } = await this.supabase.from('departments').select('*');
            if (deptErr) throw deptErr;
            this.departments = depts || [];
            this.deptMap = {};
            this.departments.forEach(d => {
                this.deptMap[d.id] = d.code;
                this.deptMap[d.code] = d.id;
            });

            // 2. Corridors
            const { data: corrs, error: corrErr } = await this.supabase.from('corridors').select('*');
            if (corrErr) throw corrErr;
            this.corridors = corrs || [];
            this.corrMap = {};
            this.corridors.forEach(c => {
                this.corrMap[c.id] = `Corridor ${c.code}`;
                this.corrMap[c.code] = c.id;
                this.corrMap[`Corridor ${c.code}`] = c.id;
            });

            // 3. Profiles
            const { data: profs, error: profErr } = await this.supabase.from('profiles').select('*');
            if (profErr) throw profErr;
            this.profiles = (profs || []).map(p => ({
                id: p.id,
                employeeId: p.employee_id,
                name: p.full_name,
                email: p.email,
                role: p.role,
                department: this.deptMap[p.department_id] || 'Operations',
                department_id: p.department_id,
                division: p.division,
                section: p.section,
                pass: p.password_hash || 'planner123'
            }));
            this.profMap = {};
            this.profiles.forEach(p => {
                this.profMap[p.id] = p.employeeId;
                this.profMap[p.employeeId] = p.id;
            });

            // 4. Assets
            const { data: assets, error: assetErr } = await this.supabase.from('assets').select('*');
            if (assetErr) throw assetErr;
            this.assets = assets || [];

            // 5. Trains
            const { data: trains, error: trainErr } = await this.supabase.from('trains').select('*').order('start_time', { ascending: true });
            if (trainErr) throw trainErr;
            this.trains = (trains || []).map(t => ({
                id: t.id,
                train_id: t.train_id,
                train_number: t.train_number,
                train_name: t.train_name,
                train_type: t.train_type,
                corridor: this.corrMap[t.corridor_id] || 'Corridor C2',
                corridor_id: t.corridor_id,
                origin: t.origin,
                destination: t.destination,
                start_time: t.start_time ? t.start_time.slice(0, 5) : '08:00',
                end_time: t.end_time ? t.end_time.slice(0, 5) : '10:00',
                priority: t.priority || 'Normal',
                status: t.status || 'Active',
                delay_minutes: t.delay_minutes || 0
            }));

            // 6. Block Windows
            const { data: windows, error: winErr } = await this.supabase.from('block_windows').select('*').order('start_time', { ascending: true });
            if (winErr) throw winErr;
            this.windows = (windows || []).map(w => ({
                id: w.id,
                window_id: w.block_code,
                block_code: w.block_code,
                corridor: this.corrMap[w.corridor_id] || 'Corridor C2',
                corridor_id: w.corridor_id,
                start_time: w.start_time ? w.start_time.slice(0, 5) : '09:00',
                end_time: w.end_time ? w.end_time.slice(0, 5) : '11:00',
                duration_minutes: w.duration_minutes,
                status: w.status || 'Available',
                occupied_minutes: w.occupied_minutes || 0,
                assigned_tasks: []
            }));

            // 7. Maintenance Requests
            const { data: reqs, error: reqErr } = await this.supabase.from('maintenance_requests').select('*').order('created_at', { ascending: false });
            if (reqErr) throw reqErr;
            this.requests = (reqs || []).map(r => ({
                id: r.id,
                request_id: r.request_code,
                request_code: r.request_code,
                employee_id: this.profMap[r.submitted_by] || 'EMP001',
                submitted_by: r.submitted_by,
                department: this.deptMap[r.department_id] || 'P-Way',
                department_id: r.department_id,
                corridor: this.corrMap[r.corridor_id] || 'Corridor C2',
                corridor_id: r.corridor_id,
                work_description: r.work_description,
                description: r.work_description,
                location: r.location,
                duration_minutes: r.duration_minutes,
                priority: r.priority_level,
                priority_level: r.priority_level,
                priority_score: Number(r.priority_score) || 70,
                status: r.status || 'Pending',
                reason: r.reason || 'Calculated operational priority.',
                priority_reason: r.reason || 'Calculated operational priority.',
                assigned_block_id: r.assigned_block_id || null,
                block_id: r.assigned_block_id || null,
                scheduled_slot: r.scheduled_slot || null,
                created_at: r.created_at,
                updated_at: r.updated_at
            }));

            // 8. Block Assignments
            const { data: assigns, error: assignErr } = await this.supabase.from('block_assignments').select('*');
            if (assignErr) throw assignErr;
            this.blockAssignments = (assigns || []).map(a => {
                const req = this.requests.find(r => r.id === a.request_id || r.request_id === a.request_id);
                const win = this.windows.find(w => w.id === a.block_window_id || w.window_id === a.block_window_id);
                return {
                    id: a.id,
                    request_id: req ? req.request_id : a.request_id,
                    request_uuid: a.request_id,
                    block_id: win ? win.window_id : a.block_window_id,
                    block_uuid: a.block_window_id,
                    assigned_start_time: a.assigned_start_time ? new Date(a.assigned_start_time).toISOString().slice(11, 16) : '09:00',
                    assigned_end_time: a.assigned_end_time ? new Date(a.assigned_end_time).toISOString().slice(11, 16) : '11:00',
                    status: a.status || 'Confirmed',
                    assigned_by: a.assigned_by,
                    employee_id: this.profMap[a.assigned_by] || 'EMP001',
                    created_at: a.created_at
                };
            });

            // Map assignments to window occupied minutes & assigned_tasks
            this.windows.forEach(w => {
                const assigned = this.blockAssignments.filter(a => a.block_id === w.window_id && a.status !== 'Cancelled');
                w.assigned_tasks = assigned;
                let occupied = 0;
                assigned.forEach(a => {
                    const r = this.requests.find(req => req.request_id === a.request_id);
                    if (r) occupied += (r.duration_minutes || 0);
                });
                w.occupied_minutes = occupied;
            });

            // 9. Block Plans
            const { data: plans, error: planErr } = await this.supabase.from('block_plans').select('*');
            if (!planErr && plans) {
                this.blockPlans = plans.map(p => ({
                    id: p.id,
                    plan_id: p.plan_code,
                    name: p.name,
                    corridor: this.corrMap[p.corridor_id] || 'Corridor C2',
                    status: p.status,
                    total_tasks: p.total_tasks,
                    total_duration: p.total_duration_minutes,
                    scheduled_tasks: [],
                    created_at: p.created_at
                }));
            }

            // 10. Conflicts
            const { data: confs, error: confErr } = await this.supabase.from('conflicts').select('*');
            if (!confErr && confs) {
                this.conflicts = confs.map(c => ({
                    id: c.id,
                    conflict_id: c.conflict_code,
                    conflict_code: c.conflict_code,
                    type: c.conflict_type,
                    severity: c.severity,
                    corridor: this.corrMap[c.corridor_id] || 'Corridor C2',
                    description: c.description,
                    resolution: c.resolution,
                    status: c.status,
                    created_at: c.created_at
                }));
            }

            // 11. Notifications
            const { data: notifs, error: notifErr } = await this.supabase.from('notifications').select('*').order('created_at', { ascending: false });
            if (!notifErr && notifs) {
                this.notifications = notifs.map(n => ({
                    id: n.id,
                    title: n.title,
                    message: n.message,
                    type: n.notification_type,
                    severity: n.severity,
                    is_read: n.is_read,
                    time: 'Recently'
                }));
            }

            this.isInitialized = true;
            console.log(`⚡ [SUPABASE DB] Synchronized with PostgreSQL: ${this.requests.length} requests, ${this.trains.length} trains, ${this.windows.length} windows, ${this.blockAssignments.length} assignments.`);
        } catch (err) {
            console.error('⚠️ [SUPABASE DB] Synchronization error:', err.message);
        }
    }

    saveStore() {
        // No-op: All operations persist directly into Supabase PostgreSQL tables
    }

    // ==========================================
    // USERS & AUTHENTICATION
    // ==========================================
    getUsers() {
        return this.profiles;
    }

    getUserById(empId) {
        if (!empId) return null;
        return this.profiles.find(u => u.employeeId.toLowerCase() === empId.toLowerCase());
    }

    getUserByEmail(email) {
        if (!email) return null;
        return this.profiles.find(u => u.email.toLowerCase() === email.toLowerCase());
    }

    // ==========================================
    // MAINTENANCE REQUESTS
    // ==========================================
    getAllRequests(filters = {}) {
        let res = [...this.requests];
        if (filters.corridor && filters.corridor !== 'All' && filters.corridor !== 'ALL') {
            res = res.filter(r => r.corridor && r.corridor.toLowerCase() === filters.corridor.toLowerCase());
        }
        if (filters.department && filters.department !== 'All') {
            res = res.filter(r => r.department && r.department.toLowerCase() === filters.department.toLowerCase());
        }
        if (filters.priority && filters.priority !== 'All') {
            res = res.filter(r => r.priority && r.priority.toLowerCase() === filters.priority.toLowerCase());
        }
        if (filters.status && filters.status !== 'All') {
            res = res.filter(r => r.status && r.status.toLowerCase() === filters.status.toLowerCase());
        }
        if (filters.search) {
            const q = filters.search.toLowerCase();
            res = res.filter(r =>
                (r.request_id && r.request_id.toLowerCase().includes(q)) ||
                (r.work_description && r.work_description.toLowerCase().includes(q)) ||
                (r.location && r.location.toLowerCase().includes(q)) ||
                (r.department && r.department.toLowerCase().includes(q))
            );
        }
        return res;
    }

    getRequestById(id) {
        return this.requests.find(r => r.request_id === id || r.request_code === id || r.id === id);
    }

    async createRequest(data) {
        let maxSuffix = 100;
        this.requests.forEach(r => {
            if (r.request_id && r.request_id.startsWith('M-')) {
                const num = parseInt(r.request_id.slice(2), 10);
                if (!isNaN(num) && num > maxSuffix) maxSuffix = num;
            }
        });
        const newReqCode = data.request_id || data.request_code || `M-${maxSuffix + 1}`;

        // Map foreign keys
        const deptId = this.deptMap[data.department] || this.deptMap['P-Way'];
        let corrCode = 'C2';
        if (data.corridor && data.corridor.includes('C1')) corrCode = 'C1';
        else if (data.corridor && data.corridor.includes('C3')) corrCode = 'C3';
        const corrId = this.corrMap[corrCode] || this.corrMap['C2'];
        const profileId = this.profMap[data.employee_id] || this.profMap['EMP001'];

        const insertPayload = {
            request_code: newReqCode,
            department_id: deptId,
            corridor_id: corrId,
            submitted_by: profileId,
            work_description: data.work_description || data.description || 'Railway Track Maintenance',
            location: data.location || 'KM Section',
            duration_minutes: parseInt(data.duration_minutes) || 120,
            priority_level: data.priority || data.priority_level || 'Medium',
            priority_score: data.priority_score || 70,
            status: data.status || 'Pending',
            reason: data.reason || data.priority_reason || 'Operational priority based on track parameters.'
        };

        const { data: inserted, error } = await this.supabase.from('maintenance_requests').insert([insertPayload]).select().single();
        if (error) throw error;

        const record = {
            id: inserted.id,
            request_id: inserted.request_code,
            request_code: inserted.request_code,
            employee_id: data.employee_id || 'EMP001',
            submitted_by: inserted.submitted_by,
            department: data.department || 'P-Way',
            department_id: deptId,
            corridor: `Corridor ${corrCode}`,
            corridor_id: corrId,
            work_description: inserted.work_description,
            description: inserted.work_description,
            location: inserted.location,
            duration_minutes: inserted.duration_minutes,
            priority: inserted.priority_level,
            priority_level: inserted.priority_level,
            priority_score: inserted.priority_score,
            status: inserted.status,
            reason: inserted.reason,
            priority_reason: inserted.reason,
            assigned_block_id: null,
            created_at: inserted.created_at
        };

        this.requests.unshift(record);
        await this.addNotification('New Maintenance Request', `${record.request_id} submitted by ${record.department}.`, 'MAINTENANCE', 'Normal');
        await this.logAudit(profileId, 'CREATE_REQUEST', 'maintenance_requests', inserted.id, null, insertPayload);
        return record;
    }

    async updateRequest(id, data) {
        const req = this.getRequestById(id);
        if (!req) return null;

        const updatePayload = {
            updated_at: new Date().toISOString()
        };
        if (data.work_description) updatePayload.work_description = data.work_description;
        if (data.location) updatePayload.location = data.location;
        if (data.duration_minutes) updatePayload.duration_minutes = data.duration_minutes;
        if (data.priority || data.priority_level) updatePayload.priority_level = data.priority || data.priority_level;
        if (data.status) updatePayload.status = data.status;
        if (data.reason || data.priority_reason) updatePayload.reason = data.reason || data.priority_reason;
        if (data.assigned_block_id !== undefined) updatePayload.assigned_block_id = data.assigned_block_id;
        if (data.block_id !== undefined) updatePayload.assigned_block_id = data.block_id;

        const { data: updated, error } = await this.supabase.from('maintenance_requests').update(updatePayload).eq('request_code', req.request_id).select().single();
        if (error) throw error;

        Object.assign(req, data, { updated_at: updated.updated_at });
        return req;
    }

    async deleteRequest(id) {
        const req = this.getRequestById(id);
        if (!req) return false;

        const { error } = await this.supabase.from('maintenance_requests').delete().eq('request_code', req.request_id);
        if (error) throw error;

        const idx = this.requests.findIndex(r => r.request_id === req.request_id);
        if (idx !== -1) this.requests.splice(idx, 1);
        return true;
    }

    async updateStatus(id, status) {
        return await this.updateRequest(id, { status });
    }

    // ==========================================
    // TRAIN TIMETABLE
    // ==========================================
    getAllTrains(filters = {}) {
        let res = [...this.trains];
        if (filters.corridor && filters.corridor !== 'All') {
            res = res.filter(t => t.corridor === filters.corridor);
        }
        if (filters.search) {
            const q = filters.search.toLowerCase();
            res = res.filter(t => t.train_number.toLowerCase().includes(q) || t.train_name.toLowerCase().includes(q));
        }
        return res;
    }

    getTrainById(id) {
        return this.trains.find(t => t.train_id === id || t.train_number === id || t.id === id);
    }

    async createTrain(data) {
        let corrCode = 'C2';
        if (data.corridor && data.corridor.includes('C1')) corrCode = 'C1';
        else if (data.corridor && data.corridor.includes('C3')) corrCode = 'C3';
        const corrId = this.corrMap[corrCode] || this.corrMap['C2'];

        const trainId = data.train_id || `TRN-${data.train_number}`;
        const insertPayload = {
            train_id: trainId,
            train_number: String(data.train_number),
            train_name: data.train_name || 'Express Train',
            train_type: data.train_type || 'Express',
            corridor_id: corrId,
            origin: data.origin || 'Origin',
            destination: data.destination || 'Destination',
            start_time: data.start_time,
            end_time: data.end_time,
            priority: data.priority || 'Normal',
            status: data.status || 'Active',
            delay_minutes: data.delay_minutes || 0
        };

        const { data: inserted, error } = await this.supabase.from('trains').insert([insertPayload]).select().single();
        if (error) throw error;

        const record = {
            id: inserted.id,
            train_id: inserted.train_id,
            train_number: inserted.train_number,
            train_name: inserted.train_name,
            train_type: inserted.train_type,
            corridor: `Corridor ${corrCode}`,
            corridor_id: corrId,
            origin: inserted.origin,
            destination: inserted.destination,
            start_time: inserted.start_time.slice(0, 5),
            end_time: inserted.end_time.slice(0, 5),
            priority: inserted.priority,
            status: inserted.status,
            delay_minutes: inserted.delay_minutes
        };

        this.trains.unshift(record);
        return record;
    }

    async updateTrain(id, data) {
        const train = this.getTrainById(id);
        if (!train) return null;

        const updatePayload = { updated_at: new Date().toISOString() };
        if (data.train_name) updatePayload.train_name = data.train_name;
        if (data.train_type) updatePayload.train_type = data.train_type;
        if (data.start_time) updatePayload.start_time = data.start_time;
        if (data.end_time) updatePayload.end_time = data.end_time;
        if (data.status) updatePayload.status = data.status;
        if (data.delay_minutes !== undefined) updatePayload.delay_minutes = data.delay_minutes;

        const { data: updated, error } = await this.supabase.from('trains').update(updatePayload).eq('train_id', train.train_id).select().single();
        if (error) throw error;

        Object.assign(train, data);
        return train;
    }

    async deleteTrain(id) {
        const train = this.getTrainById(id);
        if (!train) return false;

        const { error } = await this.supabase.from('trains').delete().eq('train_id', train.train_id);
        if (error) throw error;

        const idx = this.trains.findIndex(t => t.train_id === train.train_id);
        if (idx !== -1) this.trains.splice(idx, 1);
        return true;
    }

    // ==========================================
    // BLOCK WINDOWS
    // ==========================================
    getAllWindows(filters = {}) {
        let res = [...this.windows];
        if (filters.corridor && filters.corridor !== 'All') {
            res = res.filter(w => w.corridor === filters.corridor);
        }
        return res;
    }

    getWindowById(id) {
        return this.windows.find(w => w.window_id === id || w.block_code === id || w.id === id);
    }

    async createWindow(data) {
        let maxSuffix = 100;
        this.windows.forEach(w => {
            if (w.window_id && w.window_id.startsWith('B-')) {
                const num = parseInt(w.window_id.slice(2), 10);
                if (!isNaN(num) && num > maxSuffix) maxSuffix = num;
            }
        });
        const newBlockCode = data.window_id || data.block_code || `B-${maxSuffix + 1}`;

        let corrCode = 'C2';
        if (data.corridor && data.corridor.includes('C1')) corrCode = 'C1';
        else if (data.corridor && data.corridor.includes('C3')) corrCode = 'C3';
        const corrId = this.corrMap[corrCode] || this.corrMap['C2'];

        const insertPayload = {
            block_code: newBlockCode,
            corridor_id: corrId,
            start_time: data.start_time,
            end_time: data.end_time,
            duration_minutes: parseInt(data.duration_minutes) || 120,
            status: data.status || 'Available',
            occupied_minutes: 0,
            created_by: this.profMap['EMP001']
        };

        const { data: inserted, error } = await this.supabase.from('block_windows').insert([insertPayload]).select().single();
        if (error) throw error;

        const record = {
            id: inserted.id,
            window_id: inserted.block_code,
            block_code: inserted.block_code,
            corridor: `Corridor ${corrCode}`,
            corridor_id: corrId,
            start_time: inserted.start_time.slice(0, 5),
            end_time: inserted.end_time.slice(0, 5),
            duration_minutes: inserted.duration_minutes,
            status: inserted.status,
            occupied_minutes: 0,
            assigned_tasks: []
        };

        this.windows.unshift(record);
        return record;
    }

    async updateWindow(id, data) {
        const win = this.getWindowById(id);
        if (!win) return null;

        const updatePayload = { updated_at: new Date().toISOString() };
        if (data.status) updatePayload.status = data.status;
        if (data.occupied_minutes !== undefined) updatePayload.occupied_minutes = data.occupied_minutes;

        const { data: updated, error } = await this.supabase.from('block_windows').update(updatePayload).eq('block_code', win.window_id).select().single();
        if (error) throw error;

        Object.assign(win, data);
        return win;
    }

    async deleteWindow(id) {
        const win = this.getWindowById(id);
        if (!win) return false;

        const { error } = await this.supabase.from('block_windows').delete().eq('block_code', win.window_id);
        if (error) throw error;

        const idx = this.windows.findIndex(w => w.window_id === win.window_id);
        if (idx !== -1) this.windows.splice(idx, 1);
        return true;
    }

    // ==========================================
    // BLOCK ASSIGNMENTS ("FIND BLOCK" FEATURE)
    // ==========================================
    getAllBlockAssignments() {
        return [...this.blockAssignments];
    }

    getBlockAssignmentByRequestId(requestId) {
        return this.blockAssignments.find(a => a.request_id === requestId && a.status !== 'Cancelled');
    }

    getBlockAssignmentsByBlockId(blockId) {
        return this.blockAssignments.filter(a => a.block_id === blockId && a.status !== 'Cancelled');
    }

    async createBlockAssignment(data) {
        // Enforce uniqueness constraint: Prevent duplicate active assignment
        const existing = this.getBlockAssignmentByRequestId(data.request_id);
        if (existing) {
            throw new Error(`Duplicate assignment violation: Request ${data.request_id} is already assigned to block ${existing.block_id}.`);
        }

        const req = this.getRequestById(data.request_id);
        if (!req) throw new Error(`Request ${data.request_id} not found.`);
        const win = this.getWindowById(data.block_id);
        if (!win) throw new Error(`Block window ${data.block_id} not found.`);

        const profileId = this.profMap[data.employee_id] || this.profMap['EMP001'];

        const insertPayload = {
            request_id: req.id,
            block_window_id: win.id,
            assigned_by: profileId,
            assigned_start_time: new Date().toISOString(),
            assigned_end_time: new Date(Date.now() + (req.duration_minutes || 60) * 60000).toISOString(),
            status: data.status || 'Confirmed',
            assignment_reason: data.assignment_reason || 'Scheduled via Find Block optimization engine.',
            suitability_score: data.suitability_score || 90
        };

        const { data: inserted, error } = await this.supabase.from('block_assignments').insert([insertPayload]).select().single();
        if (error) throw error;

        // Also create scheduled task in scheduled_tasks
        const taskCode = `TSK-${req.request_id}-${win.window_id}`;
        await this.supabase.from('scheduled_tasks').upsert([{
            task_code: taskCode,
            request_id: req.id,
            block_assignment_id: inserted.id,
            corridor_id: req.corridor_id,
            department_id: req.department_id,
            scheduled_start: insertPayload.assigned_start_time,
            scheduled_end: insertPayload.assigned_end_time,
            duration_minutes: req.duration_minutes || 60,
            status: 'Scheduled'
        }], { onConflict: 'task_code' });

        // Update Request status to Scheduled
        await this.updateRequest(req.request_id, {
            status: 'Scheduled',
            assigned_block_id: win.window_id,
            block_id: win.window_id
        });

        // Update Block window occupancy
        const newOccupied = (win.occupied_minutes || 0) + (req.duration_minutes || 0);
        await this.updateWindow(win.window_id, { occupied_minutes: newOccupied });

        const record = {
            id: inserted.id,
            request_id: req.request_id,
            request_uuid: req.id,
            block_id: win.window_id,
            block_uuid: win.id,
            assigned_start_time: data.assigned_start_time || win.start_time,
            assigned_end_time: data.assigned_end_time || win.end_time,
            status: inserted.status,
            assigned_by: data.assigned_by || 'Railway Planner',
            employee_id: data.employee_id || 'EMP001',
            created_at: inserted.created_at
        };

        this.blockAssignments.push(record);
        win.assigned_tasks.push(record);

        await this.logAudit(profileId, 'ASSIGN_BLOCK', 'block_assignments', inserted.id, null, insertPayload);
        return record;
    }

    async deleteBlockAssignment(id) {
        const assign = this.blockAssignments.find(a => a.id === id || a.request_id === id);
        if (!assign) return false;

        const { error } = await this.supabase.from('block_assignments').delete().eq('id', assign.id);
        if (error) throw error;

        // Reset Request status to Pending
        await this.updateRequest(assign.request_id, {
            status: 'Pending',
            assigned_block_id: null,
            block_id: null
        });

        // Decrement window occupied minutes
        const win = this.getWindowById(assign.block_id);
        if (win) {
            const req = this.getRequestById(assign.request_id);
            const dur = req ? req.duration_minutes : 0;
            const newOccupied = Math.max(0, (win.occupied_minutes || 0) - dur);
            await this.updateWindow(win.window_id, { occupied_minutes: newOccupied });
            const taskIdx = win.assigned_tasks.findIndex(t => t.request_id === assign.request_id);
            if (taskIdx !== -1) win.assigned_tasks.splice(taskIdx, 1);
        }

        const idx = this.blockAssignments.findIndex(a => a.id === assign.id);
        if (idx !== -1) this.blockAssignments.splice(idx, 1);
        return true;
    }

    // ==========================================
    // CONFLICTS
    // ==========================================
    getConflicts() {
        return this.conflicts;
    }

    async resolveConflict(id, resolution) {
        const conf = this.conflicts.find(c => c.id === id || c.conflict_id === id || c.conflict_code === id);
        if (!conf) return null;

        const { data: updated, error } = await this.supabase.from('conflicts').update({
            status: 'Resolved',
            resolution: resolution || 'Resolved by human planner',
            resolved_at: new Date().toISOString()
        }).eq('conflict_code', conf.conflict_code).select().single();

        if (error) throw error;
        conf.status = 'Resolved';
        conf.resolution = resolution;
        return conf;
    }

    // ==========================================
    // BLOCK PLANNING
    // ==========================================
    getBlockPlans() {
        return this.blockPlans;
    }

    getBlockPlanById(id) {
        return this.blockPlans.find(p => p.id === id || p.plan_id === id);
    }

    async createBlockPlan(plan) {
        let corrCode = 'C2';
        if (plan.corridor && plan.corridor.includes('C1')) corrCode = 'C1';
        else if (plan.corridor && plan.corridor.includes('C3')) corrCode = 'C3';
        const corrId = this.corrMap[corrCode] || this.corrMap['C2'];

        const insertPayload = {
            plan_code: plan.plan_id || `PLAN-${Date.now()}`,
            name: plan.name || `Plan for Corridor ${corrCode}`,
            corridor_id: corrId,
            status: plan.status || 'Draft',
            total_tasks: plan.total_tasks || 0,
            total_duration_minutes: plan.total_duration_minutes || 0
        };

        const { data: inserted, error } = await this.supabase.from('block_plans').insert([insertPayload]).select().single();
        if (error) throw error;

        const record = {
            id: inserted.id,
            plan_id: inserted.plan_code,
            name: inserted.name,
            corridor: `Corridor ${corrCode}`,
            status: inserted.status,
            total_tasks: inserted.total_tasks,
            total_duration: inserted.total_duration_minutes,
            scheduled_tasks: plan.scheduled_tasks || [],
            created_at: inserted.created_at
        };

        this.blockPlans.unshift(record);
        return record;
    }

    // ==========================================
    // NOTIFICATIONS
    // ==========================================
    getNotifications() {
        return this.notifications;
    }

    async addNotification(title, message, type = 'INFO', severity = 'Normal') {
        const profileId = this.profMap['EMP001'];
        const insertPayload = {
            user_id: profileId,
            notification_type: type,
            title,
            message,
            severity,
            is_read: false
        };

        const { data: inserted, error } = await this.supabase.from('notifications').insert([insertPayload]).select().single();
        if (!error && inserted) {
            this.notifications.unshift({
                id: inserted.id,
                title: inserted.title,
                message: inserted.message,
                type: inserted.notification_type,
                severity: inserted.severity,
                is_read: false,
                time: 'Just now'
            });
        }
    }

    // ==========================================
    // AUDIT LOGGING
    // ==========================================
    async logAudit(userId, action, entityType, entityId, oldValues, newValues) {
        try {
            await this.supabase.from('audit_logs').insert([{
                user_id: userId || this.profMap['EMP001'],
                action,
                entity_type: entityType,
                entity_id: entityId,
                old_values: oldValues,
                new_values: newValues
            }]);
        } catch (err) {
            console.error('Failed to write audit log:', err.message);
        }
    }

    // ==========================================
    // DASHBOARD SUMMARY METRICS
    // ==========================================
    getSummary() {
        return {
            totalRequests: this.requests.length,
            pendingMaintenance: this.requests.filter(r => r.status === 'Pending').length,
            highPriority: this.requests.filter(r => r.priority === 'High' || r.priority === 'Critical').length,
            scheduledTasks: this.requests.filter(r => r.status === 'Scheduled' || r.status === 'Planned').length,
            availableBlocks: this.windows.filter(w => w.status === 'Available').length,
            activeConflicts: this.conflicts.filter(c => c.status === 'Active').length
        };
    }
}

module.exports = new DatabaseService();
