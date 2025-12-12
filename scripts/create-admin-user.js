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
  console.error('Make sure .env.local has:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function createAdminUser() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';
  const isSuperAdmin = process.argv[4] !== 'false';

  console.log('\n=== Creating Admin User ===');
  console.log('Username:', username);
  console.log('Password:', password);
  console.log('Super Admin:', isSuperAdmin);
  console.log('\nGenerating password hash...');

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  console.log('Hash generated:', passwordHash.substring(0, 30) + '...');

  console.log('\nInserting into database...');

  const { data, error } = await supabase
    .from('admin_users')
    .insert({
      username: username.toLowerCase(),
      password_hash: passwordHash,
      is_super_admin: isSuperAdmin,
      is_active: true,
      permissions: {},
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      console.error('\n❌ Error: Username already exists!');
      console.error('Try a different username or delete the existing user first.');
    } else {
      console.error('\n❌ Error creating user:', error.message);
      console.error('Full error:', error);
    }
    process.exit(1);
  }

  console.log('\n✅ Admin user created successfully!');
  console.log('\nUser details:');
  console.log('  ID:', data.id);
  console.log('  Username:', data.username);
  console.log('  Super Admin:', data.is_super_admin);
  console.log('  Active:', data.is_active);
  console.log('\nYou can now log in with:');
  console.log('  Username:', username);
  console.log('  Password:', password);
  console.log('\n');
}

createAdminUser().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

