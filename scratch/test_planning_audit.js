const http = require('http');
const assert = require('assert');

function get(url) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        http.get(u, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', reject);
    });
}

function post(url, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = http.request({
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-name': 'Chief Controller (Planner)' }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

(async () => {
    console.log('=== AUDIT VERIFICATION: BLOCK PLANNING ENGINE ===\n');

    // 1. Verify planning.html HTML Structure
    const htmlRes = await get('http://localhost:3000/screens/planning.html');
    assert.strictEqual(htmlRes.status, 200, 'planning.html must be served');
    assert(htmlRes.data.includes('id="planTasksTableBody"'), 'Scheduled tasks table body must exist');
    assert(htmlRes.data.includes('id="unscheduledTasksTableBody"'), 'Unscheduled pending tasks table body must exist');
    assert(htmlRes.data.includes('Assigned Block ID'), 'Assigned Block ID header must exist');
    assert(htmlRes.data.includes('Reason for Selection'), 'Reason for Selection header must exist');
    assert(htmlRes.data.includes('Remaining Pending Work Orders'), 'Remaining Pending Work Orders section must exist');
    console.log('✓ UI Verification: HTML headers, tables, and IDs verified.');

    // 2. Generate Plan for Corridor C2
    const genRes = await post('http://localhost:3000/api/block-plans/generate', { corridor: 'Corridor C2', date: '2026-09-21' });
    assert.strictEqual(genRes.status, 200);
    const plan = genRes.data.plan;
    console.log(`✓ Generated Plan ${plan.plan_id} on window ${plan.block_id} (${plan.start_time} - ${plan.end_time})`);
    console.log(`  Scheduled: ${plan.scheduled_tasks.length}, Unscheduled: ${plan.unscheduled_tasks.length}`);

    // Verify scheduled task fields
    assert(plan.scheduled_tasks.length > 0, 'Should have scheduled tasks');
    plan.scheduled_tasks.forEach((t, i) => {
        assert(t.request_id, 'Request ID required');
        assert(t.department, 'Department required');
        assert(t.corridor, 'Corridor required');
        assert(t.duration_minutes, 'Duration required');
        assert(t.priority, 'Priority required');
        assert(t.assigned_block_id, 'Assigned Block ID required');
        assert(t.start_time, 'Start time required');
        assert(t.end_time, 'End time required');
        assert(t.reason_for_selection, 'Reason for selection required');
        console.log(`  [Task ${i+1}] ${t.request_id} (${t.department}) in ${t.assigned_block_id} [${t.start_time} - ${t.end_time}] - Reason: ${t.reason_for_selection}`);
    });

    // Verify departments represented
    const depts = new Set(plan.scheduled_tasks.map(t => t.department));
    console.log(`✓ Departments successfully planned: ${Array.from(depts).join(', ')}`);

    // Verify unscheduled tasks retain Pending status and explicit reason
    assert(plan.unscheduled_tasks.length > 0, 'Unscheduled tasks should be reported');
    plan.unscheduled_tasks.slice(0, 3).forEach((u, i) => {
        assert.strictEqual(u.status, 'Pending', 'Unscheduled task must remain Pending');
        assert(u.reason && u.reason.length > 0, 'Must have explicit reason');
        console.log(`  [Unscheduled ${i+1}] ${u.request_id} (${u.department}) - Status: ${u.status}, Reason: ${u.reason}`);
    });

    // 3. Approve Plan
    const appRes = await post('http://localhost:3000/api/block-plans/approve', {});
    assert.strictEqual(appRes.status, 200);
    assert.strictEqual(appRes.data.plan.status, 'Approved');
    console.log(`✓ Plan Approved by ${appRes.data.plan.approved_by}`);

    // Verify DB states after approval
    const db = require('../server/db');
    plan.scheduled_tasks.forEach(t => {
        const req = db.getRequestById(t.request_id);
        assert.strictEqual(req.status, 'Scheduled', 'Task in DB must become Scheduled after plan approval');
        assert.strictEqual(req.block_id, t.assigned_block_id);
        assert.strictEqual(req.scheduled_slot, `${t.start_time} – ${t.end_time}`);
    });
    console.log('✓ Verified: Planned tasks transitioned from Pending -> Scheduled in database.');

    plan.unscheduled_tasks.forEach(u => {
        const req = db.getRequestById(u.request_id);
        assert.strictEqual(req.status, 'Pending', 'Unscheduled task in DB must remain Pending');
        assert(req.unscheduled_reason, 'Must store unscheduled reason');
    });
    console.log('✓ Verified: Unscheduled tasks remain Pending with explicit reasons in database.');

    console.log('\n=== ALL AUDIT CHECKS PASSED SUCCESSFULLY ===');
})();
