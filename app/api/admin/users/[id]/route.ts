import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAdminFromRequest, normalizePermissions, sanitizeAdminRow, hashPassword } from '../../helpers';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const requester = await getAdminFromRequest(req);
  if (!requester || !requester.is_super_admin) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  // Handle both sync and async params (Next.js 15+ uses Promise)
  const resolvedParams = params instanceof Promise ? await params : params;
  const id = resolvedParams.id;
  if (!id) return NextResponse.json({ message: 'Missing user id' }, { status: 400 });

  try {
    const body = await req.json();
    const updates: any = {};

    if (body.username !== undefined) {
      updates.username = String(body.username || '').trim().toLowerCase();
    }
    if (body.is_super_admin !== undefined) {
      updates.is_super_admin = !!body.is_super_admin;
    }
    if (body.is_active !== undefined) {
      updates.is_active = !!body.is_active;
    }
    if (body.work_location !== undefined) {
      updates.work_location = body.work_location === 'المخزن' ? 'المخزن' : 'المحل';
    }
    if (body.permissions !== undefined) {
      updates.permissions = normalizePermissions(body.permissions);
    }
    if (body.password) {
      if (String(body.password).length < 6) {
        return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
      }
      updates.password_hash = await hashPassword(String(body.password));
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'No updates provided' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      console.error('[admin users] update error', error);
      return NextResponse.json({ message: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json({ user: sanitizeAdminRow(data) });
  } catch (err: any) {
    console.error('[admin users] update exception', err);
    return NextResponse.json({ message: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const requester = await getAdminFromRequest(req);
  if (!requester || !requester.is_super_admin) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  // Handle both sync and async params (Next.js 15+ uses Promise)
  const resolvedParams = params instanceof Promise ? await params : params;
  const id = resolvedParams.id;
  if (!id) return NextResponse.json({ message: 'Missing user id' }, { status: 400 });

  // Prevent user from deleting themselves
  if (requester.id === id) {
    return NextResponse.json({ message: 'Cannot delete your own account' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('admin_users')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[admin users] delete error', error);
      return NextResponse.json({ message: 'Failed to delete user' }, { status: 500 });
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (err: any) {
    console.error('[admin users] delete exception', err);
    return NextResponse.json({ message: 'Failed to delete user' }, { status: 500 });
  }
}


