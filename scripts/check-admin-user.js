const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local file
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function checkAdminUser() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';

  console.log('\n=== Checking Admin User ===');
  console.log('Looking for username:', username);

  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('username', username.toLowerCase())
    .single();

  if (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'PGRST116') {
      console.error('User not found!');
    }
    process.exit(1);
  }

  if (!data) {
    console.error('\n❌ User not found!');
    process.exit(1);
  }

  console.log('\n✅ User found!');
  console.log('\nUser details:');
  console.log('  ID:', data.id);
  console.log('  Username:', data.username);
  console.log('  Username (lowercase):', data.username?.toLowerCase());
  console.log('  Is Active:', data.is_active);
  console.log('  Is Super Admin:', data.is_super_admin);
  console.log('  Has Password Hash:', !!data.password_hash);
  console.log('  Password Hash Length:', data.password_hash?.length || 0);
  console.log('  Password Hash (first 30 chars):', data.password_hash?.substring(0, 30) || 'N/A');

  if (data.password_hash) {
    console.log('\nTesting password:', password);
    const match = await bcrypt.compare(password, data.password_hash);
    console.log('  Password Match:', match ? '✅ YES' : '❌ NO');
    
    if (!match) {
      console.log('\n⚠️  Password does not match!');
      console.log('The password hash in the database does not match the provided password.');
      console.log('\nTo fix this, you can:');
      console.log('  1. Delete the existing user and create a new one');
      console.log('  2. Or update the password_hash manually');
    }
  } else {
    console.log('\n⚠️  No password hash found!');
  }

  console.log('\n');
}

checkAdminUser().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

