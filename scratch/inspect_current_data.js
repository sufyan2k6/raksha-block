const { supabase } = require('../server/supabaseClient');

async function inspectTables() {
    const tables = [
        'departments',
        'corridors',
        'profiles',
        'assets',
        'user_preferences',
        'maintenance_requests',
        'trains',
        'block_windows',
        'block_assignments',
        'scheduled_tasks',
        'block_plans',
        'block_plan_tasks',
        'conflicts',
        'coordination_bundles',
        'coordination_bundle_tasks',
        'what_if_scenarios',
        'what_if_conflicts',
        'notifications',
        'audit_logs'
    ];

    console.log('--- SUPABASE CURRENT TABLE COUNTS ---');
    for (const table of tables) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) {
            console.log(`  ❌ ${table}: Error ${error.message}`);
        } else {
            console.log(`  ${table}: ${count} rows`);
        }
    }
}

inspectTables().catch(console.error);
