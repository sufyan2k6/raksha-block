require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://jioijxntplzlgmqdgvlg.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
        console.log('⚡ Supabase client initialized for:', supabaseUrl);
    } catch (err) {
        console.error('⚠️ Failed to initialize Supabase client:', err.message);
    }
} else {
    console.warn('⚠️ Supabase credentials missing from environment.');
}

module.exports = { supabase };
