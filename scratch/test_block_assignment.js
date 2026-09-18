const http = require('http');
const assert = require('assert');
const db = require('../server/db');

function get(url) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        http.get(u, res => {
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

function post(url, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = http.request({
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-name': 'Rohan Gupta (Railway Planner)',
                'x-employee-id': 'EMP001',
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
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function del(url) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = http.request({
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method: 'DELETE'
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
    console.log('===========================================================');
    console.log('🧪 RAKSHA BLOCK: REQUEST-TO-BLOCK ASSIGNMENT FEATURE AUDIT');
    console.log('===========================================================\n');

    // Reset M-127 state in running backend via API
    await del('http://localhost:3000/api/block-plans/assign/M-127');

    // Setup: Ensure M-127 exists and is Pending on Corridor C3
    let testReq = db.getRequestById('M-127');
    if (!testReq) {
        testReq = db.createRequest({
            request_id: 'M-127',
            employee_id: 'EMP001',
            submitted_by: 'Rohan Gupta',
            department: 'P-Way',
            work_description: 'Track Realignment & Tamping',
            location: 'KM 12/04 - 15/00',
            corridor: 'Corridor C3',
            duration_minutes: 100,
            priority: 'High',
            status: 'Pending'
        });
    } else {
        db.updateRequest('M-127', {
            status: 'Pending',
            block_id: null,
            assigned_block_id: null,
            scheduled_slot: null,
            corridor: 'Corridor C3',
            duration_minutes: 100
        });
    }

    // Clean up any existing test assignment for M-127
    const existingAssign = db.getBlockAssignmentByRequestId('M-127');
    if (existingAssign) {
        db.deleteBlockAssignment(existingAssign.id);
    }

    // -------------------------------------------------------------
    // TEST 1: GET /api/block-plans/suitable-blocks/:requestId
    // -------------------------------------------------------------
    console.log('TEST 1: Find Suitable Blocks API for Pending Request M-127...');
    const res1 = await get('http://localhost:3000/api/block-plans/suitable-blocks/M-127');
    assert.strictEqual(res1.status, 200, 'Endpoint should return HTTP 200');
    assert.strictEqual(res1.data.requestId, 'M-127');
    assert(Array.isArray(res1.data.candidates), 'Candidates must be an array');
    assert(res1.data.candidates.length > 0, 'Should find candidate blocks');

    const topCandidate = res1.data.candidates[0];
    console.log('✓ Found', res1.data.candidates.length, 'candidates. Top candidate:', {
        blockId: topCandidate.blockId,
        corridor: topCandidate.corridor,
        startTime: topCandidate.startTime,
        endTime: topCandidate.endTime,
        availableMinutes: topCandidate.availableMinutes,
        requiredMinutes: topCandidate.requiredMinutes,
        feasible: topCandidate.feasible,
        safetyBufferMinutes: topCandidate.safetyBufferMinutes,
        suitabilityScore: topCandidate.suitabilityScore,
        recommended: topCandidate.recommended
    });

    // Validate required schema properties
    assert('blockId' in topCandidate, 'Must have blockId');
    assert('corridor' in topCandidate, 'Must have corridor');
    assert('startTime' in topCandidate, 'Must have startTime');
    assert('endTime' in topCandidate, 'Must have endTime');
    assert('availableMinutes' in topCandidate, 'Must have availableMinutes');
    assert('requiredMinutes' in topCandidate, 'Must have requiredMinutes');
    assert('feasible' in topCandidate, 'Must have feasible');
    assert('conflictCount' in topCandidate, 'Must have conflictCount');
    assert('conflicts' in topCandidate, 'Must have conflicts');
    assert('safetyBufferMinutes' in topCandidate, 'Must have safetyBufferMinutes');
    assert('suitabilityScore' in topCandidate, 'Must have suitabilityScore');
    assert('suitabilityReason' in topCandidate, 'Must have suitabilityReason');
    assert('recommended' in topCandidate, 'Must have recommended');

    const feasibleCandidates = res1.data.candidates.filter(c => c.feasible);
    assert(feasibleCandidates.length > 0, 'Must have at least one feasible block on Corridor C3');
    const recommended = res1.data.candidates.find(c => c.recommended);
    assert(recommended, 'Must mark a candidate as recommended');
    console.log('✓ Verified: Top recommended block is', recommended.blockId, 'with score', recommended.suitabilityScore);

    // -------------------------------------------------------------
    // TEST 2: Valid POST /api/block-plans/assign
    // -------------------------------------------------------------
    console.log('\nTEST 2: Schedule M-127 into recommended feasible block', recommended.blockId, '...');
    const assignRes = await post('http://localhost:3000/api/block-plans/assign', {
        requestId: 'M-127',
        blockId: recommended.blockId
    });

    assert.strictEqual(assignRes.status, 200, 'Assignment should succeed with 200');
    assert.strictEqual(assignRes.data.success, true);
    assert.strictEqual(assignRes.data.request.status, 'Scheduled');
    assert.strictEqual(assignRes.data.request.block_id, recommended.blockId);
    console.log('✓ Assignment Succeeded. Database Response:', {
        assignmentId: assignRes.data.assignment.id,
        requestId: assignRes.data.assignment.request_id,
        blockId: assignRes.data.assignment.block_id,
        slot: `${assignRes.data.assignment.assigned_start_time} - ${assignRes.data.assignment.assigned_end_time}`,
        status: assignRes.data.assignment.status,
        assignedBy: assignRes.data.assignment.assigned_by
    });

    // Check relationship table in db (reload store from disk in test process)
    db.initStore();
    const storedAssignment = db.getBlockAssignmentByRequestId('M-127');
    assert(storedAssignment, 'Must be persisted in block_assignments table');
    assert.strictEqual(storedAssignment.block_id, recommended.blockId);
    assert.strictEqual(storedAssignment.status, 'Confirmed');
    console.log('✓ Verified: block_assignments table contains persistent record ID', storedAssignment.id);

    // Check request table in db
    const updatedReq = db.getRequestById('M-127');
    assert.strictEqual(updatedReq.status, 'Scheduled', 'Request status must become Scheduled');
    assert.strictEqual(updatedReq.block_id, recommended.blockId);
    console.log('✓ Verified: Maintenance request M-127 status changed: Pending -> Scheduled');

    // -------------------------------------------------------------
    // TEST 3: Rejection of Invalid Assignments (Strict Backend Guards)
    // -------------------------------------------------------------
    console.log('\nTEST 3: Backend Security & Constraint Validation Guards...');

    // 3a. Reassigning already Scheduled request
    console.log('  Testing 3a: Attempt to re-assign already Scheduled request M-127...');
    const rej1 = await post('http://localhost:3000/api/block-plans/assign', {
        requestId: 'M-127',
        blockId: recommended.blockId
    });
    assert.strictEqual(rej1.status, 400, 'Should reject already Scheduled request');
    console.log('  ✓ Correctly rejected with 400:', rej1.data.error);

    // 3b. Corridor mismatch (Request M-102 is on Corridor C1, attempting assignment to B-103 on Corridor C3)
    console.log('  Testing 3b: Attempt corridor mismatch (Request M-102 on Corridor C1 vs Block B-103 on Corridor C3)...');
    const rej2 = await post('http://localhost:3000/api/block-plans/assign', {
        requestId: 'M-102',
        blockId: 'B-103'
    });
    assert.strictEqual(rej2.status, 400, 'Should reject corridor mismatch');
    console.log('  ✓ Correctly rejected with 400:', rej2.data.error);

    // 3c. Train conflict guard (Window B-107 on Corridor C2 overlaps with Train T310 running 14:30–17:15)
    console.log('  Testing 3c: Attempt to assign to window with train clash (Window B-107 clashing with Train T310)...');
    const rej3 = await post('http://localhost:3000/api/block-plans/assign', {
        requestId: 'M-101', // on Corridor C2
        blockId: 'B-107'    // on Corridor C2, overlaps with T310
    });
    assert.strictEqual(rej3.status, 400, 'Should reject assignment due to train conflict');
    console.log('  ✓ Correctly rejected with 400:', rej3.data.error);

    // 3d. Duration exceeding block capacity (Request M-101 requires 150 mins, Window B-101 has only 90 mins)
    console.log('  Testing 3d: Attempt duration exceeding block capacity (150 mins task vs 90 mins window)...');
    // Ensure M-101 is Pending for test
    const rej4 = await post('http://localhost:3000/api/block-plans/assign', {
        requestId: 'M-101',
        blockId: 'B-104' // 150 min block on C2, but let's test a smaller block or create a large duration request via API
    });
    // Let's create an oversized request via API
    const hugeRes = await post('http://localhost:3000/api/maintenance-requests', {
        work_description: 'Major Track Renewal',
        corridor: 'Corridor C2',
        location: 'KM 100 - 150',
        duration_minutes: 500,
        department: 'P-Way'
    });
    const hugeReqId = hugeRes.data.request.request_id;

    const rejDuration = await post('http://localhost:3000/api/block-plans/assign', {
        requestId: hugeReqId,
        blockId: 'B-104' // 150 min block
    });
    assert.strictEqual(rejDuration.status, 400, 'Should reject insufficient duration');
    console.log('  ✓ Correctly rejected with 400:', rejDuration.data.error);

    // Clean up temporary huge request
    await del(`http://localhost:3000/api/maintenance-requests/${hugeReqId}`);

    // -------------------------------------------------------------
    // TEST 4: Block Window Occupancy & Dashboard KPI Updates
    // -------------------------------------------------------------
    console.log('\nTEST 4: Block Window Occupancy & Dashboard Reflection...');
    const winRes = await get('http://localhost:3000/api/block-windows');
    const targetWin = winRes.data.windows.find(w => w.window_id === recommended.blockId);
    assert(targetWin, 'Target block window must be returned');
    assert(targetWin.assigned_tasks.some(t => t.request_id === 'M-127'), 'Window must list M-127 in assigned_tasks');
    assert(targetWin.occupied_minutes >= 100, 'Window occupied_minutes must reflect M-127 duration');
    console.log('✓ Block window', targetWin.window_id, 'reflects assignment: Occupancy', `${targetWin.occupied_minutes}/${targetWin.duration_minutes}m, Tasks:`, targetWin.assigned_tasks.map(t => t.request_id));

    const summary = db.getSummary();
    console.log('✓ Dashboard KPI Summary: Total Requests:', summary.totalRequests, '| Pending Maintenance:', summary.pendingMaintenance, '| Available Blocks:', summary.availableBlocks);

    // -------------------------------------------------------------
    // TEST 5: AI Explanation Check
    // -------------------------------------------------------------
    console.log('\nTEST 5: AI Decision-Support Explanation...');
    const aiRes = await post('http://localhost:3000/api/ai/chat', {
        message: `Why is ${recommended.blockId} recommended for M-127?`
    });
    assert.strictEqual(aiRes.status, 200);
    console.log('✓ AI Assistant returned explanation:\n', aiRes.data.answer);

    // -------------------------------------------------------------
    // TEST 6: Coexistence with Automatic Block Planning Engine
    // -------------------------------------------------------------
    console.log('\nTEST 6: Automatic Planning Engine Coexistence...');
    const planRes = await post('http://localhost:3000/api/block-plans/generate', {
        corridor: 'Corridor C2',
        date: '2026-09-21'
    });
    assert.strictEqual(planRes.status, 200);
    assert(planRes.data.plan.scheduled_tasks.length > 0);
    console.log('✓ Automatic Block Planning Engine is fully intact: Generated Plan', planRes.data.plan.plan_id, 'with', planRes.data.plan.scheduled_tasks.length, 'scheduled tasks.');

    console.log('\n===========================================================');
    console.log('🎉 ALL AUDIT & INTEGRATION TESTS PASSED (100% SUCCESS)');
    console.log('===========================================================');
})();
