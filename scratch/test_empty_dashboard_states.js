/**
 * RAKSHA BLOCK - Comprehensive Test Suite for Dashboard Empty States and Planner Actions
 * Validates TEST A, TEST B, TEST C, TEST D, and Quick Actions
 */

const { supabase } = require('../server/supabaseClient');
const API_BASE = 'http://localhost:3000';

async function api(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    return {
        status: res.status,
        body: await res.json().catch(() => ({}))
    };
}

async function cleanOperationalTables() {
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
        'block_windows',
        'trains',
        'maintenance_requests'
    ];

    for (const table of tables) {
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw new Error(`Clean ${table} error: ${error.message}`);
    }

    // Trigger sync in server db
    await api('/api/sync', { method: 'POST' });
}

async function runTests() {
    console.log('====================================================');
    console.log('STARTING RAKSHA BLOCK DASHBOARD STATE TESTS');
    console.log('====================================================\n');

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
    // TEST A: Completely empty operational database
    // ----------------------------------------------------
    console.log('--- TEST A: Completely Empty Operational Database (0 Requests, 0 Blocks) ---');
    await cleanOperationalTables();

    const repA = await api('/api/reports');
    assert(repA.body.pendingMaintenance === 0, 'KPI Pending Maintenance = 0');
    assert(repA.body.highPriority === 0, 'KPI High Priority = 0');
    assert(repA.body.availableBlocks === 0, 'KPI Available Blocks = 0');
    assert(repA.body.activeConflicts === 0, 'KPI Active Conflicts = 0');

    const recA = await api('/api/block-plans/recommended');
    assert(recA.body.hasRecommendation === false, 'hasRecommendation is false');
    assert(recA.body.state === 'NO_DATA', 'State is NO_DATA');
    assert(recA.body.corridor === null, 'Corridor is NULL (NO C2 / NO hardcoded corridor)');
    assert(recA.body.block_id === null, 'Block ID is NULL (NO fake block / NO BLOCK)');
    assert(recA.body.date === null, 'Date is NULL (NO fake Target Date: Today)');
    assert(recA.body.title === 'No recommendation available yet', 'Title matches required message');

    // ----------------------------------------------------
    // TEST B: 1 Request exists, 0 Blocks
    // ----------------------------------------------------
    console.log('\n--- TEST B: Request Exists, No Block Windows (1 Request, 0 Blocks) ---');
    // Fetch corridor C1 and department P-Way IDs
    const { data: c1 } = await supabase.from('corridors').select('*').eq('code', 'C1').single();
    const { data: pway } = await supabase.from('departments').select('*').eq('code', 'P-Way').single();
    const { data: rohan } = await supabase.from('profiles').select('*').eq('employee_id', 'EMP001').single();

    const { data: newReq, error: reqErr } = await supabase.from('maintenance_requests').insert({
        request_code: 'M-TEST-01',
        department_id: pway.id,
        corridor_id: c1.id,
        submitted_by: rohan.id,
        location: 'KM 12/4',
        work_description: 'Ultrasonic rail testing',
        duration_minutes: 60,
        priority_level: 'High',
        priority_score: 85,
        status: 'Pending'
    }).select().single();

    if (reqErr) throw reqErr;

    // Trigger sync in server
    await api('/api/sync', { method: 'POST' });

    const recB = await api('/api/block-plans/recommended');
    assert(recB.body.hasRecommendation === false, 'hasRecommendation is false');
    assert(recB.body.state === 'NO_WINDOWS', 'State is NO_WINDOWS');
    assert(recB.body.title === 'No block recommendation available yet', 'Title reflects window requirement');
    assert(recB.body.corridor === 'Corridor C1', 'Corridor is derived from the real request (Corridor C1, NOT C2)');
    assert(recB.body.block_id === null, 'Block ID is NULL');
    assert(recB.body.date === null, 'Date is NULL');

    // ----------------------------------------------------
    // TEST C: Request + Block exist and are Feasible
    // ----------------------------------------------------
    console.log('\n--- TEST C: Request + Feasible Block Window Exist ---');
    const { data: newWin, error: winErr } = await supabase.from('block_windows').insert({
        block_code: 'B-TEST-C1',
        corridor_id: c1.id,
        start_time: '10:00:00',
        end_time: '12:00:00',
        duration_minutes: 120,
        status: 'Available'
    }).select().single();

    if (winErr) throw winErr;

    // Trigger sync in server
    await api('/api/sync', { method: 'POST' });

    const recC = await api('/api/block-plans/recommended');
    assert(recC.body.hasRecommendation === true, 'hasRecommendation is true');
    assert(recC.body.state === 'RECOMMENDED', 'State is RECOMMENDED');
    assert(recC.body.block_id === 'B-TEST-C1', 'Actual recommended block ID is B-TEST-C1');
    assert(recC.body.corridor === 'Corridor C1', 'Actual corridor is Corridor C1');
    assert(recC.body.start_time === '10:00', 'Actual start time matches window');
    assert(recC.body.end_time === '12:00', 'Actual end time matches window');
    assert(recC.body.scheduled_tasks.length === 1, 'Task M-TEST-01 was scheduled in block');

    // ----------------------------------------------------
    // TEST D: Requests and Blocks exist but No Feasible combination
    // ----------------------------------------------------
    console.log('\n--- TEST D: Request Duration Exceeds Window (Infeasible Recommendation) ---');
    // Update request duration to 300 minutes (exceeds 120 minutes window)
    await supabase.from('maintenance_requests').update({
        duration_minutes: 300
    }).eq('id', newReq.id);

    // Sync
    await api('/api/sync', { method: 'POST' });

    const recD = await api('/api/block-plans/recommended');
    assert(recD.body.hasRecommendation === false, 'hasRecommendation is false when no tasks can fit');
    assert(recD.body.state === 'NO_FEASIBLE', 'State is NO_FEASIBLE');
    assert(recD.body.title === 'No suitable block found', 'Title is No suitable block found');
    assert(recD.body.corridor === 'Corridor C1', 'Corridor is from real data (Corridor C1)');
    assert(recD.body.block_id === null, 'Block ID is NULL in infeasible state');

    // ----------------------------------------------------
    // Clean up operational data back to 0 rows
    // ----------------------------------------------------
    console.log('\n--- Resetting Operational Database to 0 Rows ---');
    await cleanOperationalTables();
    await new Promise(r => setTimeout(r, 1000));
    const finalRec = await api('/api/block-plans/recommended');
    assert(finalRec.body.hasRecommendation === false, 'Final check: DB is clean, hasRecommendation is false');
    assert(finalRec.body.corridor === null, 'Final check: corridor is null');

    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
