'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X, CheckCircle, AlertCircle, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/context/AdminAuthContext';

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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const subscriptionRef = useRef<any>(null);

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
          console.log('[NotificationCenter] New notification received:', payload);
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);
          
          // Play notification sound (optional)
          try {
            const audio = new Audio('/notification.mp3');
            audio.play().catch(() => {
              // Ignore if audio fails (file might not exist)
            });
          } catch (err) {
            // Ignore audio errors
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

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
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [canViewNotifications]);

  const loadNotifications = async () => {
    if (!canViewNotifications) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/admin/notifications?limit=10');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('[NotificationCenter] Failed to load notifications:', error);
    } finally {
      setLoading(false);
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
      });
    } catch {
      return dateString;
    }
  };

  if (!canViewNotifications) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef} dir="rtl">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="الإشعارات"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">الإشعارات</h3>
            <button
              onClick={() => {
                router.push('/admin/dashboard');
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
                      onClick={async () => {
                        if (!notification.is_read) {
                          await markAsRead(notification.id);
                        }
                        router.push('/admin/dashboard');
                        setIsOpen(false);
                      }}
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
  );
}
