const bcrypt = require('bcryptjs');

// Get password from command line argument
const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/generate-password-hash.js <password>');
  process.exit(1);
}

async function generateHash() {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  console.log('\nPassword:', password);
  console.log('Hash:', hash);
  console.log('\nCopy this hash to your admin_users table password_hash column.\n');
}

generateHash().catch(console.error);

