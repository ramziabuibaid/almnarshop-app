import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/app/api/admin/helpers';
import { fetchCustomerRowsForDashboard } from '@/lib/adminFetchCustomersBalances';
import { computeBalanceDashboardMetrics } from '@/lib/dashboardBalanceMetrics';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  const canView =
    admin.is_super_admin === true || admin.permissions?.viewBalances === true;
  if (!canView) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  try {
    const rows = await fetchCustomerRowsForDashboard();
    const live = computeBalanceDashboardMetrics(rows);

    const { data: snapData, error: snapError } = await supabaseAdmin
      .from('balance_weekly_snapshots')
      .select(
        'week_start,total_receivables_all,total_payables_all,receivables_operational,receivables_customer,receivables_merchant,payables_supplier,count_by_type,year_cohort_receivables,created_at'
      )
      .order('week_start', { ascending: false })
      .limit(104);

    const snapshots =
      !snapError && Array.isArray(snapData)
        ? [...snapData].reverse()
        : [];

    if (snapError) {
      console.warn('[dashboard/balances] snapshots query:', snapError.message);
    }

    return NextResponse.json({
      live,
      snapshots,
      snapshotError: snapError ? snapError.message : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[dashboard/balances]', msg);
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
