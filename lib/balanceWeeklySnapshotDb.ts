import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchCustomerRowsForDashboard } from '@/lib/adminFetchCustomersBalances';
import {
  computeBalanceDashboardMetrics,
  getUtcWeekStartMonday,
  liveMetricsToSnapshotPayload,
  type SnapshotPayload,
} from '@/lib/dashboardBalanceMetrics';

export type { SnapshotPayload };

export async function recordBalanceWeeklySnapshot(weekStart?: string): Promise<{ ok: true; week_start: string } | { ok: false; error: string }> {
  try {
    const rows = await fetchCustomerRowsForDashboard();
    const metrics = computeBalanceDashboardMetrics(rows);
    const ws = weekStart || getUtcWeekStartMonday();
    const payload = liveMetricsToSnapshotPayload(metrics, ws);

    const { error } = await supabaseAdmin.from('balance_weekly_snapshots').upsert(
      {
        week_start: payload.week_start,
        total_receivables_all: payload.total_receivables_all,
        total_payables_all: payload.total_payables_all,
        receivables_operational: payload.receivables_operational,
        receivables_customer: payload.receivables_customer,
        receivables_merchant: payload.receivables_merchant,
        payables_supplier: payload.payables_supplier,
        count_by_type: payload.count_by_type,
        year_cohort_receivables: payload.year_cohort_receivables,
      },
      { onConflict: 'week_start' }
    );

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, week_start: ws };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
