const { supabase } = require('../server/supabaseClient');

const BASE_URL = 'http://localhost:3000';

async function req(url, options = {}) {
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
    return {
        status: res.status,
        ok: res.ok,
        data
    };
}

async function runRegressionTests() {
    console.log('========================================================');
    console.log('🛡️ RAKSHA BLOCK — RBAC & DATABASE INTEGRITY REGRESSION TEST');
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

    // 1. Initial Database Count Check
    console.log('--- 1. AUDITING SUPABASE RELATIONAL DATABASE ---');
    const { count: reqCountBefore } = await supabase.from('maintenance_requests').select('*', { count: 'exact', head: true });
    const { count: trainCount } = await supabase.from('trains').select('*', { count: 'exact', head: true });
    const { count: windowCount } = await supabase.from('block_windows').select('*', { count: 'exact', head: true });
    const { count: deptCount } = await supabase.from('departments').select('*', { count: 'exact', head: true });

    console.log(`  Supabase initial: requests=${reqCountBefore}, trains=${trainCount}, windows=${windowCount}, depts=${deptCount}`);
    assert(deptCount === 4, 'Departments table intact (4 departments)');
    assert(trainCount >= 10, 'Trains table intact');
    assert(windowCount >= 8, 'Block windows table intact');

    // 2. Authentication Test
    console.log('\n--- 2. AUTHENTICATION OF ROLES ---');
    const plannerLogin = await req(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        body: { employee_id: 'EMP001', password: 'planner123' }
    });
    assert(plannerLogin.data.success && plannerLogin.data.user.role === 'Railway Planner', 'EMP001 logs in as Railway Planner');

    const pwayLogin = await req(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        body: { employee_id: 'EMP002', password: 'pway123' }
    });
    assert(pwayLogin.data.success && pwayLogin.data.user.department === 'P-Way', 'EMP002 logs in as P-Way Senior Section Engineer');

    const stLogin = await req(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        body: { employee_id: 'EMP003', password: 'st123' }
    });
    assert(stLogin.data.success && stLogin.data.user.department === 'S&T', 'EMP003 logs in as S&T Engineer');

    const trdLogin = await req(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        body: { employee_id: 'EMP004', password: 'trd123' }
    });
    assert(trdLogin.data.success && trdLogin.data.user.department === 'TRD', 'EMP004 logs in as TRD Engineer');

    // 3. Planner Role Permissions Check
    console.log('\n--- 3. EMP001 (RAILWAY PLANNER) PERMISSIONS ---');
    const plannerHeaders = {
        'x-user-id': 'EMP001',
        'x-user-role': 'Railway Planner',
        'x-user-department': 'Operations',
        'Authorization': `Bearer ${plannerLogin.data.token}`
    };

    // Planner: Dashboard
    const pDash = await req(`${BASE_URL}/api/dashboard/summary`, { headers: plannerHeaders });
    assert(pDash.status === 200, 'Planner can access Dashboard Summary');

    // Planner: Maintenance Requests
    const pReqs = await req(`${BASE_URL}/api/maintenance-requests`, { headers: plannerHeaders });
    assert(pReqs.status === 200 && pReqs.data.requests.length > 0, `Planner sees all maintenance requests (${pReqs.data.requests.length} loaded)`);

    // Planner: Priority Analysis
    const pPrio = await req(`${BASE_URL}/api/priority`, { headers: plannerHeaders });
    assert(pPrio.status === 200, 'Planner can access Priority Analysis API');

    // Planner: Conflict Detection
    const pConf = await req(`${BASE_URL}/api/conflicts`, { headers: plannerHeaders });
    assert(pConf.status === 200, 'Planner can access Conflicts API');

    // Planner: Find Block (Suitable Blocks)
    const pSuitable = await req(`${BASE_URL}/api/block-plans/suitable-blocks/M-127`, { headers: plannerHeaders });
    assert(pSuitable.status === 200 && Array.isArray(pSuitable.data.candidates), 'Planner can evaluate suitable blocks for M-127');

    // Planner: What-If Simulation
    const pWhatIf = await req(`${BASE_URL}/api/what-if`, {
        method: 'POST',
        headers: plannerHeaders,
        body: { corridor: 'Corridor C2', startTime: '14:00', duration_minutes: 120 }
    });
    assert(pWhatIf.status === 200, 'Planner can run What-If Simulation');

    // Planner: Block Plan Generation & Approval
    const pGen = await req(`${BASE_URL}/api/block-plans/generate`, {
        method: 'POST',
        headers: plannerHeaders,
        body: { corridor: 'Corridor C2' }
    });
    assert(pGen.status === 200, 'Planner can generate Block Plan');

    const pApprove = await req(`${BASE_URL}/api/block-plans/approve`, {
        method: 'POST',
        headers: plannerHeaders
    });
    assert(pApprove.status === 200, 'Planner can approve Block Plan');

    // Planner: NEGATIVE TEST — Planners cannot submit field maintenance requests!
    const plannerCreate = await req(`${BASE_URL}/api/maintenance-requests`, {
        method: 'POST',
        headers: plannerHeaders,
        body: {
            work_description: 'Planner Illegal Request',
            corridor: 'Corridor C1',
            location: 'Station A',
            duration_minutes: 60
        }
    });
    assert(plannerCreate.status === 403, 'Planner submission blocked with 403 Forbidden as required');

    // 4. Department Engineer Permissions Check (EMP002 P-Way)
    console.log('\n--- 4. EMP002 (P-WAY ENGINEER) PERMISSIONS ---');
    const pwayHeaders = {
        'x-user-id': 'EMP002',
        'x-user-role': 'Senior Section Engineer',
        'x-user-department': 'P-Way',
        'Authorization': `Bearer ${pwayLogin.data.token}`
    };

    // P-Way: View Requests (Scoped to P-Way)
    const pwayReqs = await req(`${BASE_URL}/api/maintenance-requests`, { headers: pwayHeaders });
    assert(pwayReqs.status === 200, 'P-Way engineer can access Maintenance Requests');
    const nonPway = pwayReqs.data.requests.filter(r => r.department !== 'P-Way');
    assert(nonPway.length === 0, `P-Way view is scoped to P-Way requests only (0 non-P-Way requests)`);

    // P-Way: POSITIVE TEST — Submit New Request
    const newWorkDesc = `P-Way Ultrasonic Rail Flaw Testing - ${Date.now()}`;
    const pwayCreate = await req(`${BASE_URL}/api/maintenance-requests`, {
        method: 'POST',
        headers: pwayHeaders,
        body: {
            work_description: newWorkDesc,
            location: 'KM 142/8',
            corridor: 'Corridor C2',
            duration_minutes: 90,
            urgency: 'High',
            asset: 'Track Rails'
        }
    });
    assert(pwayCreate.status === 201 && pwayCreate.data.request.department === 'P-Way', 'P-Way engineer creates request with server-enforced P-Way department');
    const createdReqId = pwayCreate.data.request.request_id;

    // P-Way: NEGATIVE TESTS — Planners endpoints MUST return 403 Forbidden!
    console.log('\n--- 5. EMP002 FORBIDDEN PLANNER ENDPOINTS (ZERO-TRUST SECURITY) ---');
    
    // Test 1: Find Block
    const pwaySuitable = await req(`${BASE_URL}/api/block-plans/suitable-blocks/${createdReqId}`, { headers: pwayHeaders });
    assert(pwaySuitable.status === 403, 'P-Way blocked from suitable-blocks (403 Forbidden)');

    // Test 2: Assign Block
    const pwayAssign = await req(`${BASE_URL}/api/block-plans/assign`, {
        method: 'POST',
        headers: pwayHeaders,
        body: { requestId: createdReqId, blockId: 'B-102' }
    });
    assert(pwayAssign.status === 403, 'P-Way blocked from block assign (403 Forbidden)');

    // Test 3: Generate Plan
    const pwayGen = await req(`${BASE_URL}/api/block-plans/generate`, {
        method: 'POST',
        headers: pwayHeaders,
        body: { corridor: 'Corridor C2' }
    });
    assert(pwayGen.status === 403, 'P-Way blocked from block-plans/generate (403 Forbidden)');

    // Test 4: Approve Plan
    const pwayApprove = await req(`${BASE_URL}/api/block-plans/approve`, {
        method: 'POST',
        headers: pwayHeaders
    });
    assert(pwayApprove.status === 403, 'P-Way blocked from block-plans/approve (403 Forbidden)');

    // Test 5: Reject Plan
    const pwayReject = await req(`${BASE_URL}/api/block-plans/reject`, {
        method: 'POST',
        headers: pwayHeaders
    });
    assert(pwayReject.status === 403, 'P-Way blocked from block-plans/reject (403 Forbidden)');

    // Test 6: Create Block Window
    const pwayWindow = await req(`${BASE_URL}/api/block-windows`, {
        method: 'POST',
        headers: pwayHeaders,
        body: { corridor: 'Corridor C2', start_time: '10:00', end_time: '12:00' }
    });
    assert(pwayWindow.status === 403, 'P-Way blocked from creating block window (403 Forbidden)');

    // Test 7: Resolve Conflict
    const pwayConflict = await req(`${BASE_URL}/api/conflicts/1/resolve`, {
        method: 'PATCH',
        headers: pwayHeaders
    });
    assert(pwayConflict.status === 403, 'P-Way blocked from resolving conflict (403 Forbidden)');

    // Test 8: Coordination Bundle
    const pwayBundle = await req(`${BASE_URL}/api/coordination/1/bundle`, {
        method: 'POST',
        headers: pwayHeaders
    });
    assert(pwayBundle.status === 403, 'P-Way blocked from coordination bundle (403 Forbidden)');

    // Test 9: What-If Simulation
    const pwaySim = await req(`${BASE_URL}/api/what-if`, {
        method: 'POST',
        headers: pwayHeaders,
        body: { corridor: 'Corridor C2' }
    });
    assert(pwaySim.status === 403, 'P-Way blocked from What-If simulation (403 Forbidden)');

    // 6. S&T and TRD Roles RBAC Verification
    console.log('\n--- 6. S&T (EMP003) & TRD (EMP004) RESTRICTIONS ---');
    const stHeaders = {
        'x-user-id': 'EMP003',
        'x-user-role': 'Signal Inspector',
        'x-user-department': 'S&T',
        'Authorization': `Bearer ${stLogin.data.token}`
    };

    const stApprove = await req(`${BASE_URL}/api/block-plans/approve`, { method: 'POST', headers: stHeaders });
    assert(stApprove.status === 403, 'S&T engineer blocked from approve (403 Forbidden)');

    const trdHeaders = {
        'x-user-id': 'EMP004',
        'x-user-role': 'TRD Electrical Engineer',
        'x-user-department': 'TRD',
        'Authorization': `Bearer ${trdLogin.data.token}`
    };

    const trdGen = await req(`${BASE_URL}/api/block-plans/generate`, { method: 'POST', headers: trdHeaders });
    assert(trdGen.status === 403, 'TRD engineer blocked from generate (403 Forbidden)');

    // 7. Full Workflow: Planner Finds Block & Assigns P-Way's Request
    console.log('\n--- 7. END-TO-END WORKFLOW: PLANNER FINDS BLOCK & ASSIGNS ---');
    const suitableRes = await req(`${BASE_URL}/api/block-plans/suitable-blocks/${createdReqId}`, { headers: plannerHeaders });
    assert(suitableRes.data && suitableRes.data.candidates && suitableRes.data.candidates.length > 0, `Planner successfully found candidates for ${createdReqId}`);
    
    const viableCandidate = suitableRes.data.candidates.find(c => c.feasible);
    if (viableCandidate) {
        const assignRes = await req(`${BASE_URL}/api/block-plans/assign`, {
            method: 'POST',
            headers: plannerHeaders,
            body: { requestId: createdReqId, blockId: viableCandidate.blockId }
        });
        assert(assignRes.status === 200 && assignRes.data.success, `Planner assigned ${createdReqId} to ${viableCandidate.blockId}`);

        // Verify in database that status is Scheduled
        const updatedReqRes = await req(`${BASE_URL}/api/maintenance-requests/${createdReqId}`, { headers: plannerHeaders });
        assert(updatedReqRes.data.status === 'Scheduled', `Request ${createdReqId} status updated to Scheduled in database`);
    }

    // 8. Final Database Integrity Check
    console.log('\n--- 8. FINAL DATABASE INTEGRITY AUDIT ---');
    const { count: reqCountAfter } = await supabase.from('maintenance_requests').select('*', { count: 'exact', head: true });
    console.log(`  Supabase final requests: ${reqCountAfter} (was ${reqCountBefore})`);
    assert(reqCountAfter >= reqCountBefore, 'Database requests grew or stayed stable, ZERO records deleted unexpectedly');

    console.log('\n========================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

runRegressionTests().catch(err => {
    console.error('Unexpected test failure:', err);
    process.exit(1);
});
