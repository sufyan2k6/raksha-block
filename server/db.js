/* ==========================================================================
   RAKSHA BLOCK — COMPLETE DATABASE LAYER (PostgreSQL + Persistent Storage)
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const STORAGE_FILE = path.join(__dirname, '..', 'data_store.json');

// Users Seed
const SEED_USERS = [
    { employeeId: 'EMP001', name: 'Rohan Gupta', role: 'Railway Planner', department: 'Operations', pass: 'planner123' },
    { employeeId: 'EMP002', name: 'Amit Sharma', role: 'Senior Section Engineer', department: 'P-Way', pass: 'pway123' },
    { employeeId: 'EMP003', name: 'Priya Verma', role: 'Signal Inspector', department: 'S&T', pass: 'st123' },
    { employeeId: 'EMP004', name: 'Suresh Kumar', role: 'TRD Electrical Engineer', department: 'TRD', pass: 'trd123' },
    { employeeId: 'EMP005', name: 'Ananya Roy', role: 'Traffic Controller', department: 'Operations', pass: 'traffic123' },
    { employeeId: 'planner@rakshablock.local', name: 'Rohan Gupta', role: 'Railway Planner', department: 'Operations', pass: 'planner123' }
];

// Initial Seed Maintenance Requests
const SEED_REQUESTS = [
    {
        id: 1,
        request_id: 'M-101',
        employee_id: 'EMP001',
        submitted_by: 'Rohan Gupta',
        department: 'P-Way',
        asset: 'Track Rail',
        maintenance_type: 'Rail Replacement',
        location: 'KM 142/12 to 148/04',
        corridor: 'Corridor C2',
        duration_minutes: 150,
        urgency: 'High',
        asset_risk: 'High',
        due_date: '2026-09-22',
        traffic_impact: 'High',
        description: 'Urgent rail replacement required on Down Main line.',
        work_description: 'Rail Replacement on Down Main Line',
        priority: 'High',
        priority_reason: 'Assigned High priority due to elevated urgency, high asset risk, and significant traffic impact.',
        reason: 'Assigned High priority due to elevated urgency, high asset risk, and significant traffic impact.',
        status: 'Planned',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
        id: 2,
        request_id: 'M-102',
        employee_id: 'EMP003',
        submitted_by: 'Priya Verma',
        department: 'S&T',
        asset: 'Axle Counter',
        maintenance_type: 'Calibration & Test',
        location: 'Junction Section A2',
        corridor: 'Corridor C1',
        duration_minutes: 90,
        urgency: 'Medium',
        asset_risk: 'Medium',
        due_date: '2026-09-25',
        traffic_impact: 'Medium',
        description: 'Routine quarterly calibration of digital axle counters.',
        work_description: 'Digital Axle Counter Recalibration',
        priority: 'Medium',
        priority_reason: 'Assigned Medium priority based on moderate operational risk parameters.',
        reason: 'Assigned Medium priority based on moderate operational risk parameters.',
        status: 'Pending',
        created_at: new Date(Date.now() - 86400000 * 1.5).toISOString()
    },
    {
        id: 3,
        request_id: 'M-103',
        employee_id: 'EMP004',
        submitted_by: 'Suresh Kumar',
        department: 'TRD',
        asset: 'OHE Cable',
        maintenance_type: 'Cantilever Inspection',
        location: 'Line 2 Chord Line',
        corridor: 'Corridor C3',
        duration_minutes: 120,
        urgency: 'Low',
        asset_risk: 'Low',
        due_date: '2026-09-30',
        traffic_impact: 'Low',
        description: 'Visual inspection of overhead contact wire tensioners.',
        work_description: 'Overhead Contact Wire Tensioner Inspection',
        priority: 'Low',
        priority_reason: 'Standard low priority based on routine maintenance risk parameters.',
        reason: 'Standard low priority based on routine maintenance risk parameters.',
        status: 'Pending',
        created_at: new Date(Date.now() - 86400000 * 1).toISOString()
    },
    {
        id: 4,
        request_id: 'M-104',
        employee_id: 'EMP002',
        submitted_by: 'Amit Sharma',
        department: 'P-Way',
        asset: 'Track Bed & Ballast',
        maintenance_type: 'Deep Screening & Tamping',
        location: 'KM 88/04 to 92/10',
        corridor: 'Corridor C2',
        duration_minutes: 60,
        urgency: 'Critical',
        asset_risk: 'Critical',
        due_date: '2026-09-20',
        traffic_impact: 'High',
        description: 'Critical track geometry correction to remove temporary speed restriction.',
        work_description: 'Track Tamping & Geometry Realignment',
        priority: 'Critical',
        priority_reason: 'Assigned Critical priority due to elevated urgency, high asset risk, and approaching due date.',
        reason: 'Assigned Critical priority due to elevated urgency, high asset risk, and approaching due date.',
        status: 'Pending',
        created_at: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    {
        id: 5,
        request_id: 'M-105',
        employee_id: 'EMP003',
        submitted_by: 'Priya Verma',
        department: 'S&T',
        asset: 'Interlocking Panel',
        maintenance_type: 'Relay Integrity Audit',
        location: 'Junction Cabin Block A',
        corridor: 'Corridor C2',
        duration_minutes: 45,
        urgency: 'High',
        asset_risk: 'High',
        due_date: '2026-09-21',
        traffic_impact: 'Medium',
        description: 'Joint testing of electronic interlocking panel communication lines.',
        work_description: 'Electronic Interlocking Panel Audit',
        priority: 'High',
        priority_reason: 'Assigned High priority due to elevated urgency and high asset risk.',
        reason: 'Assigned High priority due to elevated urgency and high asset risk.',
        status: 'Planned',
        created_at: new Date(Date.now() - 3600000 * 3).toISOString()
    },
    {
        id: 6,
        request_id: 'M-118',
        employee_id: 'EMP003',
        submitted_by: 'Priya Verma',
        department: 'S&T',
        asset: 'Signal Lamp Assembly',
        maintenance_type: 'LED Aspect Replacement',
        location: 'KM 90/02 Down Signal',
        corridor: 'Corridor C2',
        duration_minutes: 45,
        urgency: 'High',
        asset_risk: 'Medium',
        due_date: '2026-09-21',
        traffic_impact: 'Low',
        description: 'Replacing LED signal aspect bulb on Down Main line.',
        work_description: 'LED Signal Aspect Replacement',
        priority: 'High',
        priority_reason: 'Assigned High priority due to elevated urgency and signal reliability.',
        reason: 'Assigned High priority due to elevated urgency and signal reliability.',
        status: 'Pending',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
        id: 7,
        request_id: 'M-106',
        employee_id: 'EMP004',
        submitted_by: 'Suresh Kumar',
        department: 'TRD',
        asset: 'OHE Cantilever',
        maintenance_type: 'Cantilever Height Adjustment',
        location: 'KM 91/10 to 93/00',
        corridor: 'Corridor C2',
        duration_minutes: 60,
        urgency: 'High',
        asset_risk: 'High',
        due_date: '2026-09-22',
        traffic_impact: 'Medium',
        description: 'Traction overhead line dropper adjustment and cantilever realignment.',
        work_description: 'OHE Dropper & Cantilever Realignment',
        priority: 'High',
        priority_reason: 'Assigned High priority due to contact wire wear and speed restriction mitigation.',
        reason: 'Assigned High priority due to contact wire wear and speed restriction mitigation.',
        status: 'Pending',
        created_at: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
        id: 8,
        request_id: 'M-107',
        employee_id: 'EMP002',
        submitted_by: 'Amit Sharma',
        department: 'P-Way',
        asset: 'Fishplates & Joints',
        maintenance_type: 'Joint Bolt Tightening & Greasing',
        location: 'Section Yard KM 34/10',
        corridor: 'Corridor C1',
        duration_minutes: 60,
        urgency: 'Medium',
        asset_risk: 'Medium',
        due_date: '2026-09-26',
        traffic_impact: 'Low',
        description: 'Tightening and lubrication of insulated rail joints.',
        work_description: 'Insulated Rail Joint Lubrication',
        priority: 'Medium',
        priority_reason: 'Assigned Medium priority based on preventive maintenance scheduling.',
        reason: 'Assigned Medium priority based on preventive maintenance scheduling.',
        status: 'Pending',
        created_at: new Date(Date.now() - 86400000 * 3).toISOString()
    },
    {
        id: 9,
        request_id: 'M-108',
        employee_id: 'EMP003',
        submitted_by: 'Priya Verma',
        department: 'S&T',
        asset: 'Point Machine',
        maintenance_type: 'Obstruction Test & Motor Service',
        location: 'Yard Crossover 14B',
        corridor: 'Corridor C1',
        duration_minutes: 45,
        urgency: 'High',
        asset_risk: 'High',
        due_date: '2026-09-22',
        traffic_impact: 'Medium',
        description: 'Point machine motor cleaning, friction clutch testing and obstruction test.',
        work_description: 'Crossover Point Machine Overhaul',
        priority: 'High',
        priority_reason: 'Assigned High priority to prevent switch failure on passenger loop.',
        reason: 'Assigned High priority to prevent switch failure on passenger loop.',
        status: 'Pending',
        created_at: new Date(Date.now() - 3600000 * 6).toISOString()
    },
    {
        id: 10,
        request_id: 'M-109',
        employee_id: 'EMP002',
        submitted_by: 'Amit Sharma',
        department: 'P-Way',
        asset: 'Rail Welds',
        maintenance_type: 'Ultrasonic Flaw Detection (USFD)',
        location: 'KM 110/00 to 116/00',
        corridor: 'Corridor C3',
        duration_minutes: 90,
        urgency: 'High',
        asset_risk: 'High',
        due_date: '2026-09-23',
        traffic_impact: 'High',
        description: 'USFD testing of thermit rail weld seams on UP Freight line.',
        work_description: 'USFD Testing of Thermit Welds',
        priority: 'High',
        priority_reason: 'Assigned High priority to detect internal rail micro-fractures.',
        reason: 'Assigned High priority to detect internal rail micro-fractures.',
        status: 'Pending',
        created_at: new Date(Date.now() - 86400000 * 1.2).toISOString()
    },
    {
        id: 11,
        request_id: 'M-110',
        employee_id: 'EMP003',
        submitted_by: 'Priya Verma',
        department: 'S&T',
        asset: 'Track Circuit',
        maintenance_type: 'Shunt Sensitivity Test',
        location: 'Section TC 45',
        corridor: 'Corridor C3',
        duration_minutes: 45,
        urgency: 'Medium',
        asset_risk: 'Medium',
        due_date: '2026-09-28',
        traffic_impact: 'Low',
        description: 'Verify drop shunt resistance and battery bank charge for DC track circuits.',
        work_description: 'DC Track Circuit Shunt Sensitivity Test',
        priority: 'Medium',
        priority_reason: 'Assigned Medium priority for quarterly signal compliance.',
        reason: 'Assigned Medium priority for quarterly signal compliance.',
        status: 'Pending',
        created_at: new Date(Date.now() - 86400000 * 2.5).toISOString()
    },
    {
        id: 12,
        request_id: 'M-111',
        employee_id: 'EMP004',
        submitted_by: 'Suresh Kumar',
        department: 'TRD',
        asset: 'Traction Substation',
        maintenance_type: 'Transformer Oil Filtration',
        location: 'Substation TSS-02',
        corridor: 'Corridor C1',
        duration_minutes: 60,
        urgency: 'Low',
        asset_risk: 'Low',
        due_date: '2026-10-02',
        traffic_impact: 'Low',
        description: 'Dielectric breakdown testing of 25kV traction transformer oil.',
        work_description: 'Traction Transformer Oil Filtration',
        priority: 'Low',
        priority_reason: 'Assigned Low priority for planned scheduled maintenance.',
        reason: 'Assigned Low priority for planned scheduled maintenance.',
        status: 'Pending',
        created_at: new Date(Date.now() - 86400000 * 4).toISOString()
    }
];

// Initial Seed Trains
const SEED_TRAINS = [
    { id: 1, train_number: '12301', train_name: 'Howrah Rajdhani Express', train_type: 'Superfast Express', corridor: 'Corridor C2', origin: 'New Delhi', destination: 'Howrah', start_time: '06:30', end_time: '08:45', status: 'Running On Time' },
    { id: 2, train_number: '12019', train_name: 'Shatabdi Express', train_type: 'Express', corridor: 'Corridor C2', origin: 'Howrah', destination: 'Ranchi', start_time: '11:15', end_time: '13:00', status: 'Running On Time' },
    { id: 3, train_number: 'T310', train_name: 'BOXN Freight Rake', train_type: 'Freight', corridor: 'Corridor C2', origin: 'Andal Yard', destination: 'Howrah Goods', start_time: '14:30', end_time: '17:15', status: 'Scheduled' },
    { id: 4, train_number: '22302', train_name: 'Vande Bharat Express', train_type: 'Superfast Express', corridor: 'Corridor C1', origin: 'Howrah', destination: 'New Jalpaiguri', start_time: '17:30', end_time: '20:15', status: 'Scheduled' },
    { id: 5, train_number: 'T508', train_name: 'Coal Container Special', train_type: 'Freight', corridor: 'Corridor C3', origin: 'Dankuni DFC', destination: 'Haldia Port', start_time: '18:45', end_time: '22:00', status: 'Scheduled' },
    { id: 6, train_number: '37211', train_name: 'Bandel Local EMU', train_type: 'Local EMU', corridor: 'Corridor C1', origin: 'Howrah', destination: 'Bandel', start_time: '07:00', end_time: '08:30', status: 'Running On Time' },
    { id: 7, train_number: 'T703', train_name: 'Steel Coil Freight', train_type: 'Freight', corridor: 'Corridor C1', origin: 'Tata Yard', destination: 'Shalimar', start_time: '12:00', end_time: '14:30', status: 'Scheduled' },
    { id: 8, train_number: '13105', train_name: 'Sealdah Express', train_type: 'Express', corridor: 'Corridor C3', origin: 'Sealdah', destination: 'Ballia', start_time: '08:00', end_time: '10:30', status: 'Running On Time' }
];

// Initial Seed Block Windows
const SEED_WINDOWS = [
    { id: 1, window_id: 'B-101', corridor: 'Corridor C1', date: '2026-09-21', start_time: '09:30', end_time: '11:00', duration_minutes: 90, status: 'Available' },
    { id: 2, window_id: 'B-102', corridor: 'Corridor C2', date: '2026-09-21', start_time: '14:00', end_time: '16:30', duration_minutes: 150, status: 'Available' },
    { id: 3, window_id: 'B-103', corridor: 'Corridor C3', date: '2026-09-21', start_time: '19:00', end_time: '21:30', duration_minutes: 150, status: 'Available' },
    { id: 4, window_id: 'B-104', corridor: 'Corridor C2', date: '2026-09-21', start_time: '18:30', end_time: '21:00', duration_minutes: 150, status: 'Available' },
    { id: 5, window_id: 'B-105', corridor: 'Corridor C1', date: '2026-09-21', start_time: '15:00', end_time: '17:00', duration_minutes: 120, status: 'Available' },
    { id: 6, window_id: 'B-106', corridor: 'Corridor C3', date: '2026-09-21', start_time: '11:00', end_time: '13:00', duration_minutes: 120, status: 'Available' }
];

class DatabaseService {
    constructor() {
        this.users = [...SEED_USERS];
        this.requests = [...SEED_REQUESTS];
        this.trains = [...SEED_TRAINS];
        this.windows = [...SEED_WINDOWS];
        this.conflicts = [];
        this.blockPlans = [];
        this.blockAssignments = [];
        this.notifications = [
            { id: 1, title: 'System Initialized', message: 'Raksha Block operational database connected.', time: 'Just now' },
            { id: 2, title: 'New Conflict Detected', message: 'Train T310 overlaps with proposed window B-102.', time: '10 min ago' },
            { id: 3, title: 'High Priority Work Order', message: 'M-104 track maintenance pending review.', time: '25 min ago' }
        ];

        this.nextReqId = 119;
        this.nextTrainId = 6;
        this.nextWindowId = 4;

        this.initStore();
    }

    initStore() {
        if (fs.existsSync(STORAGE_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
                if (data.requests) this.requests = data.requests;
                if (data.trains) this.trains = data.trains;
                if (data.windows) this.windows = data.windows;
                if (data.conflicts) this.conflicts = data.conflicts;
                if (data.blockPlans) this.blockPlans = data.blockPlans;
                if (data.blockAssignments) this.blockAssignments = data.blockAssignments;
                if (data.notifications) this.notifications = data.notifications;
                if (data.nextReqId) this.nextReqId = data.nextReqId;
                return;
            } catch (err) {
                console.error('Storage parse error, fallback to defaults:', err);
            }
        }
        this.saveStore();
    }

    saveStore() {
        try {
            fs.writeFileSync(STORAGE_FILE, JSON.stringify({
                requests: this.requests,
                trains: this.trains,
                windows: this.windows,
                conflicts: this.conflicts,
                blockPlans: this.blockPlans,
                blockAssignments: this.blockAssignments,
                notifications: this.notifications,
                nextReqId: this.nextReqId
            }, null, 2), 'utf8');
        } catch (err) {
            console.error('Save store error:', err);
        }
    }

    // USERS
    getUsers() { return this.users; }
    getUserById(empId) {
        return this.users.find(u => u.employeeId.toLowerCase() === empId.toLowerCase());
    }

    // REQUESTS
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
                (r.asset && r.asset.toLowerCase().includes(q)) ||
                (r.location && r.location.toLowerCase().includes(q)) ||
                (r.department && r.department.toLowerCase().includes(q))
            );
        }
        return res;
    }

    getRequestById(id) {
        return this.requests.find(r => r.request_id === id || r.id == id);
    }

    createRequest(data) {
        let maxSuffix = 100;
        this.requests.forEach(r => {
            if (r.request_id && r.request_id.startsWith('M-')) {
                const num = parseInt(r.request_id.slice(2), 10);
                if (!isNaN(num) && num > maxSuffix) maxSuffix = num;
            }
        });
        const newReqId = data.request_id || `M-${maxSuffix + 1}`;

        if (this.requests.some(r => r.request_id === newReqId)) {
            throw new Error(`Uniqueness constraint violation: Request ID ${newReqId} already exists.`);
        }

        const maxId = this.requests.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0);
        const record = {
            id: maxId + 1,
            request_id: newReqId,
            ...data,
            status: data.status || 'Pending',
            created_at: new Date().toISOString()
        };
        this.requests.unshift(record);
        this.addNotification('New Maintenance Request', `${record.request_id} (${record.asset || record.work_description}) submitted by ${record.department}.`);
        this.saveStore();
        return record;
    }

    updateRequest(id, data) {
        const idx = this.requests.findIndex(r => r.request_id === id || r.id == id);
        if (idx === -1) return null;
        this.requests[idx] = { ...this.requests[idx], ...data, updated_at: new Date().toISOString() };
        this.saveStore();
        return this.requests[idx];
    }

    deleteRequest(id) {
        const idx = this.requests.findIndex(r => r.request_id === id || r.id == id);
        if (idx === -1) return false;
        this.requests.splice(idx, 1);
        this.saveStore();
        return true;
    }

    updateStatus(id, status) {
        const r = this.getRequestById(id);
        if (!r) return null;
        r.status = status;
        r.updated_at = new Date().toISOString();
        this.saveStore();
        return r;
    }

    // TRAINS
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

    createTrain(data) {
        if (data.train_number && this.trains.some(t => t.train_number.toLowerCase() === String(data.train_number).toLowerCase())) {
            throw new Error(`Uniqueness constraint violation: Train number ${data.train_number} already exists in timetable.`);
        }
        const maxId = this.trains.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0);
        const record = { id: maxId + 1, ...data };
        this.trains.unshift(record);
        this.saveStore();
        return record;
    }

    updateTrain(id, data) {
        const idx = this.trains.findIndex(t => t.id == id || t.train_number === id);
        if (idx === -1) return null;
        this.trains[idx] = { ...this.trains[idx], ...data, updated_at: new Date().toISOString() };
        this.saveStore();
        return this.trains[idx];
    }

    deleteTrain(id) {
        const idx = this.trains.findIndex(t => t.id == id || t.train_number === id);
        if (idx === -1) return false;
        this.trains.splice(idx, 1);
        this.saveStore();
        return true;
    }

    // WINDOWS
    getAllWindows(filters = {}) {
        let res = [...this.windows];
        if (filters.corridor && filters.corridor !== 'All') {
            res = res.filter(w => w.corridor === filters.corridor);
        }
        return res;
    }

    createWindow(data) {
        let maxSuffix = 100;
        this.windows.forEach(w => {
            if (w.window_id && w.window_id.startsWith('B-')) {
                const num = parseInt(w.window_id.slice(2), 10);
                if (!isNaN(num) && num > maxSuffix) maxSuffix = num;
            }
        });
        const newWindowId = data.window_id || `B-${maxSuffix + 1}`;

        if (this.windows.some(w => w.window_id === newWindowId)) {
            throw new Error(`Uniqueness constraint violation: Block window ID ${newWindowId} already exists.`);
        }

        const maxId = this.windows.reduce((max, w) => Math.max(max, Number(w.id) || 0), 0);
        const record = { id: maxId + 1, window_id: newWindowId, ...data };
        this.windows.unshift(record);
        this.saveStore();
        return record;
    }

    updateWindow(id, data) {
        const idx = this.windows.findIndex(w => w.id == id || w.window_id === id);
        if (idx === -1) return null;
        this.windows[idx] = { ...this.windows[idx], ...data, updated_at: new Date().toISOString() };
        this.saveStore();
        return this.windows[idx];
    }

    deleteWindow(id) {
        const idx = this.windows.findIndex(w => w.id == id || w.window_id === id);
        if (idx === -1) return false;
        this.windows.splice(idx, 1);
        this.saveStore();
        return true;
    }

    // BLOCK ASSIGNMENTS (Relationship table)
    getAllBlockAssignments() {
        return [...this.blockAssignments];
    }

    getBlockAssignmentByRequestId(requestId) {
        return this.blockAssignments.find(a => a.request_id === requestId && a.status !== 'Cancelled');
    }

    getBlockAssignmentsByBlockId(blockId) {
        return this.blockAssignments.filter(a => a.block_id === blockId && a.status !== 'Cancelled');
    }

    createBlockAssignment(data) {
        // Enforce uniqueness constraint: Prevent duplicate active assignment
        const existing = this.blockAssignments.find(a => a.request_id === data.request_id && a.status !== 'Cancelled');
        if (existing) {
            throw new Error(`Duplicate assignment violation: Request ${data.request_id} is already assigned to block ${existing.block_id}.`);
        }

        const maxId = this.blockAssignments.reduce((max, a) => Math.max(max, Number(a.id) || 0), 0);
        const record = {
            id: maxId + 1,
            request_id: data.request_id,
            block_id: data.block_id,
            assigned_start_time: data.assigned_start_time,
            assigned_end_time: data.assigned_end_time,
            status: data.status || 'Confirmed',
            assigned_by: data.assigned_by || 'Railway Planner',
            employee_id: data.employee_id || 'EMP001',
            created_at: new Date().toISOString()
        };

        this.blockAssignments.push(record);
        this.saveStore();
        return record;
    }

    deleteBlockAssignment(id) {
        const idx = this.blockAssignments.findIndex(a => a.id == id || a.request_id === id);
        if (idx === -1) return false;
        this.blockAssignments.splice(idx, 1);
        this.saveStore();
        return true;
    }

    // NOTIFICATIONS
    addNotification(title, message) {
        this.notifications.unshift({
            id: this.notifications.length + 1,
            title,
            message,
            time: 'Just now'
        });
        this.saveStore();
    }

    getNotifications() {
        return this.notifications;
    }

    // DASHBOARD SUMMARY METRICS
    getSummary() {
        return {
            totalRequests: this.requests.length,
            pendingMaintenance: this.requests.filter(r => r.status === 'Pending').length,
            highPriority: this.requests.filter(r => r.priority === 'High' || r.priority === 'Critical').length,
            availableBlocks: this.windows.filter(w => w.status === 'Available').length,
            activeConflicts: 2 // calculated dynamically in conflictEngine
        };
    }
}

module.exports = new DatabaseService();
