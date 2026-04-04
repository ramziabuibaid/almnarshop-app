/**
 * Aggregates customer balances for the admin dashboard (server or client).
 * Convention matches customers page: balance > 0 = receivable (عليهم لنا), balance < 0 = payable.
 */

export type CustomerBalanceRow = {
  customer_id: string;
  name?: string | null;
  balance?: number | string | null;
  type?: string | null;
  last_inv_date?: string | null;
};

const CUSTOMER_TYPES = ['زبون', 'customer', 'Customer'];
const MERCHANT_TYPES = ['تاجر', 'merchant', 'Merchant'];
const SUPPLIER_TYPES = ['مورد', 'supplier', 'Supplier'];
const ACCOUNTING_TYPES = ['تنظيمات محاسبية', 'accounting', 'Accounting'];

export function normalizeTypeKey(type: string | null | undefined): 'customer' | 'merchant' | 'supplier' | 'accounting' | 'other' {
  const t = (type || '').trim();
  if (!t) return 'other';
  if (CUSTOMER_TYPES.some((x) => t === x || t.toLowerCase() === x.toLowerCase())) return 'customer';
  if (MERCHANT_TYPES.some((x) => t === x || t.toLowerCase() === x.toLowerCase())) return 'merchant';
  if (SUPPLIER_TYPES.some((x) => t === x || t.toLowerCase() === x.toLowerCase())) return 'supplier';
  if (ACCOUNTING_TYPES.some((x) => t === x || t.toLowerCase() === x.toLowerCase())) return 'accounting';
  return 'other';
}

/** Calendar year from last_inv_date (DB ISO or parseable), or bucket key */
export function lastInvoiceYearBucket(last_inv_date: string | null | undefined): string {
  if (last_inv_date == null || String(last_inv_date).trim() === '') return 'unknown';
  const d = new Date(last_inv_date as string);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const y = d.getFullYear();
  if (y < 2015) return 'before_2015';
  if (y > 2026) return 'after_2026';
  return String(y);
}

export type DashboardRankedRow = {
  customer_id: string;
  name: string;
  balance: number;
  typeLabel: string;
};

function arTypeLabel(cat: ReturnType<typeof normalizeTypeKey>): string {
  const m: Record<ReturnType<typeof normalizeTypeKey>, string> = {
    customer: 'زبون',
    merchant: 'تاجر',
    supplier: 'مورد',
    accounting: 'تنظيمات محاسبية',
    other: 'أخرى',
  };
  return m[cat];
}

export interface BalanceDashboardLive {
  /** Customers with non-empty customer_id */
  totalCustomers: number;
  totalReceivablesAll: number;
  totalPayablesAll: number;
  receivablesOperational: number;
  receivablesCustomer: number;
  receivablesMerchant: number;
  payablesSupplier: number;
  countsByCategory: {
    customer: number;
    merchant: number;
    supplier: number;
    accounting: number;
    other: number;
  };
  /** Sum of positive balances only, grouped by last invoice year bucket */
  yearCohortReceivables: Record<string, number>;
  /** Count of customers (any balance) in each last-invoice year bucket */
  yearCohortCounts: Record<string, number>;
  /** balance > 0, all types */
  topDebtors: DashboardRankedRow[];
  /** balance < 0, largest obligations first */
  topPayables: DashboardRankedRow[];
  /** supplier + negative balance */
  topSupplierPayables: DashboardRankedRow[];
  /** non-zero, sorted by |balance| */
  topAbsBalances: DashboardRankedRow[];
  /** customer type + positive */
  topCustomerReceivables: DashboardRankedRow[];
  /** merchant type + positive */
  topMerchantReceivables: DashboardRankedRow[];
}

const YEAR_LABEL_ORDER = [
  'before_2015',
  ...Array.from({ length: 12 }, (_, i) => String(2015 + i)),
  'after_2026',
  'unknown',
] as const;

export function orderedYearLabels(): string[] {
  return [...YEAR_LABEL_ORDER];
}

export function computeBalanceDashboardMetrics(rows: CustomerBalanceRow[]): BalanceDashboardLive {
  const countsByCategory = {
    customer: 0,
    merchant: 0,
    supplier: 0,
    accounting: 0,
    other: 0,
  };

  const yearCohortReceivables: Record<string, number> = {};
  const yearCohortCounts: Record<string, number> = {};
  for (const key of YEAR_LABEL_ORDER) {
    yearCohortReceivables[key] = 0;
    yearCohortCounts[key] = 0;
  }

  let totalReceivablesAll = 0;
  let totalPayablesAll = 0;
  let receivablesOperational = 0;
  let receivablesCustomer = 0;
  let receivablesMerchant = 0;
  let payablesSupplier = 0;
  let totalCustomers = 0;

  type Enriched = { customer_id: string; name: string; balance: number; cat: ReturnType<typeof normalizeTypeKey> };
  const enriched: Enriched[] = [];

  for (const row of rows) {
    const id = String(row.customer_id || '').trim();
    if (!id) continue;
    totalCustomers += 1;

    const bal = parseFloat(String(row.balance ?? 0)) || 0;
    const cat = normalizeTypeKey(row.type);
    countsByCategory[cat]++;

    const bucket = lastInvoiceYearBucket(row.last_inv_date);
    yearCohortCounts[bucket] = (yearCohortCounts[bucket] || 0) + 1;

    enriched.push({
      customer_id: id,
      name: String(row.name || '').trim() || id,
      balance: bal,
      cat,
    });

    if (bal > 0) {
      totalReceivablesAll += bal;
      if (cat !== 'accounting') receivablesOperational += bal;
      if (cat === 'customer') receivablesCustomer += bal;
      if (cat === 'merchant') receivablesMerchant += bal;
      yearCohortReceivables[bucket] = (yearCohortReceivables[bucket] || 0) + bal;
    } else if (bal < 0) {
      totalPayablesAll += Math.abs(bal);
      if (cat === 'supplier') payablesSupplier += Math.abs(bal);
    }
  }

  const toRanked = (e: Enriched): DashboardRankedRow => ({
    customer_id: e.customer_id,
    name: e.name,
    balance: e.balance,
    typeLabel: arTypeLabel(e.cat),
  });

  const topN = 12;

  const topDebtors = enriched
    .filter((e) => e.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, topN)
    .map(toRanked);

  const topPayables = enriched
    .filter((e) => e.balance < 0)
    .sort((a, b) => a.balance - b.balance)
    .slice(0, topN)
    .map(toRanked);

  const topSupplierPayables = enriched
    .filter((e) => e.balance < 0 && e.cat === 'supplier')
    .sort((a, b) => a.balance - b.balance)
    .slice(0, topN)
    .map(toRanked);

  const topAbsBalances = enriched
    .filter((e) => e.balance !== 0)
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, topN)
    .map(toRanked);

  const topCustomerReceivables = enriched
    .filter((e) => e.balance > 0 && e.cat === 'customer')
    .sort((a, b) => b.balance - a.balance)
    .slice(0, topN)
    .map(toRanked);

  const topMerchantReceivables = enriched
    .filter((e) => e.balance > 0 && e.cat === 'merchant')
    .sort((a, b) => b.balance - a.balance)
    .slice(0, topN)
    .map(toRanked);

  return {
    totalCustomers,
    totalReceivablesAll,
    totalPayablesAll,
    receivablesOperational,
    receivablesCustomer,
    receivablesMerchant,
    payablesSupplier,
    countsByCategory,
    yearCohortReceivables,
    yearCohortCounts,
    topDebtors,
    topPayables,
    topSupplierPayables,
    topAbsBalances,
    topCustomerReceivables,
    topMerchantReceivables,
  };
}

/** ISO date string (YYYY-MM-DD) for Monday of the UTC week containing `d` */
export function getUtcWeekStartMonday(d: Date = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setUTCDate(x.getUTCDate() + diff);
  return x.toISOString().slice(0, 10);
}

export interface SnapshotPayload {
  week_start: string;
  total_receivables_all: number;
  total_payables_all: number;
  receivables_operational: number;
  receivables_customer: number;
  receivables_merchant: number;
  payables_supplier: number;
  count_by_type: Record<string, number>;
  year_cohort_receivables: Record<string, number>;
}

export function liveMetricsToSnapshotPayload(metrics: BalanceDashboardLive, weekStart: string): SnapshotPayload {
  return {
    week_start: weekStart,
    total_receivables_all: metrics.totalReceivablesAll,
    total_payables_all: metrics.totalPayablesAll,
    receivables_operational: metrics.receivablesOperational,
    receivables_customer: metrics.receivablesCustomer,
    receivables_merchant: metrics.receivablesMerchant,
    payables_supplier: metrics.payablesSupplier,
    count_by_type: { ...metrics.countsByCategory },
    year_cohort_receivables: { ...metrics.yearCohortReceivables },
  };
}
