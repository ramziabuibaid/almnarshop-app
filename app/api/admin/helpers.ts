import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminToken, AdminTokenPayload } from '@/lib/adminAuth';

export const DEFAULT_PERMISSIONS = {
  viewBalances: false,
  viewTasks: false,
  viewCost: false,
  viewCashInvoices: false,
  createPOS: false,
  accessReceipts: false,
  accessShopInvoices: false,
  accessWarehouseInvoices: false,
};

export type Permissions = typeof DEFAULT_PERMISSIONS;

export function normalizePermissions(raw: any): Permissions {
  return {
    ...DEFAULT_PERMISSIONS,
    ...(raw || {}),
  };
}

export function sanitizeAdminRow(row: any) {
  return {
    id: row.id,
    username: row.username,
    is_super_admin: !!row.is_super_admin,
    is_active: !!row.is_active,
    permissions: normalizePermissions(row.permissions),
  };
}

export async function getAdminFromRequest(req: NextRequest) {
  const token = req.cookies.get('admin_session')?.value;
  if (!token) return null;

  const payload = verifyAdminToken(token) as AdminTokenPayload | null;
  if (!payload || !payload.id) return null;

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .eq('id', payload.id)
    .single();

  if (error || !data) return null;
  if (!data.is_active) return null;

  return sanitizeAdminRow(data);
}

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}


