'use client';

import { useState, useEffect } from 'react';
import { getMaintenanceHistory, deleteMaintenanceHistory, MaintenanceHistory } from '@/lib/api';
import { Loader2, Clock, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/context/AdminAuthContext';

interface MaintenanceTimelineProps {
  maintNo: string;
}

export default function MaintenanceTimeline({ maintNo }: MaintenanceTimelineProps) {
  const { admin } = useAdminAuth();
  const [history, setHistory] = useState<MaintenanceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isSuperAdmin = admin?.is_super_admin || false;

  useEffect(() => {
    loadHistory();
    loadUsers();
  }, [maintNo]);

  const loadUsers = async () => {
    try {
      const { data: users, error } = await supabase
        .from('admin_users')
        .select('id, username')
        .order('username');

      if (error) {
        console.error('[MaintenanceTimeline] Failed to load users:', error);
        return;
      }

      const map = new Map<string, string>();
      if (users && Array.isArray(users)) {
        users.forEach((user: any) => {
          const userId = user.id || '';
          const username = user.username || '';
          if (userId && username) {
            map.set(userId, username);
          }
        });
      }
      setUserMap(map);
    } catch (err: any) {
      console.error('[MaintenanceTimeline] Failed to load users:', err);
    }
  };

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMaintenanceHistory(maintNo);
      setHistory(data);
    } catch (err: any) {
      console.error('[MaintenanceTimeline] Failed to load history:', err);
      setError(err?.message || 'فشل تحميل السجل التاريخي');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        numberingSystem: 'latn',
      });
    } catch {
      return '—';
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  const handleDelete = async (historyId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا السجل التاريخي؟ لا يمكن التراجع عن هذا الإجراء.')) {
      return;
    }

    setDeletingId(historyId);
    try {
      await deleteMaintenanceHistory(historyId);
      // Remove from local state
      setHistory((prev) => prev.filter((entry) => entry.history_id !== historyId));
    } catch (err: any) {
      console.error('[MaintenanceTimeline] Failed to delete history entry:', err);
      alert(`فشل حذف السجل التاريخي: ${err?.message || 'خطأ غير معروف'}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" dir="rtl">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">جاري تحميل السجل التاريخي...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4" dir="rtl">
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8" dir="rtl">
        <Clock size={48} className="text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600">لا يوجد سجل تاريخي لهذا السجل</p>
        <p className="text-sm text-gray-500 mt-1">سيتم إنشاء السجل التاريخي عند تغيير الحالة</p>
      </div>
    );
  }

  return (
    <div className="space-y-0" dir="rtl">
      {history.map((entry, index) => (
        <div key={entry.history_id} className="relative flex gap-4 pb-6 last:pb-0">
          {/* Timeline line */}
          {index < history.length - 1 && (
            <div className="absolute right-5 top-8 bottom-0 w-0.5 bg-gray-200" />
          )}
          
          {/* Timeline dot */}
          <div className="relative z-10 flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center border-4 border-white shadow-sm">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900">تغيير الحالة</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {entry.status_from || '—'}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="text-sm text-gray-900 bg-blue-100 px-2 py-1 rounded font-medium">
                    {entry.status_to}
                  </span>
                </div>
              </div>
              <div className="text-left">
                <div className="text-xs font-medium text-gray-900">
                  {formatDate(entry.created_at)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatTime(entry.created_at)}
                </div>
                {isSuperAdmin && (
                  <button
                    onClick={() => handleDelete(entry.history_id)}
                    disabled={deletingId === entry.history_id}
                    className="mt-2 p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="حذف السجل التاريخي"
                  >
                    {deletingId === entry.history_id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                )}
              </div>
            </div>

            {entry.notes && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.notes}</p>
              </div>
            )}

            {entry.changed_by && userMap.get(entry.changed_by) && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  تم التغيير بواسطة: <span className="font-medium">{userMap.get(entry.changed_by)}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
