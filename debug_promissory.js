
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Try to load env from .env.local
try {
    const envConfig = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '.env.local')));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} catch (e) {
    console.log('Could not load .env.local');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    console.log('Testing Promissory Notes Query...');

    const { data, error } = await supabase
        .from('promissory_notes')
        .select('*, customers(name, phone), installments:promissory_note_installments(*)')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('FULL ERROR:', JSON.stringify(error, null, 2));
        console.error('Error Message:', error.message);
        console.error('Error Code:', error.code);
        console.error('Error Hint:', error.hint);
        console.error('Error Details:', error.details);
    } else {
        console.log('Success! Data:', data?.length);
    }
}

testQuery();
