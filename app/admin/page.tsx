'use client';

import AdminLayout from '@/components/admin/AdminLayout';
import { Package, ShoppingBag, Users, TrendingUp, ClipboardList } from 'lucide-react';
import { useShop } from '@/context/ShopContext';
import { useEffect } from 'react';

export default function AdminDashboardPage() {
  const { products, loadProducts } = useShop();

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const stats = [
    {
      label: 'Total Products',
      value: products.length,
      icon: Package,
      color: 'bg-blue-500',
    },
    {
      label: 'Total Orders',
      value: '0',
      icon: ShoppingBag,
      color: 'bg-green-500',
    },
    {
      label: 'Total Customers',
      value: '0',
      icon: Users,
      color: 'bg-purple-500',
    },
    {
      label: 'Revenue',
      value: '₪0.00',
      icon: TrendingUp,
      color: 'bg-orange-500',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome to the Admin Panel</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-white rounded-lg border border-gray-200 p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
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
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <a
              href="/admin/products"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Package size={24} className="text-gray-700 mb-2" />
              <h3 className="font-semibold text-gray-900">Manage Products</h3>
              <p className="text-sm text-gray-600 mt-1">
                View and edit product inventory
              </p>
            </a>
            <a
              href="/admin/orders"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ShoppingBag size={24} className="text-gray-700 mb-2" />
              <h3 className="font-semibold text-gray-900">View Orders</h3>
              <p className="text-sm text-gray-600 mt-1">
                Manage customer orders
              </p>
            </a>
            <a
              href="/admin/customers"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Users size={24} className="text-gray-700 mb-2" />
              <h3 className="font-semibold text-gray-900">Manage Customers</h3>
              <p className="text-sm text-gray-600 mt-1">
                View customer information
              </p>
            </a>
            <a
              href="/admin/tasks"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ClipboardList size={24} className="text-gray-700 mb-2" />
              <h3 className="font-semibold text-gray-900">Tasks & Follow-ups</h3>
              <p className="text-sm text-gray-600 mt-1">
                Manage debt collection tasks
              </p>
            </a>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

