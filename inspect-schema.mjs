import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectProducts() {
    console.log("Fetching one product from Supabase to inspect its raw schema...");
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Supabase Error:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Raw Product JSON Schema:");
        console.log(Object.keys(data[0]));
        console.log("Full Object:");
        console.log(JSON.stringify(data[0], null, 2));
    } else {
        console.log("No products found.");
    }
}

inspectProducts();
