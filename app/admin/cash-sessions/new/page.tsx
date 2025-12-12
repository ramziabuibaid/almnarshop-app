'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { saveCashSession } from '@/lib/api';

export default function NewCashSessionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    Date: new Date().toISOString().split('T')[0],
    OpeningFloat: 0,
    ClosingFloatTarget: 0,
    Notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await saveCashSession(formData);
      router.push('/admin/cash-sessions');
    } catch (error: any) {
      console.error('[NewCashSessionPage] Error saving session:', error);
      alert(error?.message || 'فشل حفظ الجلسة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {loading && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <Loader2 size={32} className="inline-block animate-spin text-gray-900 mb-4" />
            <p className="text-gray-900 font-bold">جاري الحفظ...</p>
          </div>
        )}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">جلسة صندوق جديدة</h1>
        </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              التاريخ *
            </label>
            <input
              type="date"
              required
              value={formData.Date}
              onChange={(e) => setFormData({ ...formData, Date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الثابت السابق (Opening Float) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.OpeningFloat}
              onChange={(e) => setFormData({ ...formData, OpeningFloat: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الثابت الجديد (Closing Float Target) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.ClosingFloatTarget}
              onChange={(e) => setFormData({ ...formData, ClosingFloatTarget: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ملاحظات
          </label>
          <textarea
            value={formData.Notes}
            onChange={(e) => setFormData({ ...formData, Notes: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={20} />
            <span>حفظ الجلسة</span>
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-bold text-gray-900"
          >
            إلغاء
          </button>
        </div>
      </form>
      </div>
    </AdminLayout>
  );
}

