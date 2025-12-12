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

async function updatePassword() {
  const username = process.argv[2] || 'admin';
  const newPassword = process.argv[3] || 'admin123';

  console.log('\n=== Updating Admin Password ===');
  console.log('Username:', username);
  console.log('New Password:', newPassword);

  // First, find the user
  const { data: user, error: findError } = await supabase
    .from('admin_users')
    .select('*')
    .eq('username', username.toLowerCase())
    .single();

  if (findError || !user) {
    console.error('\n❌ Error: User not found!');
    console.error(findError?.message);
    process.exit(1);
  }

  console.log('\n✅ User found:', user.id);

  // Generate new hash
  console.log('Generating password hash...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  console.log('Hash generated:', passwordHash.substring(0, 30) + '...');

  // Update the password
  console.log('Updating password in database...');
  const { data, error } = await supabase
    .from('admin_users')
    .update({ password_hash: passwordHash })
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('\n❌ Error updating password:', error.message);
    process.exit(1);
  }

  console.log('\n✅ Password updated successfully!');
  console.log('\nYou can now log in with:');
  console.log('  Username:', username);
  console.log('  Password:', newPassword);
  console.log('\n');
}

updatePassword().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

