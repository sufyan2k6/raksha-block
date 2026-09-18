require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabase } = require('./supabaseClient');

async function seedRelationalDatabase() {
    if (!supabase) {
        console.error('Supabase client not initialized.');
        return;
    }

    console.log('🚀 SEEDING NORMALIZED RAKSHA BLOCK DATABASE INTO SUPABASE POSTGRESQL...');

    // 1. DEPARTMENTS
    console.log('--- 1. Departments ---');
    const departmentsData = [
        { code: 'P-Way', name: 'Permanent Way (Civil / Track)', description: 'Track superstructure, rail alignment, tamping, switches & crossings.', is_active: true },
        { code: 'S&T', name: 'Signal & Telecommunication', description: 'Interlocking, track circuits, axle counters, signals, point machines.', is_active: true },
        { code: 'TRD', name: 'Traction Distribution (Electrical OHE)', description: '25kV AC overhead lines, cantilevers, substations, droppers.', is_active: true },
        { code: 'Operations', name: 'Traffic & Operational Planning', description: 'Train movement management, block planning, dispatching.', is_active: true }
    ];

    const { data: depts, error: deptErr } = await supabase.from('departments').upsert(departmentsData, { onConflict: 'code' }).select();
    if (deptErr) throw new Error('Failed to seed departments: ' + deptErr.message);
    console.log(`✓ Seeded ${depts.length} departments`);

    const deptMap = {};
    depts.forEach(d => {
        deptMap[d.code] = d.id;
        deptMap[d.code.toLowerCase()] = d.id;
    });

    // 2. CORRIDORS
    console.log('--- 2. Corridors ---');
    const corridorsData = [
        { code: 'C1', name: 'Corridor C1 (Serampore)', description: 'Howrah - Bardhaman Main Line (High Traffic Passenger & EMU)', division: 'Howrah', is_active: true },
        { code: 'C2', name: 'Corridor C2 (Bardhaman)', description: 'Howrah - Bardhaman Chord Line (Heavy Freight & Express)', division: 'Howrah', is_active: true },
        { code: 'C3', name: 'Corridor C3 (Naihati)', description: 'Sealdah - Ranaghat DFC Chord (Mixed Suburban & Heavy Freight)', division: 'Sealdah', is_active: true }
    ];

    const { data: corridors, error: corrErr } = await supabase.from('corridors').upsert(corridorsData, { onConflict: 'code' }).select();
    if (corrErr) throw new Error('Failed to seed corridors: ' + corrErr.message);
    console.log(`✓ Seeded ${corridors.length} corridors`);

    const corrMap = {};
    corridors.forEach(c => {
        corrMap[c.code] = c.id;
        corrMap[`Corridor ${c.code}`] = c.id;
        corrMap[c.name] = c.id;
    });

    // 3. PROFILES
    console.log('--- 3. User Profiles ---');
    const profilesData = [
        {
            employee_id: 'EMP001',
            full_name: 'Rohan Gupta',
            email: 'planner@rakshablock.local',
            role: 'Railway Planner',
            department_id: deptMap['Operations'],
            division: 'Howrah',
            section: 'Traffic Planning HQ',
            password_hash: 'planner123',
            is_active: true
        },
        {
            employee_id: 'EMP002',
            full_name: 'Amit Sharma',
            email: 'amit.pway@rakshablock.local',
            role: 'Senior Section Engineer',
            department_id: deptMap['P-Way'],
            division: 'Howrah',
            section: 'Bardhaman North P-Way',
            password_hash: 'pway123',
            is_active: true
        },
        {
            employee_id: 'EMP003',
            full_name: 'Priya Verma',
            email: 'priya.st@rakshablock.local',
            role: 'Signal Inspector',
            department_id: deptMap['S&T'],
            division: 'Howrah',
            section: 'Bandel S&T Depot',
            password_hash: 'st123',
            is_active: true
        },
        {
            employee_id: 'EMP004',
            full_name: 'Suresh Kumar',
            email: 'suresh.trd@rakshablock.local',
            role: 'TRD Electrical Engineer',
            department_id: deptMap['TRD'],
            division: 'Howrah',
            section: 'Dankuni TRD Substation',
            password_hash: 'trd123',
            is_active: true
        },
        {
            employee_id: 'EMP005',
            full_name: 'Ananya Roy',
            email: 'ananya.ops@rakshablock.local',
            role: 'Traffic Controller',
            department_id: deptMap['Operations'],
            division: 'Howrah',
            section: 'Central Control Office',
            password_hash: 'traffic123',
            is_active: true
        }
    ];

    const { data: profiles, error: profErr } = await supabase.from('profiles').upsert(profilesData, { onConflict: 'employee_id' }).select();
    if (profErr) throw new Error('Failed to seed profiles: ' + profErr.message);
    console.log(`✓ Seeded ${profiles.length} user profiles`);

    const profMap = {};
    profiles.forEach(p => {
        profMap[p.employee_id] = p.id;
    });

    // 4. USER PREFERENCES
    console.log('--- 4. User Preferences ---');
    const prefsData = profiles.map(p => ({
        user_id: p.id,
        theme: 'light',
        notifications_enabled: true,
        default_corridor_id: corrMap['C2']
    }));
    await supabase.from('user_preferences').upsert(prefsData, { onConflict: 'user_id' });
    console.log(`✓ Seeded user preferences for ${prefsData.length} users`);

    // 5. ASSETS
    console.log('--- 5. Railway Assets ---');
    const assetsData = [
        { asset_code: 'AST-TRK-01', asset_name: 'Track Rail & Sleepers', asset_type: 'Track Superstructure', corridor_id: corrMap['C2'], location: 'KM 142/12 to 148/04', km_marker: '142/12', department_id: deptMap['P-Way'], risk_level: 'High' },
        { asset_code: 'AST-AXL-02', asset_name: 'Digital Axle Counter DAC-01', asset_type: 'Signal Detection', corridor_id: corrMap['C1'], location: 'Junction Section A2', km_marker: '24/10', department_id: deptMap['S&T'], risk_level: 'Medium' },
        { asset_code: 'AST-OHE-03', asset_name: 'Overhead Contact Wire Tensioner', asset_type: '25kV Traction Line', corridor_id: corrMap['C3'], location: 'Line 2 Chord Line', km_marker: '36/08', department_id: deptMap['TRD'], risk_level: 'Low' },
        { asset_code: 'AST-TRK-04', asset_name: 'Deep Ballast Bed & Rails', asset_type: 'Track Geometry', corridor_id: corrMap['C2'], location: 'KM 88/04 to 92/10', km_marker: '88/04', department_id: deptMap['P-Way'], risk_level: 'Critical' },
        { asset_code: 'AST-SIG-05', asset_name: 'Electronic Interlocking Panel EI-B', asset_type: 'Signal Cabin Interlocking', corridor_id: corrMap['C2'], location: 'Junction Cabin Block A', km_marker: '91/00', department_id: deptMap['S&T'], risk_level: 'High' },
        { asset_code: 'AST-SIG-06', asset_name: 'Down Main LED Signal Aspect', asset_type: 'Visual Color Signal', corridor_id: corrMap['C2'], location: 'KM 90/02 Down Signal', km_marker: '90/02', department_id: deptMap['S&T'], risk_level: 'High' },
        { asset_code: 'AST-OHE-07', asset_name: 'OHE Dropper & Cantilever Mast', asset_type: 'Traction Subgrade', corridor_id: corrMap['C2'], location: 'KM 91/10 to 93/00', km_marker: '91/10', department_id: deptMap['TRD'], risk_level: 'High' },
        { asset_code: 'AST-TRK-08', asset_name: 'Points & High-Speed Turnout', asset_type: 'Track Switch', corridor_id: corrMap['C1'], location: 'KM 22/08 Points Crossover', km_marker: '22/08', department_id: deptMap['P-Way'], risk_level: 'High' },
        { asset_code: 'AST-TRK-09', asset_name: 'Prestressed Concrete Sleepers', asset_type: 'Track Bed', corridor_id: corrMap['C3'], location: 'KM 54/15 to 58/00', km_marker: '54/15', department_id: deptMap['P-Way'], risk_level: 'Medium' },
        { asset_code: 'AST-SIG-10', asset_name: 'Motorized Point Machine PM-14B', asset_type: 'Point Motor', corridor_id: corrMap['C1'], location: 'Junction Crossover 14B', km_marker: '25/00', department_id: deptMap['S&T'], risk_level: 'Critical' },
        { asset_code: 'AST-SIG-11', asset_name: 'DC Track Circuit Relays TC-45', asset_type: 'Track Circuit', corridor_id: corrMap['C3'], location: 'Section TC 45', km_marker: '45/00', department_id: deptMap['S&T'], risk_level: 'Medium' },
        { asset_code: 'AST-TRD-12', asset_name: '25kV Traction Substation TSS-02', asset_type: 'Traction Transformer', corridor_id: corrMap['C1'], location: 'Substation TSS-02', km_marker: '18/00', department_id: deptMap['TRD'], risk_level: 'Low' }
    ];

    const { data: assets, error: assetErr } = await supabase.from('assets').upsert(assetsData, { onConflict: 'asset_code' }).select();
    if (assetErr) throw new Error('Failed to seed assets: ' + assetErr.message);
    console.log(`✓ Seeded ${assets.length} railway assets`);

    const assetMap = {};
    assets.forEach(a => {
        assetMap[a.asset_code] = a.id;
    });

    // 6. TRAINS
    console.log('--- 6. Train Timetable ---');
    const trainsData = [
        {
            train_id: 'TRN-12301',
            train_number: '12301',
            train_name: 'Howrah Rajdhani Express',
            train_type: 'Superfast Express',
            corridor_id: corrMap['C2'],
            origin: 'New Delhi',
            destination: 'Howrah',
            start_time: '06:30',
            end_time: '08:45',
            priority: 'High',
            status: 'Running On Time',
            delay_minutes: 0
        },
        {
            train_id: 'TRN-12019',
            train_number: '12019',
            train_name: 'Shatabdi Express',
            train_type: 'Express',
            corridor_id: corrMap['C2'],
            origin: 'Howrah',
            destination: 'Ranchi',
            start_time: '11:15',
            end_time: '13:00',
            priority: 'High',
            status: 'Running On Time',
            delay_minutes: 0
        },
        {
            train_id: 'TRN-T310',
            train_number: 'T310',
            train_name: 'BOXN Freight Rake',
            train_type: 'Freight',
            corridor_id: corrMap['C2'],
            origin: 'Andal Yard',
            destination: 'Howrah Goods',
            start_time: '14:30',
            end_time: '17:15',
            priority: 'Medium',
            status: 'Scheduled',
            delay_minutes: 0
        },
        {
            train_id: 'TRN-22302',
            train_number: '22302',
            train_name: 'Vande Bharat Express',
            train_type: 'Superfast Express',
            corridor_id: corrMap['C1'],
            origin: 'Howrah',
            destination: 'New Jalpaiguri',
            start_time: '17:30',
            end_time: '20:15',
            priority: 'High',
            status: 'Scheduled',
            delay_minutes: 0
        },
        {
            train_id: 'TRN-T508',
            train_number: 'T508',
            train_name: 'Coal Container Special',
            train_type: 'Freight',
            corridor_id: corrMap['C3'],
            origin: 'Dankuni DFC',
            destination: 'Haldia Port',
            start_time: '18:45',
            end_time: '22:00',
            priority: 'Medium',
            status: 'Scheduled',
            delay_minutes: 0
        },
        {
            train_id: 'TRN-37211',
            train_number: '37211',
            train_name: 'Bandel Local EMU',
            train_type: 'Local EMU',
            corridor_id: corrMap['C1'],
            origin: 'Howrah',
            destination: 'Bandel',
            start_time: '07:00',
            end_time: '08:30',
            priority: 'High',
            status: 'Running On Time',
            delay_minutes: 0
        },
        {
            train_id: 'TRN-T703',
            train_number: 'T703',
            train_name: 'Steel Coil Freight',
            train_type: 'Freight',
            corridor_id: corrMap['C1'],
            origin: 'Tata Yard',
            destination: 'Shalimar',
            start_time: '12:00',
            end_time: '14:30',
            priority: 'Medium',
            status: 'Scheduled',
            delay_minutes: 0
        },
        {
            train_id: 'TRN-13105',
            train_number: '13105',
            train_name: 'Sealdah Express',
            train_type: 'Express',
            corridor_id: corrMap['C3'],
            origin: 'Sealdah',
            destination: 'Ballia',
            start_time: '08:00',
            end_time: '10:30',
            priority: 'High',
            status: 'Running On Time',
            delay_minutes: 0
        },
        {
            train_id: 'TRN-12345',
            train_number: '12345',
            train_name: 'Saraighat Express',
            train_type: 'Superfast Express',
            corridor_id: corrMap['C2'],
            origin: 'Howrah',
            destination: 'Guwahati',
            start_time: '15:55',
            end_time: '18:15',
            priority: 'High',
            status: 'Scheduled',
            delay_minutes: 0
        },
        {
            train_id: 'TRN-31223',
            train_number: '31223',
            train_name: 'Barrackpore Local',
            train_type: 'Local EMU',
            corridor_id: corrMap['C3'],
            origin: 'Sealdah',
            destination: 'Barrackpore',
            start_time: '12:15',
            end_time: '13:10',
            priority: 'High',
            status: 'Scheduled',
            delay_minutes: 0
        }
    ];

    const { data: trains, error: trainErr } = await supabase.from('trains').upsert(trainsData, { onConflict: 'train_id' }).select();
    if (trainErr) throw new Error('Failed to seed trains: ' + trainErr.message);
    console.log(`✓ Seeded ${trains.length} trains`);

    const trainMap = {};
    trains.forEach(t => {
        trainMap[t.train_number] = t.id;
        trainMap[t.train_id] = t.id;
    });

    // 7. BLOCK WINDOWS
    console.log('--- 7. Block Windows ---');
    const windowsData = [
        { block_code: 'B-101', corridor_id: corrMap['C1'], start_time: '09:30', end_time: '11:00', duration_minutes: 90, status: 'Available', occupied_minutes: 0, created_by: profMap['EMP001'] },
        { block_code: 'B-102', corridor_id: corrMap['C2'], start_time: '14:00', end_time: '16:30', duration_minutes: 150, status: 'Available', occupied_minutes: 0, created_by: profMap['EMP001'] },
        { block_code: 'B-103', corridor_id: corrMap['C3'], start_time: '19:00', end_time: '21:30', duration_minutes: 150, status: 'Available', occupied_minutes: 0, created_by: profMap['EMP001'] },
        { block_code: 'B-104', corridor_id: corrMap['C2'], start_time: '18:30', end_time: '21:00', duration_minutes: 150, status: 'Available', occupied_minutes: 0, created_by: profMap['EMP001'] },
        { block_code: 'B-105', corridor_id: corrMap['C1'], start_time: '15:00', end_time: '17:00', duration_minutes: 120, status: 'Available', occupied_minutes: 0, created_by: profMap['EMP001'] },
        { block_code: 'B-106', corridor_id: corrMap['C3'], start_time: '11:00', end_time: '13:00', duration_minutes: 120, status: 'Available', occupied_minutes: 0, created_by: profMap['EMP001'] },
        { block_code: 'B-107', corridor_id: corrMap['C2'], start_time: '15:00', end_time: '17:00', duration_minutes: 120, status: 'Available', occupied_minutes: 0, created_by: profMap['EMP001'] }
    ];

    const { data: windows, error: winErr } = await supabase.from('block_windows').upsert(windowsData, { onConflict: 'block_code' }).select();
    if (winErr) throw new Error('Failed to seed block windows: ' + winErr.message);
    console.log(`✓ Seeded ${windows.length} block windows`);

    const winMap = {};
    windows.forEach(w => {
        winMap[w.block_code] = w.id;
    });

    // 8. MAINTENANCE REQUESTS
    console.log('--- 8. Maintenance Work Orders ---');
    const rawStorePath = path.join(__dirname, '..', 'data_store.json');
    let rawRequests = [];
    if (fs.existsSync(rawStorePath)) {
        const raw = JSON.parse(fs.readFileSync(rawStorePath, 'utf8'));
        if (raw.requests && raw.requests.length > 0) rawRequests = raw.requests;
    }

    // Standard baseline requests
    const defaultRequests = [
        {
            request_code: 'M-101',
            work_description: 'Rail Replacement on Down Main Line',
            department: 'P-Way',
            corridor: 'C2',
            location: 'KM 142/12 to 148/04',
            duration_minutes: 150,
            priority_level: 'High',
            priority_score: 85,
            urgency_score: 80,
            asset_risk_score: 90,
            traffic_impact_score: 85,
            due_date: '2026-09-22',
            status: 'Planned',
            reason: 'Assigned High priority due to elevated urgency, high asset risk, and significant traffic impact.',
            employee_id: 'EMP001',
            assigned_block_id: 'B-104'
        },
        {
            request_code: 'M-102',
            work_description: 'Digital Axle Counter Recalibration',
            department: 'S&T',
            corridor: 'C1',
            location: 'Junction Section A2',
            duration_minutes: 90,
            priority_level: 'Medium',
            priority_score: 65,
            urgency_score: 60,
            asset_risk_score: 65,
            traffic_impact_score: 70,
            due_date: '2026-09-25',
            status: 'Pending',
            reason: 'Assigned Medium priority based on moderate operational risk parameters.',
            employee_id: 'EMP003'
        },
        {
            request_code: 'M-103',
            work_description: 'Overhead Contact Wire Tensioner Inspection',
            department: 'TRD',
            corridor: 'C3',
            location: 'Line 2 Chord Line',
            duration_minutes: 120,
            priority_level: 'Low',
            priority_score: 40,
            urgency_score: 35,
            asset_risk_score: 40,
            traffic_impact_score: 45,
            due_date: '2026-09-30',
            status: 'Pending',
            reason: 'Standard low priority based on routine maintenance risk parameters.',
            employee_id: 'EMP004'
        },
        {
            request_code: 'M-104',
            work_description: 'Track Tamping & Geometry Realignment',
            department: 'P-Way',
            corridor: 'C2',
            location: 'KM 88/04 to 92/10',
            duration_minutes: 60,
            priority_level: 'Critical',
            priority_score: 95,
            urgency_score: 95,
            asset_risk_score: 90,
            traffic_impact_score: 100,
            due_date: '2026-09-20',
            status: 'Pending',
            reason: 'Assigned Critical priority due to elevated urgency, high asset risk, and approaching due date.',
            employee_id: 'EMP002'
        },
        {
            request_code: 'M-105',
            work_description: 'Electronic Interlocking Panel Audit',
            department: 'S&T',
            corridor: 'C2',
            location: 'Junction Cabin Block A',
            duration_minutes: 45,
            priority_level: 'High',
            priority_score: 82,
            urgency_score: 80,
            asset_risk_score: 85,
            traffic_impact_score: 80,
            due_date: '2026-09-21',
            status: 'Planned',
            reason: 'Assigned High priority due to elevated urgency and high asset risk.',
            employee_id: 'EMP003',
            assigned_block_id: 'B-104'
        },
        {
            request_code: 'M-118',
            work_description: 'LED Signal Aspect Replacement',
            department: 'S&T',
            corridor: 'C2',
            location: 'KM 90/02 Down Signal',
            duration_minutes: 45,
            priority_level: 'High',
            priority_score: 80,
            urgency_score: 75,
            asset_risk_score: 80,
            traffic_impact_score: 85,
            due_date: '2026-09-21',
            status: 'Pending',
            reason: 'Assigned High priority due to elevated urgency and signal reliability.',
            employee_id: 'EMP003'
        },
        {
            request_code: 'M-106',
            work_description: 'OHE Dropper & Cantilever Realignment',
            department: 'TRD',
            corridor: 'C2',
            location: 'KM 91/10 to 93/00',
            duration_minutes: 60,
            priority_level: 'High',
            priority_score: 84,
            urgency_score: 80,
            asset_risk_score: 85,
            traffic_impact_score: 85,
            due_date: '2026-09-22',
            status: 'Pending',
            reason: 'Assigned High priority due to contact wire wear and speed restriction mitigation.',
            employee_id: 'EMP004'
        },
        {
            request_code: 'M-127',
            work_description: 'Track Realignment & Tamping',
            department: 'P-Way',
            corridor: 'C3',
            location: 'KM 12/04 - 15/00',
            duration_minutes: 100,
            priority_level: 'High',
            priority_score: 86,
            urgency_score: 85,
            asset_risk_score: 85,
            traffic_impact_score: 88,
            due_date: '2026-09-24',
            status: 'Pending',
            reason: 'Track realign to eliminate alignment defects.',
            employee_id: 'EMP001'
        }
    ];

    // Combine default and any additional requests from rawStore
    const requestRows = [];
    const seenReqCodes = new Set();

    defaultRequests.forEach(dr => {
        seenReqCodes.add(dr.request_code);
        requestRows.push({
            request_code: dr.request_code,
            work_description: dr.work_description,
            department_id: deptMap[dr.department] || deptMap['P-Way'],
            corridor_id: corrMap[dr.corridor] || corrMap['C2'],
            submitted_by: profMap[dr.employee_id] || profMap['EMP001'],
            location: dr.location,
            duration_minutes: dr.duration_minutes,
            priority_level: dr.priority_level,
            priority_score: dr.priority_score,
            urgency_score: dr.urgency_score,
            asset_risk_score: dr.asset_risk_score,
            traffic_impact_score: dr.traffic_impact_score,
            due_date: dr.due_date,
            status: dr.status,
            reason: dr.reason,
            assigned_block_id: dr.assigned_block_id || null
        });
    });

    rawRequests.forEach(r => {
        const code = r.request_id || r.request_code;
        if (code && !seenReqCodes.has(code)) {
            seenReqCodes.add(code);
            let corrCode = 'C2';
            if (r.corridor && r.corridor.includes('C1')) corrCode = 'C1';
            else if (r.corridor && r.corridor.includes('C3')) corrCode = 'C3';

            requestRows.push({
                request_code: code,
                work_description: r.work_description || r.description || 'Railway Maintenance Work',
                department_id: deptMap[r.department] || deptMap['P-Way'],
                corridor_id: corrMap[corrCode] || corrMap['C2'],
                submitted_by: profMap[r.employee_id] || profMap['EMP001'],
                location: r.location || 'Track Section',
                duration_minutes: parseInt(r.duration_minutes) || 60,
                priority_level: r.priority || 'Medium',
                priority_score: 70,
                status: r.status || 'Pending',
                reason: r.reason || r.priority_reason || 'Maintenance priority based on asset reliability.',
                assigned_block_id: r.assigned_block_id || r.block_id || null
            });
        }
    });

    const { data: insertedRequests, error: reqErr } = await supabase.from('maintenance_requests').upsert(requestRows, { onConflict: 'request_code' }).select();
    if (reqErr) throw new Error('Failed to seed maintenance requests: ' + reqErr.message);
    console.log(`✓ Seeded ${insertedRequests.length} maintenance requests`);

    const reqMap = {};
    insertedRequests.forEach(r => {
        reqMap[r.request_code] = r.id;
    });

    // 9. BLOCK ASSIGNMENTS
    console.log('--- 9. Block Assignments ---');
    const assignmentsData = [
        {
            request_id: reqMap['M-101'],
            block_window_id: winMap['B-104'],
            assigned_by: profMap['EMP001'],
            assigned_start_time: '2026-09-21T18:30:00Z',
            assigned_end_time: '2026-09-21T21:00:00Z',
            status: 'Confirmed',
            assignment_reason: 'Task fits within available window without conflicting with high-priority traffic.',
            suitability_score: 95
        },
        {
            request_id: reqMap['M-105'],
            block_window_id: winMap['B-104'],
            assigned_by: profMap['EMP001'],
            assigned_start_time: '2026-09-21T18:30:00Z',
            assigned_end_time: '2026-09-21T19:15:00Z',
            status: 'Confirmed',
            assignment_reason: 'Coordinated shadow block during P-Way rail replacement.',
            suitability_score: 98
        }
    ].filter(a => a.request_id && a.block_window_id);

    if (assignmentsData.length > 0) {
        const { data: assignments, error: assignErr } = await supabase.from('block_assignments').upsert(assignmentsData, { onConflict: 'request_id' }).select();
        if (assignErr) throw new Error('Failed to seed block assignments: ' + assignErr.message);
        console.log(`✓ Seeded ${assignments.length} block assignments`);
    }

    // 10. CONFLICTS
    console.log('--- 10. Initial Conflicts ---');
    const conflictsData = [
        {
            conflict_code: 'CONF-001',
            train_id: trainMap['T310'],
            block_window_id: winMap['B-107'],
            corridor_id: corrMap['C2'],
            conflict_type: 'TRAIN',
            severity: 'Critical',
            conflict_start: '2026-09-21T15:00:00Z',
            conflict_end: '2026-09-21T17:00:00Z',
            description: 'Proposed maintenance block B-107 overlaps with BOXN Freight Train T310 running 14:30–17:15 on Corridor C2.',
            resolution: 'Shift block window to 18:30–21:00 or reschedule Freight T310 to loop line.',
            status: 'Active'
        },
        {
            conflict_code: 'CONF-002',
            request_id: reqMap['M-104'],
            corridor_id: corrMap['C2'],
            conflict_type: 'RESOURCE',
            severity: 'High',
            description: 'Tie tamping machine BCM-04 required by M-104 is also allocated to Down Main line work.',
            resolution: 'Coordinate shared tamping equipment across contiguous sections.',
            status: 'Active'
        }
    ].filter(c => c.corridor_id);

    const { data: conflicts, error: confErr } = await supabase.from('conflicts').upsert(conflictsData, { onConflict: 'conflict_code' }).select();
    if (confErr) throw new Error('Failed to seed conflicts: ' + confErr.message);
    console.log(`✓ Seeded ${conflicts.length} operational conflicts`);

    // 11. NOTIFICATIONS
    console.log('--- 11. Notifications ---');
    const notificationsData = [
        {
            user_id: profMap['EMP001'],
            notification_type: 'SYSTEM',
            title: 'System Initialized',
            message: 'Raksha Block normalized PostgreSQL database connected on Supabase.',
            severity: 'Normal',
            is_read: false
        },
        {
            user_id: profMap['EMP001'],
            notification_type: 'CONFLICT',
            title: 'New Conflict Detected',
            message: 'Freight Train T310 overlaps with proposed window B-107 on Corridor C2.',
            severity: 'High',
            is_read: false
        },
        {
            user_id: profMap['EMP002'],
            notification_type: 'PRIORITY',
            title: 'Critical Maintenance Work Order',
            message: 'M-104 track geometry correction pending human planner review.',
            severity: 'Critical',
            is_read: false
        }
    ];

    const { data: notifs, error: notifErr } = await supabase.from('notifications').insert(notificationsData).select();
    if (notifErr) throw new Error('Failed to seed notifications: ' + notifErr.message);
    console.log(`✓ Seeded ${notifs.length} notifications`);

    // 12. AUDIT LOG
    console.log('--- 12. Audit Log ---');
    await supabase.from('audit_logs').insert([
        {
            user_id: profMap['EMP001'],
            action: 'INITIALIZE_DATABASE',
            entity_type: 'SYSTEM',
            new_values: { database: 'Supabase PostgreSQL', schema_version: '2.0.0', normalized_tables: 19 }
        }
    ]);
    console.log('✓ Seeded initial audit log entry');

    console.log('\n============================================================');
    console.log('🎉 SUPABASE DATABASE SEEDED SUCCESSFULLY WITH 100% RELATIONS');
    console.log('============================================================');
}

seedRelationalDatabase().catch(err => {
    console.error('Fatal seeding error:', err);
    process.exit(1);
});
