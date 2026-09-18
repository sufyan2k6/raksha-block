const http = require('http');

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
                ...headers
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
                } catch(e) {
                    resolve({ status: res.statusCode, headers: res.headers, raw: data });
                }
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function runDemoWorkflow() {
    console.log('=== STARTING RAKSHA BLOCK DEMO INTEGRATION AUDIT ===\n');
    let passCount = 0;
    let failCount = 0;

    function assert(cond, msg) {
        if (cond) {
            console.log(`✅ PASS: ${msg}`);
            passCount++;
        } else {
            console.error(`❌ FAIL: ${msg}`);
            failCount++;
        }
    }

    // 1. AUTH LOGIN
    console.log('--- STEP 1: AUTHENTICATION ---');
    const loginRes = await request('POST', '/api/auth/login', { employeeId: 'EMP002', password: 'pway123' });
    assert(loginRes.status === 200 && loginRes.body.user.department === 'P-Way', 'Login succeeds and returns user department (P-Way)');
    const token = loginRes.body.token;

    // 2. CREATE MAINTENANCE REQUEST (Department from logged-in user context)
    console.log('\n--- STEP 2: CREATE MAINTENANCE REQUEST ---');
    const createReqRes = await request('POST', '/api/maintenance-requests', {
        work_description: 'Rail Joint Ultrasonic Inspection',
        location: 'KM 45/10 to 46/00',
        corridor: 'Corridor C2',
        duration_minutes: 60,
        urgency: 'High',
        asset_risk: 'High',
        traffic_impact: 'Medium',
        due_date: '2026-09-24'
    }, {
        'Authorization': `Bearer ${token}`
    });
    assert(createReqRes.status === 201, 'Maintenance request created in database');
    assert(createReqRes.body.request.department === 'P-Way', 'Department auto-assigned from authenticated user (P-Way)');
    assert(createReqRes.body.request.priority === 'Critical' || createReqRes.body.request.priority === 'High', 'Priority calculated automatically');
    const newReqId = createReqRes.body.request.request_id;

    // Test Status update
    const statusRes = await request('PATCH', `/api/maintenance-requests/${newReqId}/status`, { status: 'Planned' });
    assert(statusRes.status === 200 && statusRes.body.request.status === 'Planned', 'Status updated to Planned via PATCH');

    // 3. PRIORITY ANALYSIS
    console.log('\n--- STEP 3: PRIORITY ANALYSIS ---');
    const priorityRes = await request('GET', '/api/maintenance-requests');
    const createdInList = priorityRes.body.requests.find(r => r.request_id === newReqId);
    assert(createdInList && createdInList.priority, 'Priority Analysis displays newly created request with calculated priority');

    // 4. TRAIN SCHEDULE
    console.log('\n--- STEP 4: TRAIN SCHEDULE ---');
    const trainRes = await request('GET', '/api/trains');
    assert(trainRes.status === 200 && trainRes.body.trains.length >= 8, 'Train schedule returns seeded timetable');
    const addTrainRes = await request('POST', '/api/trains', {
        train_number: 'T9999',
        train_name: 'Test Special Express',
        train_type: 'Superfast',
        corridor: 'Corridor C2',
        start_time: '22:00',
        end_time: '23:30'
    });
    assert(addTrainRes.status === 201, 'Train added to database');
    const delTrainRes = await request('DELETE', `/api/trains/${addTrainRes.body.train.id}`);
    assert(delTrainRes.status === 200, 'Train deleted successfully');

    // 5. BLOCK WINDOWS
    console.log('\n--- STEP 5: BLOCK WINDOWS ---');
    const winRes = await request('GET', '/api/block-windows');
    assert(winRes.status === 200 && winRes.body.windows.length >= 5, 'Block windows loaded from database');
    // Test validation: end <= start
    const invalidWinRes = await request('POST', '/api/block-windows', {
        corridor: 'Corridor C2',
        date: '2026-09-22',
        start_time: '16:00',
        end_time: '14:00'
    });
    assert(invalidWinRes.status === 400, 'Invalid time window (end <= start) correctly rejected with validation error');
    // Add valid window
    const addWinRes = await request('POST', '/api/block-windows', {
        corridor: 'Corridor C2',
        date: '2026-09-22',
        start_time: '10:00',
        end_time: '12:00'
    });
    assert(addWinRes.status === 201, 'Valid block window created');
    const delWinRes = await request('DELETE', `/api/block-windows/${addWinRes.body.window.id}`);
    assert(delWinRes.status === 200, 'Block window deleted successfully');

    // 6. CONFLICT DETECTION
    console.log('\n--- STEP 6: CONFLICT DETECTION ---');
    const confRes = await request('GET', '/api/conflicts');
    assert(confRes.status === 200 && confRes.body.conflicts.length > 0, 'Conflicts detected dynamically from DB data');
    const firstConf = confRes.body.conflicts[0];
    const resolveConf = await request('PATCH', `/api/conflicts/${firstConf.id}/resolve`);
    assert(resolveConf.status === 200 && resolveConf.body.conflict.status === 'Resolved', 'Conflict resolve button persists status in database');

    // 7. TASK COORDINATION
    console.log('\n--- STEP 7: TASK COORDINATION ---');
    const coordRes = await request('GET', '/api/coordination');
    assert(coordRes.status === 200 && coordRes.body.opportunities.length > 0, 'Task coordination identified cross-department bundle opportunities');
    const firstBundle = coordRes.body.opportunities[0];
    const bundleRes = await request('POST', `/api/coordination/${firstBundle.id}/bundle`);
    assert(bundleRes.status === 200 && bundleRes.body.status === 'Bundled', 'Task bundling action persists successfully');

    // 8. BLOCK PLANNING
    console.log('\n--- STEP 8: BLOCK PLANNING ---');
    const genPlanRes = await request('POST', '/api/block-plans/generate', { corridor: 'Corridor C2', date: '2026-09-21' });
    assert(genPlanRes.status === 200, 'Custom scheduler generated block plan');
    assert(genPlanRes.body.plan.status === 'Draft Recommended Plan', 'Generated plan marked as Draft Recommended Plan');
    assert(genPlanRes.body.plan.scheduled_tasks.length > 0, 'Plan scheduled tasks within window');
    assert(genPlanRes.body.plan.why_this_plan, 'Plan includes transparent constraint reasoning (Why This Plan)');

    // 9. HUMAN APPROVAL & REJECT
    console.log('\n--- STEP 9: HUMAN APPROVAL & REJECT ---');
    const approveRes = await request('POST', '/api/block-plans/approve', null, { 'x-user-name': 'Rohan Gupta (Railway Planner)' });
    assert(approveRes.status === 200 && approveRes.body.plan.status === 'Approved', 'Plan approved and signed by planner');
    const rejectRes = await request('POST', '/api/block-plans/reject', null, { 'x-user-name': 'Rohan Gupta (Railway Planner)' });
    assert(rejectRes.status === 200 && rejectRes.body.plan.status === 'Rejected', 'Plan rejection persists correctly');

    // 10. WHAT-IF SIMULATOR
    console.log('\n--- STEP 10: WHAT-IF SIMULATOR ---');
    const simOffPeak = await request('POST', '/api/what-if/run', { startTimeShift: '18:30' });
    assert(simOffPeak.status === 200 && simOffPeak.body.scenario.is_feasible === true, 'Simulation correctly evaluates 18:30 shift as FEASIBLE');
    const simPeak = await request('POST', '/api/what-if/run', { startTimeShift: '17:00' });
    assert(simPeak.status === 200 && simPeak.body.scenario.is_feasible === false, 'Simulation correctly evaluates 17:00 shift as NOT FEASIBLE (Train clash)');

    // 11. RAKSHA AI ASSISTANT
    console.log('\n--- STEP 11: RAKSHA AI ASSISTANT ---');
    const aiRes = await request('POST', '/api/ai/query', { query: 'Why was this block selected for Corridor C2?' });
    assert(aiRes.status === 200 && aiRes.body.answer.length > 20, 'Raksha AI responds using live database structured context');

    // 12. REPORTS & ANALYTICS
    console.log('\n--- STEP 12: REPORTS & ANALYTICS ---');
    const repRes = await request('GET', '/api/reports/kpis');
    assert(repRes.status === 200 && repRes.body.kpis.totalRequests >= 10, 'Reports calculate dynamic KPIs from database');

    // 13. DASHBOARD
    console.log('\n--- STEP 13: DASHBOARD METRICS ---');
    const dashRes = await request('GET', '/api/dashboard/summary');
    assert(dashRes.status === 200 && dashRes.body.summary.totalRequests >= 10, 'Dashboard summary consumes actual database records');

    console.log(`\n=======================================================`);
    console.log(`AUDIT RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
    console.log(`=======================================================`);
}

runDemoWorkflow();
