import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getAllColumns() {
    console.log("Fetching a raw record via REST API to see all actual columns...");
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/products?select=*&limit=1`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            console.error("Failed to fetch. Status:", response.status, await response.text());
            return;
        }

        const json = await response.json();
        if (json && json.length > 0) {
            console.log("Raw columns:", Object.keys(json[0]).join(', '));
            // check if 'price' is in there
            console.log("Has 'price' column?:", Object.keys(json[0]).includes('price'));
            console.log("Has 'sale_price' column?:", Object.keys(json[0]).includes('sale_price'));
            console.log("Has 'cost_price' column?:", Object.keys(json[0]).includes('cost_price'));
            console.log("Has 'retail_price' column?:", Object.keys(json[0]).includes('retail_price'));
        }
    } catch (e) {
        console.error(e);
    }
}

getAllColumns();
