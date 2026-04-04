'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ComposedChart,
  Line,
} from 'recharts';
import { Loader2, Camera, AlertCircle } from 'lucide-react';
import {
  orderedYearLabels,
  type BalanceDashboardLive,
  type DashboardRankedRow,
} from '@/lib/dashboardBalanceMetrics';

type LeaderboardView = 'receivables' | 'payables' | 'suppliers' | 'abs' | 'customers' | 'merchants';

const LEADER_TABS: { id: LeaderboardView; label: string; hint: string }[] = [
  { id: 'receivables', label: 'أعلى مدين', hint: 'رصيد موجب — جميع التصنيفات' },
  { id: 'payables', label: 'أعلى دائن', hint: 'رصيد سالب — لهم علينا' },
  { id: 'suppliers', label: 'موردون', hint: 'موردون بأكبر مستحقات (سالب)' },
  { id: 'customers', label: 'زبائن', hint: 'مصنّفون زبون فقط، رصيد موجب' },
  { id: 'merchants', label: 'تجار', hint: 'مصنّفون تاجر فقط، رصيد موجب' },
  { id: 'abs', label: 'أكبر حركة', hint: 'أكبر قيمة مطلقة للرصيد' },
];

function pickLeaderRows(live: BalanceDashboardLive, v: LeaderboardView): DashboardRankedRow[] {
  switch (v) {
    case 'receivables':
      return live.topDebtors;
    case 'payables':
      return live.topPayables;
    case 'suppliers':
      return live.topSupplierPayables;
    case 'abs':
      return live.topAbsBalances;
    case 'customers':
      return live.topCustomerReceivables;
    case 'merchants':
      return live.topMerchantReceivables;
    default:
      return [];
  }
}

type SnapshotRow = {
  week_start: string;
  total_receivables_all: number | string;
  total_payables_all: number | string;
  receivables_operational: number | string;
  receivables_customer: number | string;
  receivables_merchant: number | string;
  payables_supplier: number | string;
  count_by_type?: Record<string, number> | null;
  year_cohort_receivables?: Record<string, number> | null;
};

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#94a3b8'];

function num(v: number | string | undefined | null): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Western digits (English) for all monetary amounts on this dashboard */
function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatLeaderAmount(row: DashboardRankedRow, v: LeaderboardView): { text: string; className: string } {
  const b = row.balance;
  if (v === 'payables' || v === 'suppliers') {
    return {
      text: formatMoney(Math.abs(b)),
      className: 'text-rose-700 dark:text-rose-300',
    };
  }
  if (v === 'abs') {
    if (b < 0) {
      return {
        text: `-${formatMoney(Math.abs(b))}`,
        className: 'text-rose-700 dark:text-rose-300',
      };
    }
    return {
      text: formatMoney(b),
      className: 'text-indigo-700 dark:text-indigo-300',
    };
  }
  return {
    text: formatMoney(b),
    className: 'text-indigo-700 dark:text-indigo-300',
  };
}

function leaderAmountHeader(v: LeaderboardView): string {
  if (v === 'payables' || v === 'suppliers') return 'المستحق لهم';
  if (v === 'abs') return 'الرصيد';
  return 'المبلغ';
}

function formatCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

function yearBucketLabel(key: string): string {
  if (key === 'before_2015') return 'قبل 2015';
  if (key === 'after_2026') return 'بعد 2026';
  if (key === 'unknown') return 'بلا تاريخ';
  return key;
}

type Props = {
  onLiveLoaded?: (live: BalanceDashboardLive) => void;
};

export default function DashboardBalanceCharts({ onLiveLoaded }: Props) {
  const { admin } = useAdminAuth();
  const canView = admin?.is_super_admin === true || admin?.permissions?.viewBalances === true;
  const isSuper = admin?.is_super_admin === true;

  const [leaderView, setLeaderView] = useState<LeaderboardView>('receivables');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<BalanceDashboardLive | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotBusy, setSnapshotBusy] = useState(false);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/dashboard/balances', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || res.statusText);
      }
      const data = await res.json();
      setLive(data.live);
      if (data.live && onLiveLoaded) onLiveLoaded(data.live);
      setSnapshots(Array.isArray(data.snapshots) ? data.snapshots : []);
      setSnapshotError(typeof data.snapshotError === 'string' ? data.snapshotError : null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setLive(null);
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  }, [canView, onLiveLoaded]);

  useEffect(() => {
    load();
  }, [load]);

  const takeSnapshot = async () => {
    setSnapshotBusy(true);
    try {
      const res = await fetch('/api/admin/dashboard/balance-snapshot', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || res.statusText);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSnapshotBusy(false);
    }
  };

  const leaderRows = useMemo(
    () => (live ? pickLeaderRows(live, leaderView) : []),
    [live, leaderView]
  );

  const activeLeaderHint = useMemo(
    () => LEADER_TABS.find((t) => t.id === leaderView)?.hint ?? '',
    [leaderView]
  );

  const pieData = useMemo(() => {
    if (!live) return [];
    const c = live.countsByCategory;
    return [
      { name: 'زبون', value: c.customer },
      { name: 'تاجر', value: c.merchant },
      { name: 'مورد', value: c.supplier },
      { name: 'تنظيمات محاسبية', value: c.accounting },
      { name: 'أخرى', value: c.other },
    ].filter((d) => d.value > 0);
  }, [live]);

  const barData = useMemo(() => {
    if (!live) return [];
    const keys = orderedYearLabels();
    return keys.map((key) => ({
      key,
      name: yearBucketLabel(key),
      receivables: live.yearCohortReceivables[key] || 0,
      customers: live.yearCohortCounts[key] || 0,
    }));
  }, [live]);

  const lineData = useMemo(() => {
    return snapshots.map((s) => ({
      week: s.week_start,
      receivables: num(s.total_receivables_all),
      operational: num(s.receivables_operational),
      customer: num(s.receivables_customer),
      merchant: num(s.receivables_merchant),
      payables: num(s.total_payables_all),
      supplierPayables: num(s.payables_supplier),
    }));
  }, [snapshots]);

  if (!canView) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-600 dark:text-gray-400">
        <Loader2 className="animate-spin mr-2" size={22} />
        <span className="font-cairo">جاري تحميل بيانات الأرصدة…</span>
      </div>
    );
  }

  if (error || !live) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 flex items-start gap-2 text-red-800 dark:text-red-200 font-cairo">
        <AlertCircle className="shrink-0 mt-0.5" size={20} />
        <span>{error || 'تعذر تحميل البيانات'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-cairo" dir="rtl" lang="en">
      {snapshotError ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-900 dark:text-amber-200">
          تنبيه: تعذر قراءة لقطات الأسبوع ({snapshotError}). أنشئ الجدول من الملف{' '}
          <code className="text-xs bg-amber-100 dark:bg-amber-900/40 px-1 rounded">supabase/migrations/20260403120000_balance_weekly_snapshots.sql</code>{' '}
          في محرر SQL لـ Supabase، ثم استخدم زر حفظ اللقطة.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">الأرصدة والذمم</h2>
        {isSuper ? (
          <button
            type="button"
            onClick={takeSnapshot}
            disabled={snapshotBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2"
          >
            {snapshotBusy ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
            حفظ لقطة أسبوعية الآن
          </button>
        ) : null}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <Kpi title="إجمالي الذمم المدينة (كل الأنواع)" value={formatMoney(live.totalReceivablesAll)} hint="مجموع الأرصدة الموجبة" />
        <Kpi title="ذمم تشغيلية (بدون محاسبية)" value={formatMoney(live.receivablesOperational)} hint="موجب، باستثناء تنظيمات محاسبية" />
        <Kpi title="ذمم مصنّفين زبون" value={formatMoney(live.receivablesCustomer)} hint="موجب، نوع زبون" />
        <Kpi title="ذمم مصنّفين تاجر" value={formatMoney(live.receivablesMerchant)} hint="موجب، نوع تاجر" />
        <Kpi title="مستحق للموردين" value={formatMoney(live.payablesSupplier)} hint="سالب، نوع مورد" />
        <Kpi title="إجمالي الذمم الدائنة (الكل)" value={formatMoney(live.totalPayablesAll)} hint="مجموع قيم الأرصدة السالبة" />
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        العملاء المُحتسبون: {live.totalCustomers.toLocaleString('en-US')} — اللقطات الأسبوعية تُسجَّل تلقائياً يوم الاثنين 06:00 UTC على Vercel عند ضبط{' '}
        <code className="px-1 rounded bg-gray-100 dark:bg-slate-800">CRON_SECRET</code>.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie — counts by type */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">توزيع العملاء حسب التصنيف</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">عدد السجلات (ليس المبالغ)</p>
          <div className="h-[320px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number | string) => [Number(v).toLocaleString('en-US'), 'العدد']}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar — year cohort receivables */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">ذمم مدينة حسب سنة آخر فاتورة</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">مجموع الأرصدة الموجبة فقط — 2015–2026 والفئات المجاورة</p>
          <div className="h-[320px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 8, left: 8, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-slate-600" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={60} />
                <YAxis tickFormatter={(v) => formatCompact(Number(v))} width={48} />
                <Tooltip
                  formatter={(value: number | string, name: string) => {
                    if (name === 'receivables') return [formatMoney(Number(value)), 'ذمم مدينة'];
                    return [Number(value).toLocaleString('en-US'), 'عدد العملاء'];
                  }}
                />
                <Legend />
                <Bar dataKey="receivables" name="ذمم مدينة" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Line — weekly snapshots */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">تطور الأرصدة (لقطات أسبوعية)</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          يُحدَّث أسبوعياً. المحور الأيمن للذمم الدائنة إن اختلفت مقياساً عن المدينة.
        </p>
        {lineData.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 py-12 text-center border border-dashed border-gray-200 dark:border-slate-600 rounded-lg">
            لا توجد لقطات بعد. بعد إنشاء الجدول في Supabase، اضغط «حفظ لقطة أسبوعية الآن» (مدير) أو انتظر مهمة Cron.
          </div>
        ) : (
          <div className="h-[380px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={lineData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-slate-600" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => formatCompact(Number(v))} width={52} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => formatCompact(Number(v))} width={52} />
                <Tooltip
                  formatter={(value: number | string, name: string) => {
                    const labels: Record<string, string> = {
                      receivables: 'إجمالي مدين',
                      operational: 'تشغيلي',
                      customer: 'زبائن',
                      merchant: 'تجار',
                      payables: 'دائن (كل)',
                      supplierPayables: 'موردين',
                    };
                    return [formatMoney(Number(value)), labels[name] || name];
                  }}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="receivables" name="إجمالي مدين" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="operational" name="تشغيلي" stroke="#10b981" strokeWidth={1.5} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="customer" name="زبائن" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="merchant" name="تجار" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="payables" name="دائن كلي" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="supplierPayables" name="موردين" stroke="#f97316" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Leaderboard — switch between ranking views */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">ترتيب الأرصدة</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{activeLeaderHint}</p>

        <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="عرض الترتيب">
          {LEADER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={leaderView === tab.id}
              onClick={() => setLeaderView(tab.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium font-cairo transition-colors border ${
                leaderView === tab.id
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {leaderRows.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center border border-dashed border-gray-200 dark:border-slate-600 rounded-lg font-cairo">
            لا توجد حسابات في هذا العرض، أو كل الأرصدة صفر.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400">
                  <th className="text-right py-2 px-2 font-cairo">الاسم</th>
                  <th className="text-right py-2 px-2 font-cairo w-28">النوع</th>
                  <th className="text-right py-2 px-2 font-cairo">{leaderAmountHeader(leaderView)}</th>
                  <th className="text-left py-2 px-2 w-24 font-cairo"> </th>
                </tr>
              </thead>
              <tbody>
                {leaderRows.map((row) => {
                  const amt = formatLeaderAmount(row, leaderView);
                  return (
                    <tr key={`${leaderView}-${row.customer_id}`} className="border-b border-gray-100 dark:border-slate-700/80">
                      <td className="py-2 px-2 text-gray-900 dark:text-gray-100">{row.name}</td>
                      <td className="py-2 px-2 text-gray-600 dark:text-gray-400 text-xs">{row.typeLabel}</td>
                      <td className={`py-2 px-2 font-semibold tabular-nums ${amt.className}`}>{amt.text}</td>
                      <td className="py-2 px-2 text-left">
                        <a
                          href={`/admin/customers/${encodeURIComponent(row.customer_id)}`}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline font-cairo"
                        >
                          البطاقة
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{title}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{hint}</p>
    </div>
  );
}
