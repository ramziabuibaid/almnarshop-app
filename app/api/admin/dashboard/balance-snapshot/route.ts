import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/app/api/admin/helpers';
import { recordBalanceWeeklySnapshot } from '@/lib/balanceWeeklySnapshotDb';

/**
 * Super admin: manually record / refresh the snapshot for the current UTC week.
 */
export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  if (!admin.is_super_admin) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  let weekStart: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.week_start === 'string') {
      weekStart = body.week_start;
    }
  } catch {
    // ignore invalid body
  }

  const result = await recordBalanceWeeklySnapshot(weekStart);
  if (!result.ok) {
    return NextResponse.json({ message: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, week_start: result.week_start });
}
