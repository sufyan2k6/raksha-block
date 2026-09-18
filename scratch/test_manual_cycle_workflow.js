const { supabase } = require('../server/supabaseClient');

const BASE_URL = 'http://localhost:3000';

async function api(url, options = {}) {
    options.headers = options.headers || {};
    if (options.body && typeof options.body === 'object') {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }
    const res = await fetch(url, options);
    let data = null;
    try {
        data = await res.json();
    } catch (e) {
        data = null;
    }
    return { status: res.status, ok: res.ok, data };
}

async function runValidation() {
    console.log('========================================================');
    console.log('🧪 RAKSHA BLOCK — 16-POINT POST-RESET MANUAL TEST SUITE');
    console.log('========================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
            failed++;
        }
    }

    // ----------------------------------------------------
    // TEST 1 — LOGIN ACCOUNTS PRESERVED
    // ----------------------------------------------------
    console.log('--- TEST 1: LOGIN OF PRESERVED ACCOUNTS ---');
    const users = [
        { id: 'EMP001', pass: 'planner123', expectedRole: 'Railway Planner', dept: 'Operations' },
        { id: 'EMP002', pass: 'pway123', expectedRole: 'Senior Section Engineer', dept: 'P-Way' },
        { id: 'EMP003', pass: 'st123', expectedRole: 'Signal Inspector', dept: 'S&T' },
        { id: 'EMP004', pass: 'trd123', expectedRole: 'TRD Electrical Engineer', dept: 'TRD' },
        { id: 'EMP005', pass: 'traffic123', expectedRole: 'Traffic Controller', dept: 'Operations' }
    ];

    const tokens = {};
    for (const u of users) {
        const res = await api(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            body: { employee_id: u.id, password: u.pass }
        });
        assert(res.ok && res.data.success && res.data.user.department === u.dept, `${u.id} (${u.dept}) logged in successfully`);
        tokens[u.id] = res.data.token;
    }

    const plannerHeaders = {
        'x-user-id': 'EMP001',
        'x-user-role': 'Railway Planner',
        'x-user-department': 'Operations',
        'Authorization': `Bearer ${tokens['EMP001']}`
    };

    const pwayHeaders = {
        'x-user-id': 'EMP002',
        'x-user-role': 'Senior Section Engineer',
        'x-user-department': 'P-Way',
        'Authorization': `Bearer ${tokens['EMP002']}`
    };

    // ----------------------------------------------------
    // TEST 2 — EMPTY OPERATIONAL STATE
    // ----------------------------------------------------
    console.log('\n--- TEST 2: VERIFY EMPTY OPERATIONAL DATABASE ---');
    const emptyReqs = await api(`${BASE_URL}/api/maintenance-requests`, { headers: plannerHeaders });
    assert(emptyReqs.data.count === 0, `0 maintenance requests (actual DB count: ${emptyReqs.data.count})`);

    const emptyTrains = await api(`${BASE_URL}/api/trains`, { headers: plannerHeaders });
    assert(emptyTrains.data.count === 0, `0 trains in schedule (actual DB count: ${emptyTrains.data.count})`);

    const emptyWindows = await api(`${BASE_URL}/api/block-windows`, { headers: plannerHeaders });
    assert(emptyWindows.data.count === 0, `0 block windows configured (actual DB count: ${emptyWindows.data.count})`);

    const emptyConflicts = await api(`${BASE_URL}/api/conflicts`, { headers: plannerHeaders });
    assert(emptyConflicts.data.count === 0, `0 active conflicts (actual DB count: ${emptyConflicts.data.count})`);

    const emptyDashboard = await api(`${BASE_URL}/api/dashboard/summary`, { headers: plannerHeaders });
    assert(emptyDashboard.data.pendingMaintenance === 0 && emptyDashboard.data.availableBlocks === 0, `Dashboard KPIs reflect 0 for all operational metrics`);

    // ----------------------------------------------------
    // TEST 3 — RESTART DOES NOT REPOPULATE FAKE DATA
    // ----------------------------------------------------
    console.log('\n--- TEST 3: REPOPULATION CHECK ---');
    const { count: dbReqCount } = await supabase.from('maintenance_requests').select('*', { count: 'exact', head: true });
    assert(dbReqCount === 0, `Direct Supabase check confirms 0 records. No automatic seeding occurred.`);

    // ----------------------------------------------------
    // TEST 4 — DEPARTMENT EMPLOYEE SUBMITS REQUEST MANUALLY
    // ----------------------------------------------------
    console.log('\n--- TEST 4: P-WAY SUBMITS REAL MAINTENANCE REQUEST ---');
    const createReqRes = await api(`${BASE_URL}/api/maintenance-requests`, {
        method: 'POST',
        headers: pwayHeaders,
        body: {
            work_description: 'Ultrasonic Flaw Detection on Track Rails KM 108/4',
            location: 'KM 108/4 Up Line',
            corridor: 'Corridor C2',
            duration_minutes: 120,
            urgency: 'High',
            asset_risk: 'High',
            asset: 'Track Rails'
        }
    });
    assert(createReqRes.status === 201 && createReqRes.data.request.department === 'P-Way', `P-Way created request ${createReqRes.data.request.request_id} with status Pending`);
    const newReqId = createReqRes.data.request.request_id;

    // Verify in Supabase
    const { data: supaReq } = await supabase.from('maintenance_requests').select('*').eq('request_code', newReqId).single();
    assert(supaReq && supaReq.request_code === newReqId, `Request ${newReqId} verified saved directly in Supabase PostgreSQL`);

    // ----------------------------------------------------
    // TEST 5 — PLANNER SEES NEW REQUEST & CANNOT SUBMIT
    // ----------------------------------------------------
    console.log('\n--- TEST 5: PLANNER ROLE ACCESS ---');
    const plannerView = await api(`${BASE_URL}/api/maintenance-requests`, { headers: plannerHeaders });
    assert(plannerView.data.count === 1 && plannerView.data.requests[0].request_id === newReqId, `Planner sees newly submitted request ${newReqId}`);

    // Planner blocked from submitting maintenance requests
    const plannerIllegalReq = await api(`${BASE_URL}/api/maintenance-requests`, {
        method: 'POST',
        headers: plannerHeaders,
        body: { work_description: 'Planner illegal', corridor: 'Corridor C1', location: 'KM 10', duration_minutes: 60 }
    });
    assert(plannerIllegalReq.status === 403, `Planner submission blocked with 403 Forbidden as expected`);

    // ----------------------------------------------------
    // TEST 6 — CREATE REAL TRAIN SCHEDULE MANUALLY
    // ----------------------------------------------------
    console.log('\n--- TEST 6: CREATE TRAIN SCHEDULE MANUALLY ---');
    const createTrainRes = await api(`${BASE_URL}/api/trains`, {
        method: 'POST',
        headers: plannerHeaders,
        body: {
            train_number: '12301',
            train_name: 'Howrah Rajdhani Express',
            train_type: 'Express',
            corridor: 'Corridor C2',
            origin: 'Howrah Junction',
            destination: 'New Delhi',
            start_time: '16:55',
            end_time: '18:45'
        }
    });
    assert(createTrainRes.status === 201, `Train 12301 created successfully`);

    // Verify persistence in Supabase
    const { data: supaTrain } = await supabase.from('trains').select('*').eq('train_number', '12301').single();
    assert(supaTrain && supaTrain.train_number === '12301', `Train 12301 verified in Supabase PostgreSQL`);

    // ----------------------------------------------------
    // TEST 7 — CREATE BLOCK WINDOW MANUALLY
    // ----------------------------------------------------
    console.log('\n--- TEST 7: CREATE BLOCK WINDOW MANUALLY ---');
    const createWindowRes = await api(`${BASE_URL}/api/block-windows`, {
        method: 'POST',
        headers: plannerHeaders,
        body: {
            window_id: 'BW-201',
            corridor: 'Corridor C2',
            date: '2026-09-21',
            start_time: '13:00',
            end_time: '15:30'
        }
    });
    assert(createWindowRes.status === 201, `Block window BW-201 created successfully`);

    // Verify persistence in Supabase
    const { data: supaWin } = await supabase.from('block_windows').select('*').eq('block_code', 'BW-201').single();
    assert(supaWin && supaWin.block_code === 'BW-201', `Block window BW-201 verified in Supabase PostgreSQL`);

    // ----------------------------------------------------
    // TEST 8 — PRIORITY ANALYSIS
    // ----------------------------------------------------
    console.log('\n--- TEST 8: PRIORITY ANALYSIS ---');
    const prioRes = await api(`${BASE_URL}/api/priority`, { headers: plannerHeaders });
    assert(prioRes.data.count === 1 && prioRes.data.requests[0].priority, `Priority evaluated for ${newReqId}: ${prioRes.data.requests[0].priority} Grade`);

    // ----------------------------------------------------
    // TEST 9 — CONFLICT DETECTION (REAL DATA AUDIT)
    // ----------------------------------------------------
    console.log('\n--- TEST 9: CONFLICT DETECTION ON REAL DATA ---');
    // Currently Window is 13:00 - 15:30, Train is 16:55 - 18:45 -> No conflict
    const conf1 = await api(`${BASE_URL}/api/conflicts`, { headers: plannerHeaders });
    assert(conf1.data.count === 0, `0 conflicts between BW-201 (13:00-15:30) and Train 12301 (16:55-18:45)`);

    // Create an overlapping freight train to test conflict detection engine
    await api(`${BASE_URL}/api/trains`, {
        method: 'POST',
        headers: plannerHeaders,
        body: {
            train_number: 'BOXN-99',
            train_name: 'Coal Freight Rake',
            train_type: 'Freight',
            corridor: 'Corridor C2',
            origin: 'Yard A',
            destination: 'Thermal Plant',
            start_time: '14:00',
            end_time: '15:00'
        }
    });
    const conf2 = await api(`${BASE_URL}/api/conflicts`, { headers: plannerHeaders });
    assert(conf2.data.count === 1, `Engine detected real clash: ${conf2.data.conflicts[0].conflict_id} (Window BW-201 overlaps Freight BOXN-99)`);

    // Remove the conflicting freight to clean up for assignment
    const { data: freightRow } = await supabase.from('trains').select('id').eq('train_number', 'BOXN-99').single();
    if (freightRow) {
        await api(`${BASE_URL}/api/trains/${freightRow.id}`, { method: 'DELETE', headers: plannerHeaders });
    }

    // ----------------------------------------------------
    // TEST 10 — FIND BLOCK FOR REAL PENDING REQUEST
    // ----------------------------------------------------
    console.log('\n--- TEST 10: FIND BLOCK USING REAL SUPABASE DATA ---');
    const suitableRes = await api(`${BASE_URL}/api/block-plans/suitable-blocks/${newReqId}`, { headers: plannerHeaders });
    assert(suitableRes.data.candidates && suitableRes.data.candidates.length === 1, `Candidate blocks retrieved from real database: found 1 candidate (BW-201)`);
    assert(suitableRes.data.candidates[0].blockId === 'BW-201' && suitableRes.data.candidates[0].feasible, `BW-201 evaluated as FEASIBLE for ${newReqId}`);

    // ----------------------------------------------------
    // TEST 11 — ASSIGN REQUEST TO BLOCK (REAL TRANSACTION)
    // ----------------------------------------------------
    console.log('\n--- TEST 11: ASSIGN REQUEST TO BLOCK ---');
    const assignRes = await api(`${BASE_URL}/api/block-plans/assign`, {
        method: 'POST',
        headers: plannerHeaders,
        body: {
            requestId: newReqId,
            blockId: 'BW-201'
        }
    });
    assert(assignRes.status === 200 && assignRes.data.success, `Successfully assigned ${newReqId} to block BW-201`);

    // Verify in database: request status must be Scheduled
    const { data: updatedReq } = await supabase.from('maintenance_requests').select('*').eq('request_code', newReqId).single();
    assert(updatedReq.status === 'Scheduled' && updatedReq.assigned_block_id === 'BW-201', `Request ${newReqId} confirmed Scheduled in Supabase with assigned_block_id BW-201`);

    // ----------------------------------------------------
    // TEST 12 — AUTOMATIC BLOCK PLANNING
    // ----------------------------------------------------
    console.log('\n--- TEST 12: AUTOMATIC BLOCK PLANNING ---');
    const planGen = await api(`${BASE_URL}/api/block-plans/generate`, {
        method: 'POST',
        headers: plannerHeaders,
        body: { corridor: 'Corridor C2', date: '2026-09-21' }
    });
    assert(planGen.status === 200 && planGen.data.plan, `Automatic block plan generated using real database entities`);

    // ----------------------------------------------------
    // TEST 13 — WHAT-IF SIMULATOR
    // ----------------------------------------------------
    console.log('\n--- TEST 13: WHAT-IF SIMULATION ---');
    const simRes = await api(`${BASE_URL}/api/what-if`, {
        method: 'POST',
        headers: plannerHeaders,
        body: {
            corridor: 'Corridor C2',
            startTime: '10:00',
            duration_minutes: 120
        }
    });
    assert(simRes.status === 200 && simRes.data.feasible !== undefined, `What-If scenario simulation ran successfully against live database`);

    // ----------------------------------------------------
    // TEST 14 — RAKSHA AI PLANNING ASSISTANT
    // ----------------------------------------------------
    console.log('\n--- TEST 14: RAKSHA AI DECISION SUPPORT ---');
    const aiRes = await api(`${BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: plannerHeaders,
        body: { message: 'Explain current maintenance status and recommended plan for Corridor C2.' }
    });
    assert(aiRes.status === 200 && aiRes.data.reply, `Raksha AI replied with operational reasoning`);

    // ----------------------------------------------------
    // TEST 15 — DASHBOARD METRICS UPDATE
    // ----------------------------------------------------
    console.log('\n--- TEST 15: DASHBOARD UPDATED FROM REAL DATA ---');
    const dashUpdated = await api(`${BASE_URL}/api/dashboard/summary`, { headers: plannerHeaders });
    assert(dashUpdated.data.totalRequests === 1 && dashUpdated.data.availableBlocks === 1, `Dashboard metrics match real database: 1 total request, 1 block window`);

    // ----------------------------------------------------
    // TEST 16 — REPORTS & ANALYTICS
    // ----------------------------------------------------
    console.log('\n--- TEST 16: REPORTS REFLECT REAL RECORDS ---');
    const reportsRes = await api(`${BASE_URL}/api/reports`, { headers: plannerHeaders });
    assert(reportsRes.data.totalRequests === 1 && reportsRes.data.plannedTasks === 1, `Reports accurately reflect 1 scheduled task from database`);

    console.log('\n========================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

runValidation().catch(err => {
    console.error('Test suite failure:', err);
    process.exit(1);
});
