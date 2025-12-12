/**
 * Test Supabase Connection
 * Run this file to test if Supabase connection is working
 * 
 * Usage: npx ts-node test_supabase_connection.ts
 * Or: node -r ts-node/register test_supabase_connection.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('=== Testing Supabase Connection ===\n');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERROR: Missing Supabase environment variables!');
  console.error('\nPlease check your .env.local file:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('\nCurrent values:');
  console.error(`  - NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
  console.error(`  - NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}`);
  process.exit(1);
}

console.log('✅ Environment variables found');
console.log(`   URL: ${supabaseUrl.substring(0, 30)}...`);
console.log(`   Key: ${supabaseAnonKey.substring(0, 20)}...\n`);

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test connection
async function testConnection() {
  try {
    console.log('Testing connection to Supabase...\n');

    // Test 1: Check if we can query products table
    console.log('1. Testing products table...');
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('product_id')
      .limit(1);

    if (productsError) {
      console.error('   ❌ Error:', productsError.message);
      console.error('   Code:', productsError.code);
      console.error('   Details:', productsError.details);
    } else {
      console.log(`   ✅ Success! Found ${products?.length || 0} products`);
    }

    // Test 2: Check if we can query online_orders table
    console.log('\n2. Testing online_orders table...');
    const { data: orders, error: ordersError } = await supabase
      .from('online_orders')
      .select('order_id')
      .limit(1);

    if (ordersError) {
      console.error('   ❌ Error:', ordersError.message);
      console.error('   Code:', ordersError.code);
      console.error('   Details:', ordersError.details);
    } else {
      console.log(`   ✅ Success! Found ${orders?.length || 0} orders`);
    }

    // Test 3: Check if we can query online_order_details table
    console.log('\n3. Testing online_order_details table...');
    const { data: details, error: detailsError } = await supabase
      .from('online_order_details')
      .select('detail_id')
      .limit(1);

    if (detailsError) {
      console.error('   ❌ Error:', detailsError.message);
      console.error('   Code:', detailsError.code);
      console.error('   Details:', detailsError.details);
    } else {
      console.log(`   ✅ Success! Found ${details?.length || 0} order details`);
    }

    // Test 4: Try to insert a test order (will be rolled back)
    console.log('\n4. Testing write permissions...');
    const testOrderId = `TEST-${Date.now()}`;
    const { data: testOrder, error: insertError } = await supabase
      .from('online_orders')
      .insert({
        order_id: testOrderId,
        customer_name: 'Test Customer',
        customer_phone: '0000000000',
        total_amount: 0,
        status: 'Pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('   ❌ Error:', insertError.message);
      console.error('   Code:', insertError.code);
      console.error('   Details:', insertError.details);
    } else {
      console.log('   ✅ Success! Can insert orders');
      // Clean up test order
      await supabase.from('online_orders').delete().eq('order_id', testOrderId);
      console.log('   ✅ Test order cleaned up');
    }

    console.log('\n=== Connection Test Complete ===');
    console.log('✅ Supabase connection is working!');

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testConnection();

