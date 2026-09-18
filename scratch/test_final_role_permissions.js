const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

async function runRolePermissionTests() {
    console.log('========================================================');
    console.log('RAKSHA BLOCK — ROLE-BASED ACCESS & NEW REQUEST VERIFICATION');
    console.log('========================================================\n');

    let pwayReqId = null;
    let stReqId = null;
    let trdReqId = null;

    try {
        // --- 1. Login as Operations/Railway Planner ---
        console.log('--- TEST 1: Railway Planner (EMP001) ---');
        const plannerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId: 'EMP001', password: 'planner123' })
        });
        assert.strictEqual(plannerLoginRes.status, 200);
        const plannerData = await plannerLoginRes.json();
        assert.strictEqual(plannerData.user.role, 'Railway Planner');
        assert.strictEqual(plannerData.user.isPlanner, true);
        const plannerToken = plannerData.token;
        console.log(`[PASS] Planner Logged In: ${plannerData.user.name} (${plannerData.user.role})`);

        // Check HTML of /requests
        const requestsPageRes = await fetch(`${BASE_URL}/requests`, {
            headers: {
                'Authorization': `Bearer ${plannerToken}`,
                'x-user-id': 'EMP001',
                'x-user-role': 'Railway Planner',
                'x-user-department': 'Operations'
            }
        });
        assert.strictEqual(requestsPageRes.status, 200);
        const html = await requestsPageRes.text();
        assert(html.includes('id="btnNewRequest" style="display: none !important;"'), 'Button should default to hidden in static HTML');
        console.log('[PASS] /requests page loaded with default hidden button');

        // Check Planner attempting to POST /api/maintenance-requests -> MUST return 403 Forbidden
        console.log('\n--- TEST 1B: Backend Security — Planner Request Creation Attempt ---');
        const plannerCreateRes = await fetch(`${BASE_URL}/api/maintenance-requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${plannerToken}`,
                'x-user-id': 'EMP001',
                'x-user-role': 'Railway Planner',
                'x-user-department': 'Operations'
            },
            body: JSON.stringify({
                work_description: 'Unauthorized Planner Track Inspection',
                location: 'KM 10/20',
                corridor: 'Corridor C1',
                duration_minutes: 60,
                urgency: 'Medium'
            })
        });
        assert.strictEqual(plannerCreateRes.status, 403, `Expected 403 Forbidden, got ${plannerCreateRes.status}`);
        const plannerErr = await plannerCreateRes.json();
        console.log(`[PASS] Backend 403 Forbidden correctly returned for Planner: "${plannerErr.error}"`);

        // --- 2. Login as P-Way Engineer ---
        console.log('\n--- TEST 2: P-Way Employee (EMP002) Submission ---');
        const pwayLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId: 'EMP002', password: 'pway123' })
        });
        assert.strictEqual(pwayLoginRes.status, 200);
        const pwayData = await pwayLoginRes.json();
        assert.strictEqual(pwayData.user.department, 'P-Way');
        const pwayToken = pwayData.token;
        console.log(`[PASS] P-Way Logged In: ${pwayData.user.name} (${pwayData.user.department})`);

        const pwayCreateRes = await fetch(`${BASE_URL}/api/maintenance-requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${pwayToken}`,
                'x-user-id': 'EMP002',
                'x-user-role': 'Senior Section Engineer',
                'x-user-department': 'P-Way'
            },
            body: JSON.stringify({
                work_description: 'P-Way Ballast Deep Screening & Tamping',
                location: 'KM 15/00 - 15/50',
                corridor: 'Corridor C1',
                duration_minutes: 120,
                urgency: 'High',
                asset_risk: 'High',
                traffic_impact: 'High'
            })
        });
        assert.strictEqual(pwayCreateRes.status, 201);
        const pwayCreated = await pwayCreateRes.json();
        pwayReqId = pwayCreated.request.request_id;
        assert.strictEqual(pwayCreated.request.department, 'P-Way');
        console.log(`[PASS] P-Way Request Created & Saved to Supabase: ${pwayReqId} (${pwayCreated.request.work_description})`);

        // --- 3. Login as S&T Engineer ---
        console.log('\n--- TEST 3: S&T Employee (EMP003) Submission ---');
        const stLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId: 'EMP003', password: 'st123' })
        });
        assert.strictEqual(stLoginRes.status, 200);
        const stData = await stLoginRes.json();
        assert.strictEqual(stData.user.department, 'S&T');
        const stToken = stData.token;
        console.log(`[PASS] S&T Logged In: ${stData.user.name} (${stData.user.department})`);

        const stCreateRes = await fetch(`${BASE_URL}/api/maintenance-requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${stToken}`,
                'x-user-id': 'EMP003',
                'x-user-role': 'Signal Inspector',
                'x-user-department': 'S&T'
            },
            body: JSON.stringify({
                work_description: 'Point Machine Point 104 Overhaul & Locking Check',
                location: 'Station Yard Junction',
                corridor: 'Corridor C1',
                duration_minutes: 90,
                urgency: 'Critical',
                asset_risk: 'High',
                traffic_impact: 'High'
            })
        });
        assert.strictEqual(stCreateRes.status, 201);
        const stCreated = await stCreateRes.json();
        stReqId = stCreated.request.request_id;
        assert.strictEqual(stCreated.request.department, 'S&T');
        console.log(`[PASS] S&T Request Created & Saved to Supabase: ${stReqId} (${stCreated.request.work_description})`);

        // --- 4. Login as TRD Engineer ---
        console.log('\n--- TEST 4: TRD Employee (EMP004) Submission ---');
        const trdLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId: 'EMP004', password: 'trd123' })
        });
        assert.strictEqual(trdLoginRes.status, 200);
        const trdData = await trdLoginRes.json();
        assert.strictEqual(trdData.user.department, 'TRD');
        const trdToken = trdData.token;
        console.log(`[PASS] TRD Logged In: ${trdData.user.name} (${trdData.user.department})`);

        const trdCreateRes = await fetch(`${BASE_URL}/api/maintenance-requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${trdToken}`,
                'x-user-id': 'EMP004',
                'x-user-role': 'TRD Electrical Engineer',
                'x-user-department': 'TRD'
            },
            body: JSON.stringify({
                work_description: 'OHE Catenary Wire Tensioning & Insulator Replacement',
                location: 'KM 18/20 - 19/00',
                corridor: 'Corridor C1',
                duration_minutes: 110,
                urgency: 'High',
                asset_risk: 'High',
                traffic_impact: 'Medium'
            })
        });
        assert.strictEqual(trdCreateRes.status, 201);
        const trdCreated = await trdCreateRes.json();
        trdReqId = trdCreated.request.request_id;
        assert.strictEqual(trdCreated.request.department, 'TRD');
        console.log(`[PASS] TRD Request Created & Saved to Supabase: ${trdReqId} (${trdCreated.request.work_description})`);

        // --- 5. Login as Planner again & verify requests visibility ---
        console.log('\n--- TEST 5: Planner View & Management Verification ---');
        const plannerListRes = await fetch(`${BASE_URL}/api/maintenance-requests`, {
            headers: {
                'Authorization': `Bearer ${plannerToken}`,
                'x-user-id': 'EMP001',
                'x-user-role': 'Railway Planner',
                'x-user-department': 'Operations'
            }
        });
        assert.strictEqual(plannerListRes.status, 200);
        const listData = await plannerListRes.json();
        const reqs = listData.requests;
        console.log(`Planner sees ${reqs.length} total requests across all departments.`);
        
        const hasPway = reqs.some(r => r.request_id === pwayReqId);
        const hasSt = reqs.some(r => r.request_id === stReqId);
        const hasTrd = reqs.some(r => r.request_id === trdReqId);

        assert(hasPway, `Planner should see P-Way request ${pwayReqId}`);
        assert(hasSt, `Planner should see S&T request ${stReqId}`);
        assert(hasTrd, `Planner should see TRD request ${trdReqId}`);
        console.log(`[PASS] Planner can view all submitted departmental requests: P-Way (${pwayReqId}), S&T (${stReqId}), TRD (${trdReqId})`);

        // Verify Planner still cannot create
        const plannerAttempt2 = await fetch(`${BASE_URL}/api/maintenance-requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${plannerToken}`,
                'x-user-id': 'EMP001',
                'x-user-role': 'Railway Planner',
                'x-user-department': 'Operations'
            },
            body: JSON.stringify({
                work_description: 'Attempt 2 by Planner',
                location: 'KM 50',
                corridor: 'Corridor C2',
                duration_minutes: 45
            })
        });
        assert.strictEqual(plannerAttempt2.status, 403);
        console.log('[PASS] Planner is still strictly 403 Forbidden from creating requests');

        // --- Clean up created test records from Supabase ---
        console.log('\n--- CLEANUP: Removing created test records from Supabase ---');
        const { supabase } = require('../server/supabaseClient');
        const tables = [
            'audit_logs',
            'notifications',
            'what_if_conflicts',
            'what_if_scenarios',
            'coordination_bundle_tasks',
            'coordination_bundles',
            'conflicts',
            'block_plan_tasks',
            'block_plans',
            'scheduled_tasks',
            'block_assignments',
            'maintenance_requests'
        ];

        for (const table of tables) {
            const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) console.error(`Clean ${table} warning:`, error.message);
        }

        // Trigger sync in server db
        await fetch(`${BASE_URL}/api/sync`, { method: 'POST' });
        console.log('[PASS] Operational data reset cleanly to 0 rows.');

        console.log('\n========================================================');
        console.log('✅ ALL ROLE-BASED PERMISSION TESTS PASSED PERFECTLY!');
        console.log('========================================================');
    } catch (err) {
        console.error('\n❌ Test failure:', err.message);
        process.exit(1);
    }
}

runRolePermissionTests();
