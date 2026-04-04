import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { CustomerBalanceRow } from '@/lib/dashboardBalanceMetrics';

/**
 * Paginated fetch of customer rows for balance aggregation (server-only).
 */
export async function fetchCustomerRowsForDashboard(): Promise<CustomerBalanceRow[]> {
  const out: CustomerBalanceRow[] = [];
  let page = 0;
  const pageSize = 1000;

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('customer_id, name, balance, type, last_inv_date')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch customers: ${error.message}`);
    }
    if (!data?.length) break;
    out.push(...(data as CustomerBalanceRow[]));
    if (data.length < pageSize) break;
    page += 1;
  }

  return out;
}
