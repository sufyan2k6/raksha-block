const fs = require('fs');
const path = require('path');
const { supabase } = require('./supabaseClient');

async function syncData() {
    if (!supabase) {
        console.error('Supabase client not initialized.');
        return;
    }

    const dataStorePath = path.join(__dirname, '..', 'data_store.json');
    if (!fs.existsSync(dataStorePath)) {
        console.error('data_store.json not found');
        return;
    }

    const raw = JSON.parse(fs.readFileSync(dataStorePath, 'utf8'));
    console.log('🔄 Starting data sync to Supabase PostgreSQL...');

    // 1. Sync Trains
    if (raw.trains && raw.trains.length > 0) {
        const trainRows = raw.trains.map(t => ({
            train_id: t.train_id || t.train_number || ('T-' + t.id),
            name: t.train_name || t.name || 'Unnamed Train',
            type: t.train_type || t.type || 'Express',
            corridor: t.corridor,
            start_time: t.start_time,
            end_time: t.end_time,
            route: t.route || `${t.origin || ''} -> ${t.destination || ''}`,
            priority: t.priority || 'Normal',
            status: t.status || 'Scheduled',
            delay_minutes: t.delay_minutes || 0
        }));
        const uniqueTrains = [];
        const seenIds = new Set();
        for (const t of trainRows) {
            if (!seenIds.has(t.train_id)) {
                seenIds.add(t.train_id);
                uniqueTrains.push(t);
            }
        }
        const { error: tErr } = await supabase.from('trains').upsert(uniqueTrains, { onConflict: 'train_id' });
        if (tErr) console.error('Error syncing trains:', tErr.message);
        else console.log(`✓ Synced ${uniqueTrains.length} trains to Supabase`);
    }

    // 2. Sync Block Windows
    if (raw.windows && raw.windows.length > 0) {
        const winRows = raw.windows.map(w => ({
            window_id: w.window_id,
            corridor: w.corridor,
            start_time: w.start_time,
            end_time: w.end_time,
            duration_minutes: w.duration_minutes,
            status: w.status || 'Available',
            occupied_minutes: w.occupied_minutes || 0
        }));
        const { error: wErr } = await supabase.from('block_windows').upsert(winRows, { onConflict: 'window_id' });
        if (wErr) console.error('Error syncing block windows:', wErr.message);
        else console.log(`✓ Synced ${winRows.length} block windows to Supabase`);
    }

    // 3. Sync Maintenance Requests
    if (raw.requests && raw.requests.length > 0) {
        const reqRows = raw.requests.map(r => ({
            request_id: r.request_id,
            employee_id: r.employee_id || 'EMP001',
            submitted_by: r.submitted_by || 'Rohan Gupta',
            department: r.department,
            asset: r.asset || '',
            maintenance_type: r.maintenance_type || '',
            location: r.location || '',
            corridor: r.corridor,
            duration_minutes: r.duration_minutes,
            urgency: r.urgency || '',
            asset_risk: r.asset_risk || '',
            due_date: r.due_date || '',
            traffic_impact: r.traffic_impact || '',
            description: r.description || r.work_description,
            work_description: r.work_description || r.description,
            priority: r.priority,
            priority_reason: r.priority_reason || r.reason || '',
            reason: r.reason || r.priority_reason || '',
            status: r.status || 'Pending',
            block_id: r.block_id || null,
            assigned_block_id: r.assigned_block_id || null,
            scheduled_slot: r.scheduled_slot || null
        }));
        const { error: rErr } = await supabase.from('maintenance_requests').upsert(reqRows, { onConflict: 'request_id' });
        if (rErr) console.error('Error syncing maintenance requests:', rErr.message);
        else console.log(`✓ Synced ${reqRows.length} maintenance requests to Supabase`);
    }

    // 4. Sync Block Assignments
    if (raw.blockAssignments && raw.blockAssignments.length > 0) {
        const assignRows = raw.blockAssignments.map(a => ({
            request_id: a.request_id,
            block_id: a.block_id,
            assigned_start_time: a.assigned_start_time,
            assigned_end_time: a.assigned_end_time,
            status: a.status || 'Confirmed',
            assigned_by: a.assigned_by || 'Railway Planner',
            employee_id: a.employee_id || 'EMP001'
        }));
        const { error: aErr } = await supabase.from('block_assignments').upsert(assignRows, { onConflict: 'request_id' });
        if (aErr) console.error('Error syncing block assignments:', aErr.message);
        else console.log(`✓ Synced ${assignRows.length} block assignments to Supabase`);
    }

    console.log('🎉 Supabase synchronization completed successfully!');
}

syncData().catch(console.error);
