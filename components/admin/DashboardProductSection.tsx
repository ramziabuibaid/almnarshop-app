'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { getProducts } from '@/lib/api';
import {
  computeProductDashboardMetrics,
  LOW_STOCK_THRESHOLD,
  type ProductDashboardMetrics,
} from '@/lib/dashboardProductMetrics';
import { Loader2, AlertCircle, Package, ExternalLink } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const PIE_COLORS = ['#0d9488', '#6366f1', '#d97706', '#db2777', '#64748b', '#16a34a', '#7c3aed', '#94a3b8'];

type TableTab = 'out' | 'low' | 'top' | 'restock';

const TABLE_TABS: { id: TableTab; label: string; hint: string }[] = [
  { id: 'out', label: 'نفاد تام', hint: 'مجموع المحل + المخزن = 0' },
  { id: 'low', label: 'مخزون منخفض', hint: `أكثر من 0 ولا يتجاوز ${LOW_STOCK_THRESHOLD}` },
  { id: 'top', label: 'أعلى مخزون', hint: 'ترتيب تنازلي حسب إجمالي الوحدات' },
  { id: 'restock', label: 'أحدث تعبئة', hint: 'حسب تاريخ آخر إدخال مخزون' },
];

function fmtInt(n: number) {
  return n.toLocaleString('en-US');
}

type Props = {
  onLoaded?: (metrics: ProductDashboardMetrics) => void;
};

export default function DashboardProductSection({ onLoaded }: Props) {
  const { admin } = useAdminAuth();
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ProductDashboardMetrics | null>(null);
  const [tableTab, setTableTab] = useState<TableTab>('out');

  const load = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getProducts({ forStore: false });
      const m = computeProductDashboardMetrics(list || []);
      setMetrics(m);
      onLoadedRef.current?.(m);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    if (admin) load();
  }, [admin, load]);

  const tableRows = useMemo(() => {
    if (!metrics) return [];
    switch (tableTab) {
      case 'out':
        return metrics.outOfStock;
      case 'low':
        return metrics.lowStock;
      case 'top':
        return metrics.topStocked;
      case 'restock':
        return metrics.recentlyRestocked;
      default:
        return [];
    }
  }, [metrics, tableTab]);

  const activeTableHint = useMemo(
    () => TABLE_TABS.find((t) => t.id === tableTab)?.hint ?? '',
    [tableTab]
  );

  if (!admin) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-600 dark:text-gray-400 font-cairo border border-dashed border-gray-200 dark:border-slate-600 rounded-lg">
        <Loader2 className="animate-spin ml-2" size={22} />
        <span>جاري تحميل بيانات البضائع…</span>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 flex items-start gap-2 text-red-800 dark:text-red-200 font-cairo">
        <AlertCircle className="shrink-0 mt-0.5" size={20} />
        <span>{error || 'تعذر تحميل المنتجات'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-cairo" dir="rtl" lang="en">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="text-teal-600 dark:text-teal-400" size={22} />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">البضائع والمخزون</h2>
        </div>
        <a
          href="/admin/products"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 dark:text-teal-300 hover:underline"
        >
          إدارة المنتجات
          <ExternalLink size={14} />
        </a>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        يشمل <strong>كل الأصناف</strong> في النظام (ظاهرة في المتجر أو مخفية)، بعيداً عن قسم الأرصدة والعملاء.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <Pill title="إجمالي الأصناف" value={fmtInt(metrics.totalSkus)} />
        <Pill title="وحدات — المحل" value={fmtInt(metrics.totalShopUnits)} />
        <Pill title="وحدات — المخزن" value={fmtInt(metrics.totalWarehouseUnits)} />
        <Pill title="إجمالي الوحدات" value={fmtInt(metrics.totalUnits)} />
        <Pill title="ظاهر في المتجر" value={fmtInt(metrics.visibleInStore)} />
        <Pill title="مخفي عن المتجر" value={fmtInt(metrics.hiddenFromStore)} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Pill title="بدون صورة رئيسية" value={fmtInt(metrics.withoutImage)} hint="مراجعة الجودة" />
        <Pill title="نفاد تام" value={fmtInt(metrics.outOfStockCount)} hint="مجموع 0" />
        <Pill title="مخزون منخفض" value={fmtInt(metrics.lowStockCount)} hint={`≤ ${LOW_STOCK_THRESHOLD}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">توزيع الأصناف حسب النوع</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">عدد الـ SKU وليس عدد الوحدات</p>
          {metrics.typePie.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">لا توجد بيانات نوع</p>
          ) : (
            <div className="h-[300px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={metrics.typePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                    {metrics.typePie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number | string) => [Number(v).toLocaleString('en-US'), 'عدد']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 flex flex-col min-h-[300px]">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">قوائم سريعة</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{activeTableHint}</p>
          <div className="flex flex-wrap gap-2 mb-3" role="tablist">
            {TABLE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tableTab === tab.id}
                onClick={() => setTableTab(tab.id)}
                className={`rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors border ${
                  tableTab === tab.id
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto flex-1 max-h-[280px] overflow-y-auto rounded border border-gray-100 dark:border-slate-700/80">
            {tableRows.length === 0 ? (
              <p className="text-sm text-gray-500 p-6 text-center">لا توجد أصناف في هذا العرض</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-slate-900 z-10">
                  <tr className="border-b border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400">
                    <th className="text-right py-2 px-2">الصنف</th>
                    <th className="text-right py-2 px-2 w-24">النوع</th>
                    <th className="text-right py-2 px-1 w-14 tabular-nums">محل</th>
                    <th className="text-right py-2 px-1 w-14 tabular-nums">مخزن</th>
                    <th className="text-right py-2 px-1 w-14 tabular-nums">مجموع</th>
                    <th className="text-left py-2 px-1 w-16"> </th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={`${tableTab}-${row.id}`} className="border-b border-gray-100 dark:border-slate-700/80">
                      <td className="py-1.5 px-2 text-gray-900 dark:text-gray-100 max-w-[140px] truncate" title={row.name}>
                        {row.name}
                      </td>
                      <td className="py-1.5 px-2 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[96px]" title={row.typeLabel}>
                        {row.typeLabel}
                      </td>
                      <td className="py-1.5 px-1 tabular-nums text-gray-800 dark:text-gray-200">{fmtInt(row.shop)}</td>
                      <td className="py-1.5 px-1 tabular-nums text-gray-800 dark:text-gray-200">{fmtInt(row.war)}</td>
                      <td className="py-1.5 px-1 font-semibold tabular-nums text-teal-800 dark:text-teal-200">{fmtInt(row.total)}</td>
                      <td className="py-1.5 px-1 text-left">
                        <a
                          href={`/admin/products/${encodeURIComponent(row.id)}`}
                          className="text-teal-600 dark:text-teal-400 hover:underline text-xs whitespace-nowrap"
                        >
                          تعديل
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5 leading-tight">{title}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
      {hint ? <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p> : null}
    </div>
  );
}
