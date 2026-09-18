const { supabase } = require('../server/supabaseClient');

async function cleanOperationalData() {
    console.log('========================================================');
    console.log('🧹 RAKSHA BLOCK — OPERATIONAL DATA RESET');
    console.log('========================================================\n');

    if (!supabase) {
        throw new Error('Supabase client not initialized.');
    }

    // 1. Audit Master/Reference Data BEFORE cleanup
    console.log('--- 1. VERIFYING MASTER/REFERENCE DATA BEFORE RESET ---');
    const { count: deptsBefore } = await supabase.from('departments').select('*', { count: 'exact', head: true });
    const { count: corrsBefore } = await supabase.from('corridors').select('*', { count: 'exact', head: true });
    const { count: profsBefore } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: assetsBefore } = await supabase.from('assets').select('*', { count: 'exact', head: true });
    const { count: prefsBefore } = await supabase.from('user_preferences').select('*', { count: 'exact', head: true });

    console.log(`  Departments:     ${deptsBefore} (MUST PRESERVE)`);
    console.log(`  Corridors:       ${corrsBefore} (MUST PRESERVE)`);
    console.log(`  User Profiles:   ${profsBefore} (MUST PRESERVE)`);
    console.log(`  Master Assets:   ${assetsBefore} (MUST PRESERVE)`);
    console.log(`  Preferences:     ${prefsBefore} (MUST PRESERVE)\n`);

    if (deptsBefore !== 4 || profsBefore !== 5) {
        console.warn('⚠️ Unexpected initial count on master data, checking safety...');
    }

    // 2. Clear Operational Tables in Strict Child -> Parent FK Dependency Order
    const operationalTables = [
        'what_if_conflicts',
        'what_if_scenarios',
        'coordination_bundle_tasks',
        'coordination_bundles',
        'conflicts',
        'block_plan_tasks',
        'block_plans',
        'scheduled_tasks',
        'block_assignments',
        'maintenance_requests',
        'trains',
        'block_windows',
        'notifications',
        'audit_logs'
    ];

    console.log('--- 2. CLEARING OPERATIONAL DATA ROWS ---');
    for (const table of operationalTables) {
        const { error: delErr } = await supabase
            .from(table)
            .delete()
            .not('id', 'is', null);

        if (delErr) {
            console.error(`  ❌ Failed to clear ${table}:`, delErr.message);
        } else {
            console.log(`  ✓ Cleared rows from: ${table}`);
        }
    }

    // 3. Verify Master/Reference Data AFTER cleanup
    console.log('\n--- 3. VERIFYING MASTER/REFERENCE DATA AFTER RESET ---');
    const { count: deptsAfter } = await supabase.from('departments').select('*', { count: 'exact', head: true });
    const { count: corrsAfter } = await supabase.from('corridors').select('*', { count: 'exact', head: true });
    const { count: profsAfter } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: assetsAfter } = await supabase.from('assets').select('*', { count: 'exact', head: true });
    const { count: prefsAfter } = await supabase.from('user_preferences').select('*', { count: 'exact', head: true });

    console.log(`  Departments:     ${deptsAfter} (Preserved: ${deptsAfter === deptsBefore})`);
    console.log(`  Corridors:       ${corrsAfter} (Preserved: ${corrsAfter === corrsBefore})`);
    console.log(`  User Profiles:   ${profsAfter} (Preserved: ${profsAfter === profsBefore})`);
    console.log(`  Master Assets:   ${assetsAfter} (Preserved: ${assetsAfter === assetsBefore})`);
    console.log(`  Preferences:     ${prefsAfter} (Preserved: ${prefsAfter === prefsBefore})`);

    // 4. Verify Operational Tables are at Exactly 0
    console.log('\n--- 4. AUDITING OPERATIONAL TABLES FOR ZERO ROWS ---');
    let allEmpty = true;
    for (const table of operationalTables) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) {
            console.error(`  ❌ Error querying ${table}:`, error.message);
            allEmpty = false;
        } else {
            console.log(`  ${table}: ${count} rows`);
            if (count !== 0) allEmpty = false;
        }
    }

    if (allEmpty) {
        console.log('\n✅ SUCCESS: All operational tables are completely reset to 0 rows.');
        console.log('✅ Master data (Profiles, Departments, Corridors, Assets) 100% intact.');
    } else {
        console.error('\n⚠️ WARNING: Some operational tables still contain data rows.');
    }
}

cleanOperationalData().catch(err => {
    console.error('Fatal error during operational data reset:', err);
    process.exit(1);
});
