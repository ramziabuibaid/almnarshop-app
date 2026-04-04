'use client';

import AdminLayout from '@/components/admin/AdminLayout';
import DashboardBalanceCharts from '@/components/admin/DashboardBalanceCharts';
import DashboardProductSection from '@/components/admin/DashboardProductSection';
import { Package, ShoppingBag, Users, ClipboardList } from 'lucide-react';
import { useLayoutEffect, useState, useCallback } from 'react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import type { BalanceDashboardLive } from '@/lib/dashboardBalanceMetrics';
import type { ProductDashboardMetrics } from '@/lib/dashboardProductMetrics';

export default function AdminDashboardPage() {
  const { admin } = useAdminAuth();
  const canViewBalances = admin?.is_super_admin === true || admin?.permissions?.viewBalances === true;
  const [customerCountLabel, setCustomerCountLabel] = useState('—');
  const [productSkuLabel, setProductSkuLabel] = useState('—');

  const onBalanceLiveLoaded = useCallback((live: BalanceDashboardLive) => {
    setCustomerCountLabel(live.totalCustomers.toLocaleString('en-US'));
  }, []);

  const onProductMetricsLoaded = useCallback((m: ProductDashboardMetrics) => {
    setProductSkuLabel(m.totalSkus.toLocaleString('en-US'));
  }, []);

  useLayoutEffect(() => {
    document.title = 'لوحة التحكم';
  }, []);

  const stats = [
    {
      label: 'المنتجات',
      value: productSkuLabel,
      icon: Package,
      color: 'bg-blue-500',
    },
    {
      label: 'طلبات أونلاين',
      value: '—',
      icon: ShoppingBag,
      color: 'bg-green-500',
    },
    {
      label: 'العملاء',
      value: customerCountLabel,
      icon: Users,
      color: 'bg-purple-500',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8" lang="en">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-cairo">لوحة التحكم</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 font-cairo">نظرة عامة على المخزون والأرصدة</p>
        </div>

        <DashboardProductSection onLoaded={onProductMetricsLoaded} />

        <DashboardBalanceCharts onLiveLoaded={canViewBalances ? onBalanceLiveLoaded : undefined} />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-cairo">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon size={24} className="text-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 font-cairo">اختصارات</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <a
              href="/admin/products"
              className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <Package size={24} className="text-gray-700 dark:text-gray-300 mb-2" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 font-cairo">المنتجات</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 font-cairo">المخزون والأسعار</p>
            </a>
            <a
              href="/admin/orders"
              className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <ShoppingBag size={24} className="text-gray-700 dark:text-gray-300 mb-2" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 font-cairo">طلبات أونلاين</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 font-cairo">متابعة الطلبات</p>
            </a>
            <a
              href="/admin/customers"
              className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <Users size={24} className="text-gray-700 dark:text-gray-300 mb-2" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 font-cairo">العملاء</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 font-cairo">الزبائن والمتابعة</p>
            </a>
            <a
              href="/admin/tasks"
              className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <ClipboardList size={24} className="text-gray-700 dark:text-gray-300 mb-2" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 font-cairo">المهام والمتابعات</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 font-cairo">التحصيل والمواعيد</p>
            </a>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

