import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { signAdminToken, setAdminCookieInResponse } from '@/lib/adminAuth';
import { normalizePermissions, sanitizeAdminRow } from '../helpers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body?.username || '').trim().toLowerCase();
    const password = String(body?.password || '');

    console.log('[admin/login] Attempting login for username:', username);

    if (!username || !password) {
      return NextResponse.json({ message: 'Username and password are required' }, { status: 400 });
    }

    // Try exact match first (case-insensitive)
    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .single();

    console.log('[admin/login] Query result:', { 
      found: !!data, 
      error: error?.message,
      username_in_db: data?.username,
      is_active: data?.is_active 
    });

    if (error || !data) {
      console.log('[admin/login] User not found or error:', error);
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    if (!data.is_active) {
      console.log('[admin/login] Account is disabled');
      return NextResponse.json({ message: 'Account is disabled' }, { status: 403 });
    }

    if (!data.password_hash) {
      console.log('[admin/login] No password hash found for user');
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    console.log('[admin/login] Comparing password...');
    const passwordMatch = await bcrypt.compare(password, data.password_hash);
    console.log('[admin/login] Password match:', passwordMatch);
    
    if (!passwordMatch) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const token = signAdminToken({
      id: data.id,
      username: data.username,
      is_super_admin: !!data.is_super_admin,
    });

    const admin = sanitizeAdminRow({
      ...data,
      permissions: normalizePermissions(data.permissions),
    });

    const response = NextResponse.json({ admin });
    setAdminCookieInResponse(response, token);
    return response;
  } catch (err: any) {
    console.error('[admin login] error', err);
    return NextResponse.json({ message: 'Login failed' }, { status: 500 });
  }
}


