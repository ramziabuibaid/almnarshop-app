'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X, CheckCircle, AlertCircle, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/context/AdminAuthContext';

const TOAST_DURATION_MS = 5500;
const POLL_INTERVAL_MS = 20000; // 20 ثانية — توازن بين ظهور الإشعارات واستهلاك Supabase

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

export default function NotificationCenter() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const subscriptionRef = useRef<any>(null);
  const toastTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const seenIdsRef = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user has permission to view notifications
  const canViewNotifications = admin?.is_super_admin || 
    admin?.permissions?.viewNotifications === true || 
    admin?.permissions?.dashboardAndNotifications === true;

  useEffect(() => {
    if (!canViewNotifications) return;

    // Load initial notifications
    loadNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('system_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_notifications',
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          seenIdsRef.current.add(newNotification.id);
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);
          setToasts((prev) => [newNotification, ...prev]);
          const id = newNotification.id;
          const t = setTimeout(() => {
            setToasts((prev) => prev.filter((n) => n.id !== id));
            delete toastTimeoutsRef.current[id];
          }, TOAST_DURATION_MS);
          toastTimeoutsRef.current[id] = t;
          try {
            new Audio('/notification.mp3').play().catch(() => {});
          } catch (_) {}
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    // استطلاع دوري — يضمن ظهور الإشعارات حتى لو لم يعمل Realtime (فقط عند ظهور التبويب)
    const runPoll = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadNotifications(true);
      }
    };
    pollIntervalRef.current = setInterval(runPoll, POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') runPoll();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Click outside to close dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('mousedown', handleClickOutside);
      Object.values(toastTimeoutsRef.current).forEach(clearTimeout);
      toastTimeoutsRef.current = {};
    };
  }, [canViewNotifications]);

  const dismissToast = useCallback((id: string) => {
    if (toastTimeoutsRef.current[id]) {
      clearTimeout(toastTimeoutsRef.current[id]);
      delete toastTimeoutsRef.current[id];
    }
    setToasts((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const loadNotifications = async (isPoll = false) => {
    if (!canViewNotifications) return;
    
    if (!isPoll) setLoading(true);
    try {
      const response = await fetch('/api/admin/notifications?limit=15');
      if (response.ok) {
        const data = await response.json();
        const list: Notification[] = data.notifications || [];
        const unread = data.unreadCount ?? 0;

        if (isPoll) {
          setNotifications(list);
          setUnreadCount(unread);
          list.forEach((n) => {
            if (seenIdsRef.current.has(n.id)) return;
            seenIdsRef.current.add(n.id);
            setToasts((prev) => [n, ...prev]);
            const t = setTimeout(() => {
              setToasts((p) => p.filter((x) => x.id !== n.id));
              delete toastTimeoutsRef.current[n.id];
            }, TOAST_DURATION_MS);
            toastTimeoutsRef.current[n.id] = t;
            try {
              new Audio('/notification.mp3').play().catch(() => {});
            } catch (_) {}
          });
        } else {
          setNotifications(list);
          setUnreadCount(unread);
          list.forEach((n) => seenIdsRef.current.add(n.id));
        }
      }
    } catch (error) {
      if (!isPoll) console.error('[NotificationCenter] Failed to load notifications:', error);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/admin/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[NotificationCenter] Marked as read:', notificationId, data);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('[NotificationCenter] Failed to mark as read:', response.status, errorData);
      }
    } catch (error) {
      console.error('[NotificationCenter] Failed to mark as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'create':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'update':
        return <Activity className="w-4 h-4 text-blue-500" />;
      case 'delete':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
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
      
      return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        numberingSystem: 'latn',
      });
    } catch {
      return dateString;
    }
  };

  const getNotificationUrl = async (notification: Notification): Promise<string | null> => {
    const { table_name, record_name } = notification;
    console.log('[NotificationCenter] Getting URL for notification:', { table_name, record_name });
    
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
        console.log('[NotificationCenter] Customer notification, record_name:', record_name);
        // Check if record_name looks like a customer_id (starts with CUS-)
        if (record_name && record_name.startsWith('CUS-')) {
          // Definitely a customer_id, use it directly
          console.log('[NotificationCenter] Using customer_id directly:', record_name);
          return `/admin/customers/${record_name}`;
        }
        // Otherwise, it's likely a customer name (for old notifications or delete notifications)
        // Try to find by name first
        console.log('[NotificationCenter] Searching for customer by name:', record_name);
        try {
          const { data: customer, error } = await supabase
            .from('customers')
            .select('customer_id')
            .eq('name', record_name)
            .single();
          if (customer?.customer_id) {
            console.log('[NotificationCenter] Found customer by name:', customer.customer_id);
            return `/admin/customers/${customer.customer_id}`;
          }
          if (error) {
            console.error('[NotificationCenter] Error searching by name:', error);
          }
        } catch (err) {
          console.error('[NotificationCenter] Failed to get customer ID:', err);
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
        setIsOpen(false);
      }
    }
  };

  if (!canViewNotifications) {
    return null;
  }

  const handleToastClick = async (notification: Notification, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dismissToast(notification.id);
    if (!notification.is_read) await markAsRead(notification.id);
    const url = await getNotificationUrl(notification);
    if (url) {
      router.push(url);
      setIsOpen(false);
    }
  };

  return (
    <>
    <div className="relative" ref={dropdownRef} dir="rtl">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="الإشعارات"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 50 ? '50+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">الإشعارات</h3>
            <button
              onClick={() => {
                router.push('/admin/notifications');
                setIsOpen(false);
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              عرض الكل
            </button>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 text-center text-gray-500">جاري التحميل...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">لا توجد إشعارات</div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    !notification.is_read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={(e) => handleNotificationClick(notification, e)}
                    >
                      <p className="text-sm text-gray-900">{notification.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {formatTime(notification.created_at)}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{notification.user_name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!notification.is_read && (
                        <>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await markAsRead(notification.id);
                            }}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                            title="تعليم كمقروء"
                          >
                            ✓
                          </button>
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>

    {/* إشعارات عائمة — تظهر فوراً، الأحدث في الأعلى، وتختفي بعد وقت قصير */}
    {toasts.length > 0 && (
      <div
        className="fixed top-16 right-4 left-4 sm:left-auto z-[200] flex flex-col gap-2 w-full sm:w-[22rem] pointer-events-none"
        style={{ direction: 'rtl' }}
        aria-live="polite"
      >
        {toasts.map((n) => (
          <div
            key={n.id}
            className="pointer-events-auto flex items-start gap-3 p-3 pr-4 bg-white rounded-xl shadow-lg border border-gray-200/80 animate-toast-in hover:shadow-md transition-shadow"
            role="alert"
          >
            <div className="mt-0.5 flex-shrink-0">{getNotificationIcon(n.type)}</div>
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={(e) => handleToastClick(n, e)}
            >
              <p className="text-sm text-gray-900 font-cairo line-clamp-2">{n.message}</p>
              <p className="text-xs text-gray-500 mt-0.5">{n.user_name}</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); dismissToast(n.id); }}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    )}
    </>
  );
}
