const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const lines = env.split('\n');
let url = '', key = '';
lines.forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('groom_offers').select('*').eq('offer_id', 'GrO-0001-598').maybeSingle();
  console.log("MAYBE SINGLE:", JSON.stringify({data, error}));
  
  const { data: data2, error: error2 } = await supabase.from('groom_offers').select('*');
  console.log("ALL DATA (count):", data2 ? data2.length : 0);
  console.log("FIRST:", data2 ? data2[0] : null);
}

run();
