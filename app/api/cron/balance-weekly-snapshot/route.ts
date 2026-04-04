import { NextRequest, NextResponse } from 'next/server';
import { recordBalanceWeeklySnapshot } from '@/lib/balanceWeeklySnapshotDb';

/**
 * Vercel Cron: weekly Monday 06:00 UTC (see vercel.json).
 * Set CRON_SECRET in Vercel project env; Vercel sends Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');

  if (!secret) {
    console.error('[cron/balance-weekly-snapshot] CRON_SECRET is not set');
    return NextResponse.json({ message: 'Server misconfiguration' }, { status: 500 });
  }

  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const result = await recordBalanceWeeklySnapshot();
  if (!result.ok) {
    return NextResponse.json({ message: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, week_start: result.week_start });
}
