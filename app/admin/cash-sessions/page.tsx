'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Printer, Edit, Trash2, Loader2, Coins } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { getAllCashSessions, deleteCashSession } from '@/lib/api';

interface CashSession {
  CashSessionID: string;
  Date: string;
  OpeningFloat: number;
  ClosingFloatTarget: number;
  Notes?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export default function CashSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'جلسات الكاش - Cash Sessions';
  }, []);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllCashSessions(1000);
      setSessions(data);
    } catch (err: any) {
      console.error('[CashSessionsPage] Failed to load sessions:', err);
      setError(err?.message || 'فشل تحميل الجلسات');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الجلسة؟ سيتم حذف جميع الفئات النقدية المرتبطة بها.')) {
      return;
    }

    try {
      setDeletingId(sessionId);
      await deleteCashSession(sessionId);
      await loadSessions();
    } catch (err: any) {
      console.error('[CashSessionsPage] Failed to delete session:', err);
      alert(err?.message || 'فشل حذف الجلسة');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' ₪';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">الصندوق اليومي</h1>
        <button
          onClick={() => router.push('/admin/cash-sessions/new')}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus size={20} />
          <span>جلسة جديدة</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 size={32} className="inline-block animate-spin text-gray-400 mb-4" />
          <p className="text-gray-500">جاري تحميل الجلسات...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg mb-4">لا توجد جلسات صندوق</p>
          <button
            onClick={() => router.push('/admin/cash-sessions/new')}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            إنشاء جلسة جديدة
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    رقم الجلسة
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    التاريخ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الثابت السابق
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الثابت الجديد
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sessions.map((session) => (
                  <tr key={session.CashSessionID} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{session.CashSessionID}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(session.Date)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatMoney(session.OpeningFloat)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatMoney(session.ClosingFloatTarget)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/admin/cash-sessions/denominations/${session.CashSessionID}`)}
                          className="text-green-600 hover:text-green-900 p-1"
                          title="عد الفئات النقدية"
                        >
                          <Coins size={18} />
                        </button>
                        <button
                          onClick={() => {
                            const printUrl = `/admin/cash-sessions/print/${session.CashSessionID}`;
                            window.open(printUrl, '_blank');
                          }}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="طباعة"
                        >
                          <Printer size={18} />
                        </button>
                        <button
                          onClick={() => router.push(`/admin/cash-sessions/edit/${session.CashSessionID}`)}
                          className="text-gray-600 hover:text-gray-900 p-1"
                          title="تعديل"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(session.CashSessionID)}
                          disabled={deletingId === session.CashSessionID}
                          className="text-red-600 hover:text-red-900 p-1 disabled:opacity-50"
                          title="حذف"
                        >
                          {deletingId === session.CashSessionID ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Trash2 size={18} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}

