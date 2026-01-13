'use client';

import { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { supabase } from '@/lib/supabase';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Filter,
  X,
  Calendar,
  User,
  CheckCheck,
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'create' | 'update' | 'delete';
  table_name: string;
  record_name: string;
  message: string;
  user_name: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAsRead, setMarkingAsRead] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    user_name: '',
    type: '' as '' | 'create' | 'update' | 'delete',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Check permission
  const canViewDashboard = admin?.is_super_admin || 
    admin?.permissions?.viewNotifications === true || 
    admin?.permissions?.dashboardAndNotifications === true;

  useLayoutEffect(() => {
    document.title = 'الإشعارات';
  }, []);

  useEffect(() => {
    if (!canViewDashboard) {
      router.push('/admin');
      return;
    }
    loadNotifications();
  }, [canViewDashboard, router]);

  const loadNotifications = async () => {
    if (!canViewDashboard) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.user_name) params.append('user_name', filters.user_name);
      if (filters.type) params.append('type', filters.type);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`/api/admin/notifications?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('[Dashboard] Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [filters]);

  const markAsRead = async (notificationId: string) => {
    setMarkingAsRead(notificationId);
    try {
      const response = await fetch(`/api/admin/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
        );
      }
    } catch (error) {
      console.error('[Dashboard] Failed to mark as read:', error);
    } finally {
      setMarkingAsRead(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/admin/notifications/read-all', {
        method: 'POST',
      });
      
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    } catch (error) {
      console.error('[Dashboard] Failed to mark all as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'create':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'update':
        return <Activity className="w-5 h-5 text-blue-500" />;
      case 'delete':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'create':
        return 'إنشاء';
      case 'update':
        return 'تحديث';
      case 'delete':
        return 'حذف';
      default:
        return type;
    }
  };

  const getTableLabel = (tableName: string) => {
    const labels: Record<string, string> = {
      products: 'المنتجات',
      customers: 'الزبائن',
      cash_invoices: 'الفواتير النقدية',
      maintenance: 'الصيانة',
      shop_sales_invoices: 'فواتير مبيعات المحل',
      warehouse_sales_invoices: 'فواتير مبيعات المستودع',
      shop_receipts: 'سندات قبض المحل',
      shop_payments: 'سندات صرف المحل',
      warehouse_receipts: 'سندات قبض المستودع',
      warehouse_payments: 'سندات صرف المستودع',
    };
    return labels[tableName] || tableName;
  };

  const getNotificationUrl = async (notification: Notification): Promise<string | null> => {
    const { table_name, record_name } = notification;
    console.log('[Dashboard] Getting URL for notification:', { table_name, record_name });
    
    switch (table_name) {
      case 'shop_sales_invoices':
        return '/admin/shop-sales';
      
      case 'warehouse_sales_invoices':
        return '/admin/warehouse-sales';
      
      case 'shop_receipts':
      case 'shop_payments':
        return '/admin/shop-finance/cash-box';
      
      case 'warehouse_receipts':
      case 'warehouse_payments':
        return '/admin/warehouse-finance/cash-box';
      
      case 'maintenance':
        return '/admin/maintenance';
      
      case 'customers':
        // record_name should be customer_id (format: CUS-XXXX-YYY)
        console.log('[Dashboard] Customer notification, record_name:', record_name);
        // Check if record_name looks like a customer_id (starts with CUS-)
        if (record_name && record_name.startsWith('CUS-')) {
          // Definitely a customer_id, use it directly
          console.log('[Dashboard] Using customer_id directly:', record_name);
          return `/admin/customers/${record_name}`;
        }
        // Otherwise, it's likely a customer name (for old notifications or delete notifications)
        // Try to find by name first
        console.log('[Dashboard] Searching for customer by name:', record_name);
        try {
          const { data: customer, error } = await supabase
            .from('customers')
            .select('customer_id')
            .eq('name', record_name)
            .single();
          if (customer?.customer_id) {
            console.log('[Dashboard] Found customer by name:', customer.customer_id);
            return `/admin/customers/${customer.customer_id}`;
          }
          if (error) {
            console.error('[Dashboard] Error searching by name:', error);
          }
        } catch (err) {
          console.error('[Dashboard] Failed to get customer ID:', err);
        }
        // If not found, return customers list page
        return '/admin/customers';
      
      case 'products':
        return '/admin/products';
      
      default:
        return null;
    }
  };

  const handleNotificationClick = async (notification: Notification, event: React.MouseEvent) => {
    // Check if Ctrl (Windows) or Command (Mac) is pressed
    const openInNewTab = event.ctrlKey || event.metaKey;
    
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    const url = await getNotificationUrl(notification);
    if (url) {
      if (openInNewTab) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        router.push(url);
      }
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'الآن';
      if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      if (diffDays < 7) return `منذ ${diffDays} يوم`;
      
      return formatDate(dateString);
    } catch {
      return dateString;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications;
  }, [notifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  if (!canViewDashboard) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">الإشعارات</h1>
            <p className="text-gray-600 mt-1">سجل جميع الأنشطة في النظام</p>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <CheckCheck size={18} />
                تعليم الكل كمقروء
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <Filter size={18} />
              {showFilters ? 'إخفاء' : 'عرض'} الفلاتر
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  المستخدم
                </label>
                <input
                  type="text"
                  value={filters.user_name}
                  onChange={(e) => setFilters({ ...filters, user_name: e.target.value })}
                  placeholder="اسم المستخدم"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نوع الإجراء
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">الكل</option>
                  <option value="create">إنشاء</option>
                  <option value="update">تحديث</option>
                  <option value="delete">حذف</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  من تاريخ
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  إلى تاريخ
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setFilters({ user_name: '', type: '', startDate: '', endDate: '' });
                  setShowFilters(false);
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 flex items-center gap-2"
              >
                <X size={18} />
                مسح الفلاتر
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">إجمالي الإشعارات</p>
                <p className="text-2xl font-bold text-gray-900">{notifications.length}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">غير مقروء</p>
                <p className="text-2xl font-bold text-red-600">{unreadCount}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">مقروء</p>
                <p className="text-2xl font-bold text-green-600">
                  {notifications.length - unreadCount}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">سجل الأنشطة</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="p-8 text-center text-gray-500">جاري التحميل...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">لا توجد إشعارات</div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                    !notification.is_read ? 'bg-blue-50' : ''
                  }`}
                  onClick={(e) => handleNotificationClick(notification, e)}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {notification.user_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatTime(notification.created_at)}
                            </span>
                            <span className="px-2 py-0.5 bg-gray-100 rounded">
                              {getTableLabel(notification.table_name)}
                            </span>
                            <span className="px-2 py-0.5 bg-gray-100 rounded">
                              {getTypeLabel(notification.type)}
                            </span>
                          </div>
                        </div>
                        {!notification.is_read && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await markAsRead(notification.id);
                            }}
                            disabled={markingAsRead === notification.id}
                            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                          >
                            {markingAsRead === notification.id ? '...' : 'تعليم كمقروء'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
