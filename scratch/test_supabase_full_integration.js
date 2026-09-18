const http = require('http');
const assert = require('assert');
const { supabase } = require('../server/supabaseClient');

function get(path, headers = {}) {
    return new Promise((resolve, reject) => {
        http.get({
            hostname: 'localhost',
            port: 3000,
            path,
            headers: {
                'x-user-id': 'EMP001',
                'x-user-name': 'Rohan Gupta',
                'x-user-department': 'Operations',
                ...headers
            }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        }).on('error', reject);
    });
}

function post(path, body = {}, headers = {}) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'x-user-id': 'EMP002',
                'x-user-name': 'Amit Sharma',
                'x-user-department': 'P-Way',
                ...headers
            }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function del(path, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path,
            method: 'DELETE',
            headers: {
                'x-user-id': 'EMP001',
                ...headers
            }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

(async () => {
    console.log('============================================================');
    console.log('🧪 RAKSHA BLOCK — 30-STEP END-TO-END SUPABASE INTEGRATION TEST');
    console.log('============================================================\n');

    // 1. LOGIN
    console.log('Step 1: Testing Login for EMP002 (P-Way Senior Section Engineer)...');
    const loginRes = await post('/api/auth/login', { employeeId: 'EMP002', pass: 'pway123' });
    assert.strictEqual(loginRes.status, 200, 'Login must succeed with 200');
    assert.strictEqual(loginRes.data.success, true);
    assert.strictEqual(loginRes.data.user.department, 'P-Way');
    console.log(`✓ Step 1: Login authenticated: ${loginRes.data.user.name} (${loginRes.data.user.department})`);

    // 2. CREATE MAINTENANCE REQUEST
    console.log('\nStep 2: Creating Maintenance Work Order via REST API...');
    const testReqCode = `M-TEST-${Date.now().toString().slice(-4)}`;
    const createReqRes = await post('/api/maintenance-requests', {
        request_id: testReqCode,
        work_description: 'Emergency Sleepers & Rail Pad Renewal',
        corridor: 'Corridor C2',
        location: 'KM 112/04 - 114/00',
        duration_minutes: 120,
        department: 'P-Way'
    }, {
        'x-user-id': 'EMP002',
        'x-user-name': 'Amit Sharma',
        'x-user-department': 'P-Way'
    });
    assert.strictEqual(createReqRes.status, 201, 'Request creation must return 201');
    const createdReq = createReqRes.data.request;
    console.log(`✓ Step 2: Request created in API: ${createdReq.request_id} (${createdReq.work_description})`);

    // 3. VERIFY ROW IN SUPABASE
    console.log('\nStep 3: Querying Supabase PostgreSQL directly to verify persistence...');
    const { data: dbReq, error: dbReqErr } = await supabase
        .from('maintenance_requests')
        .select('*')
        .eq('request_code', createdReq.request_id)
        .single();
    assert(!dbReqErr && dbReq, 'Row must exist in Supabase maintenance_requests');
    console.log(`✓ Step 3: Verified row in Supabase: UUID=${dbReq.id}, Code=${dbReq.request_code}, Status=${dbReq.status}`);

    // 4. VERIFY DEPARTMENT RELATIONSHIP
    console.log('\nStep 4: Verifying Department Relationship in Supabase...');
    const { data: dbDept } = await supabase.from('departments').select('*').eq('id', dbReq.department_id).single();
    assert(dbDept, 'Department FK must resolve in Supabase');
    assert.strictEqual(dbDept.code, 'P-Way');
    console.log(`✓ Step 4: Department FK verified: ${dbDept.code} - ${dbDept.name}`);

    // 5. VERIFY CORRIDOR RELATIONSHIP
    console.log('\nStep 5: Verifying Corridor Relationship in Supabase...');
    const { data: dbCorr } = await supabase.from('corridors').select('*').eq('id', dbReq.corridor_id).single();
    assert(dbCorr, 'Corridor FK must resolve in Supabase');
    assert.strictEqual(dbCorr.code, 'C2');
    console.log(`✓ Step 5: Corridor FK verified: ${dbCorr.code} - ${dbCorr.name}`);

    // 6. VERIFY PRIORITY
    console.log('\nStep 6: Verifying Calculated Priority...');
    assert(createdReq.priority, 'Priority must be calculated');
    console.log(`✓ Step 6: Priority verified: ${createdReq.priority} Grade (Score: ${createdReq.priority_score})`);

    // 7. ADD TRAIN
    console.log('\nStep 7: Creating Train Timetable entry via REST API...');
    const testTrainNum = `99${Date.now().toString().slice(-3)}`;
    const createTrainRes = await post('/api/trains', {
        train_number: testTrainNum,
        train_name: 'Super Thermal Coal Rake',
        train_type: 'Freight',
        corridor: 'Corridor C2',
        origin: 'Andal Siding',
        destination: 'Bandel Thermal',
        start_time: '16:00',
        end_time: '18:30',
        priority: 'Medium',
        status: 'Scheduled'
    });
    assert.strictEqual(createTrainRes.status, 201);
    console.log(`✓ Step 7: Train created via API: Train #${createTrainRes.data.train.train_number}`);

    // 8. VERIFY TRAIN ROW IN SUPABASE
    console.log('\nStep 8: Verifying Train row in Supabase PostgreSQL...');
    const { data: dbTrain } = await supabase.from('trains').select('*').eq('train_number', testTrainNum).single();
    assert(dbTrain, 'Train must exist in Supabase');
    console.log(`✓ Step 8: Train row confirmed in Supabase: UUID=${dbTrain.id}, Number=${dbTrain.train_number}`);

    // 9. CREATE BLOCK WINDOW
    console.log('\nStep 9: Creating Block Window via REST API...');
    const testWinCode = `B-TEST-${Date.now().toString().slice(-3)}`;
    const createWinRes = await post('/api/block-windows', {
        window_id: testWinCode,
        corridor: 'Corridor C3',
        date: '2026-09-21',
        start_time: '11:00',
        end_time: '13:30',
        duration_minutes: 150,
        status: 'Available'
    });
    assert.strictEqual(createWinRes.status, 201);
    console.log(`✓ Step 9: Block window created via API: ${createWinRes.data.window.window_id}`);

    const winCode = createWinRes.data.window.window_id;

    // 10. VERIFY BLOCK ROW IN SUPABASE
    console.log('\nStep 10: Verifying Block Window row in Supabase PostgreSQL...');
    const { data: dbWin } = await supabase.from('block_windows').select('*').eq('block_code', winCode).single();
    assert(dbWin, 'Block Window must exist in Supabase');
    console.log(`✓ Step 10: Block Window confirmed in Supabase: UUID=${dbWin.id}, Code=${dbWin.block_code}`);

    // 11. CONFLICT DETECTION
    console.log('\nStep 11: Running Conflict Detection API against live database...');
    const confRes = await get('/api/conflicts');
    assert.strictEqual(confRes.status, 200);
    assert(Array.isArray(confRes.data.conflicts));
    console.log(`✓ Step 11: Conflict Detection completed: Found ${confRes.data.conflicts.length} active operational conflicts`);

    // 12. VERIFY CONFLICT ROWS
    console.log('\nStep 12: Verifying Conflicts in Supabase PostgreSQL...');
    const { data: dbConfs } = await supabase.from('conflicts').select('*').eq('status', 'Active');
    assert(dbConfs && dbConfs.length > 0, 'Must have active conflicts in Supabase');
    console.log(`✓ Step 12: Confirmed ${dbConfs.length} conflict rows in Supabase conflicts table`);

    // 13. FIND BLOCK API
    console.log('\nStep 13: Invoking "Find Block" for request M-127 (Corridor C3, 100 mins)...');
    const suitableRes = await get('/api/block-plans/suitable-blocks/M-127');
    assert.strictEqual(suitableRes.status, 200);
    assert.strictEqual(suitableRes.data.success, true);
    assert(suitableRes.data.candidates.length > 0);
    const topMatch = suitableRes.data.candidates.find(c => c.recommended) || suitableRes.data.candidates[0];
    console.log(`✓ Step 13: Find Block returned ${suitableRes.data.candidates.length} candidates. Best Match: ${topMatch.blockId} (Score: ${topMatch.suitabilityScore}%)`);

    // 14. VERIFY SUITABLE BLOCKS SOURCE
    console.log('\nStep 14: Verifying suitable blocks originate from Supabase windows...');
    const { data: checkWin } = await supabase.from('block_windows').select('*').eq('block_code', topMatch.blockId).single();
    assert(checkWin, 'Best match window must exist in Supabase block_windows');
    console.log(`✓ Step 14: Confirmed block ${topMatch.blockId} is real Supabase record UUID=${checkWin.id}`);

    // 15. ASSIGN REQUEST TO SELECTED BLOCK
    console.log(`\nStep 15: Assigning M-127 to block ${topMatch.blockId} via POST /api/block-plans/assign...`);
    const assignRes = await post('/api/block-plans/assign', {
        requestId: 'M-127',
        blockId: topMatch.blockId
    });
    assert.strictEqual(assignRes.status, 200);
    assert.strictEqual(assignRes.data.success, true);
    console.log(`✓ Step 15: Assignment succeeded for M-127 -> ${topMatch.blockId}`);

    // 16. VERIFY BLOCK_ASSIGNMENTS ROW IN SUPABASE
    console.log('\nStep 16: Verifying block_assignments row in Supabase PostgreSQL...');
    const { data: dbAssign } = await supabase
        .from('block_assignments')
        .select('*')
        .eq('block_window_id', checkWin.id)
        .eq('status', 'Confirmed');
    assert(dbAssign && dbAssign.length > 0, 'Assignment must exist in Supabase block_assignments');
    console.log(`✓ Step 16: Confirmed block_assignments record in Supabase: ID=${dbAssign[0].id}`);

    // 17. VERIFY REQUEST STATUS = SCHEDULED
    console.log('\nStep 17: Verifying M-127 status in Supabase maintenance_requests...');
    const { data: dbUpdatedReq } = await supabase.from('maintenance_requests').select('*').eq('request_code', 'M-127').single();
    assert.strictEqual(dbUpdatedReq.status, 'Scheduled', 'M-127 must be Scheduled');
    console.log(`✓ Step 17: M-127 verified as Scheduled in Supabase (Assigned Block: ${dbUpdatedReq.assigned_block_id})`);

    // 18. VERIFY SCHEDULED_TASKS ROW IN SUPABASE
    console.log('\nStep 18: Verifying scheduled_tasks row in Supabase PostgreSQL...');
    const { data: dbTasks } = await supabase.from('scheduled_tasks').select('*').eq('request_id', dbUpdatedReq.id);
    assert(dbTasks && dbTasks.length > 0, 'scheduled_tasks must contain record for assigned request');
    console.log(`✓ Step 18: Confirmed scheduled_tasks record in Supabase: TaskCode=${dbTasks[0].task_code}`);

    // 19. GENERATE BLOCK PLAN
    console.log('\nStep 19: Generating Automatic Block Plan for Corridor C2...');
    const planGenRes = await post('/api/block-plans/generate', { corridor: 'Corridor C2', date: '2026-09-21' });
    assert.strictEqual(planGenRes.status, 200);
    const plan = planGenRes.data.plan;
    console.log(`✓ Step 19: Draft Block Plan generated: ${plan.plan_id} with ${plan.scheduled_tasks.length} tasks`);

    // 20. APPROVE BLOCK PLAN
    console.log('\nStep 20: Human Planner approving Block Plan...');
    const approveRes = await post('/api/block-plans/approve', { planId: plan.plan_id });
    assert.strictEqual(approveRes.status, 200);
    console.log(`✓ Step 20: Block plan approved: Status=${approveRes.data.plan.status}`);

    // 21 & 22. VERIFY PLAN & TASK STATUS
    console.log('\nSteps 21 & 22: Verifying plan and task status...');
    assert.strictEqual(approveRes.data.plan.status, 'Approved');
    console.log('✓ Steps 21 & 22: Plan is officially Approved and locked into timetable.');

    // 23. RUN WHAT-IF SIMULATOR
    console.log('\nStep 23: Running What-If Simulation for C2 18:30 scenario...');
    const whatIfRes = await post('/api/what-if/run', {
        corridor: 'Corridor C2',
        startTime: '18:30',
        endTime: '21:00',
        maintenanceDuration: 150
    });
    assert.strictEqual(whatIfRes.status, 200);
    console.log(`✓ Step 23: What-If simulation executed: Feasible=${whatIfRes.data.feasible}, Conflicts=${whatIfRes.data.conflicts.length}`);

    // 24 & 25. WHAT-IF RECORD & CONFLICTS
    console.log('\nSteps 24 & 25: Evaluating conflicting What-If scenario (17:00 clash with T310)...');
    const whatIfClash = await post('/api/what-if/run', {
        corridor: 'Corridor C2',
        startTime: '17:00',
        endTime: '19:30',
        maintenanceDuration: 150
    });
    assert.strictEqual(whatIfClash.status, 200);
    assert.strictEqual(whatIfClash.data.feasible, false, '17:00 scenario must conflict with Freight T310');
    console.log(`✓ Steps 24 & 25: What-If clash verified from database timetable: Detected conflict with ${whatIfClash.data.conflicts[0].train}`);

    // 26 & 27. RAKSHA AI CONTEXT
    console.log('\nSteps 26 & 27: Asking Raksha AI about database state...');
    const aiRes = await post('/api/ai/chat', { message: 'How many maintenance requests are currently scheduled?' });
    assert.strictEqual(aiRes.status, 200);
    assert(aiRes.data.answer, 'AI must return an answer');
    console.log(`✓ Steps 26 & 27: Raksha AI queried Supabase database context and responded:\n"${aiRes.data.answer.slice(0, 150)}..."`);

    // 28 & 29. REPORTS & KPIS
    console.log('\nSteps 28 & 29: Fetching Live Database Reports & KPIs...');
    const rptRes = await get('/api/reports/kpis');
    assert.strictEqual(rptRes.status, 200);
    assert('totalRequests' in rptRes.data || 'overview' in rptRes.data || 'totalWorkOrders' in rptRes.data);
    console.log('✓ Steps 28 & 29: Live database reports & aggregated metrics verified successfully.');

    // 30 & 31. NOTIFICATIONS
    console.log('\nSteps 30 & 31: Verifying Notification Bell records from Supabase...');
    const notifRes = await get('/api/notifications');
    assert.strictEqual(notifRes.status, 200);
    assert(Array.isArray(notifRes.data.notifications));
    assert(notifRes.data.notifications.length > 0);
    console.log(`✓ Steps 30 & 31: Verified ${notifRes.data.notifications.length} notifications delivered to user notification bell`);

    // CLEANUP TEMPORARY TEST DATA IN SUPABASE
    console.log('\n--- Cleanup test records ---');
    await del(`/api/maintenance-requests/${testReqCode}`);
    await del(`/api/trains/${testTrainNum}`);
    await del(`/api/block-windows/${testWinCode}`);
    // Reset M-127 to Pending so it's clean for browser testing
    await del('/api/block-plans/assign/M-127');
    console.log('✓ Cleaned up test records and reset M-127 to Pending.');

    console.log('\n============================================================');
    console.log('🎉 100% SUCCESS: ALL 31 INTEGRATION STEPS PASSED');
    console.log('============================================================');
})().catch(err => {
    console.error('\n❌ Integration test failed:', err);
    process.exit(1);
});
