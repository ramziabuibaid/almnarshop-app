import { createClient } from '@supabase/supabase-js';

// Get Supabase URL and Anon Key from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Better error handling with detailed messages
if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  const errorMessage = `
❌ Missing Supabase environment variables: ${missingVars.join(', ')}

Please check your .env.local file in the project root directory.

Required variables:
  - NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
  - NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

To get these values:
  1. Go to https://app.supabase.com
  2. Select your project
  3. Go to Settings → API
  4. Copy the Project URL and anon/public key

After adding the variables, restart the development server.
  `.trim();
  
  console.error(errorMessage);
  throw new Error('Missing Supabase environment variables. See console for details.');
}

// Validate URL format
if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  console.warn('⚠️  Warning: NEXT_PUBLIC_SUPABASE_URL does not look like a valid Supabase URL');
  console.warn(`   Current value: ${supabaseUrl}`);
}

// Create and export Supabase client with better error handling
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We're not using auth sessions
  },
});

// Test connection on module load (only in development)
if (process.env.NODE_ENV === 'development') {
  // Log connection info (without sensitive data)
  console.log('[Supabase] Client initialized');
  console.log(`[Supabase] URL: ${supabaseUrl.substring(0, 30)}...`);
}

