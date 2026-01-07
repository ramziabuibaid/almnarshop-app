import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  getAdminFromRequest,
  normalizePermissions,
  sanitizeAdminRow,
  hashPassword,
} from '../helpers';

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin || !admin.is_super_admin) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .order('username');

  if (error) {
    console.error('[admin users] fetch error', error);
    return NextResponse.json({ message: 'Failed to load users' }, { status: 500 });
  }

  return NextResponse.json({
    users: (data || []).map((row) =>
      sanitizeAdminRow({
        ...row,
        permissions: normalizePermissions(row.permissions),
      })
    ),
  });
}

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin || !admin.is_super_admin) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const username = String(body?.username || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const is_super_admin = !!body?.is_super_admin;
    const is_active = body?.is_active !== undefined ? !!body.is_active : true;
    const work_location = body?.work_location === 'المخزن' ? 'المخزن' : 'المحل';
    const permissions = normalizePermissions(body?.permissions);

    if (!username || !password) {
      return NextResponse.json({ message: 'Username and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const password_hash = await hashPassword(password);

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .insert({
        username,
        password_hash,
        is_super_admin,
        is_active,
        work_location,
        permissions,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[admin users] create error', error);
      return NextResponse.json({ message: 'Failed to create user' }, { status: 500 });
    }

    return NextResponse.json({ user: sanitizeAdminRow(data) });
  } catch (err: any) {
    console.error('[admin users] create exception', err);
    return NextResponse.json({ message: 'Failed to create user' }, { status: 500 });
  }
}


