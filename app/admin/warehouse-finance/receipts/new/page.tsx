'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import CustomerSelect from '@/components/admin/CustomerSelect';
import { createWarehouseReceipt, getAllCustomers } from '@/lib/api';
import {
  Loader2,
  Save,
  ArrowRight,
} from 'lucide-react';

export default function NewWarehouseReceiptPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | null }>({ message: '', type: null });
  const [formData, setFormData] = useState({
    customerID: '',
    date: new Date().toISOString().split('T')[0],
    cash_amount: '',
    check_amount: '',
    notes: '',
  });

  // Load customers on mount
  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await getAllCustomers();
      setCustomers(data);
    } catch (err: any) {
      console.error('[NewWarehouseReceipt] Failed to load customers:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!formData.customerID) {
        throw new Error('يجب اختيار العميل');
      }

      const cashAmount = parseFloat(formData.cash_amount) || 0;
      const checkAmount = parseFloat(formData.check_amount) || 0;
      
      if (cashAmount <= 0 && checkAmount <= 0) {
        throw new Error('يجب إدخال مبلغ نقدي أو شيك على الأقل');
      }

      const payload = {
        date: formData.date,
        cash_amount: cashAmount,
        check_amount: checkAmount,
        related_party: formData.customerID,
        notes: formData.notes.trim() || undefined,
        created_by: admin?.id || undefined,
      };

      await createWarehouseReceipt(payload);
      
      // Show success toast
      setToast({ message: 'تم إنشاء سند القبض بنجاح', type: 'success' });
      
      // Redirect to cash box after 1.5 seconds
      setTimeout(() => {
        router.push('/admin/warehouse-finance/cash-box');
      }, 1500);
    } catch (err: any) {
      console.error('[NewWarehouseReceipt] Failed to create receipt:', err);
      setError(err?.message || 'فشل إنشاء سند القبض');
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">إضافة سند قبض جديد - المستودع</h1>
            <p className="text-gray-600 mt-1">إنشاء سند قبض جديد للمستودع</p>
          </div>
          <button
            onClick={() => router.push('/admin/warehouse-finance/cash-box')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            <ArrowRight size={20} />
            العودة للصندوق
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Customer */}
            <CustomerSelect
              value={formData.customerID}
              onChange={(customerID) => setFormData({ ...formData, customerID })}
              customers={customers}
              placeholder="اختر العميل"
              required
            />

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                التاريخ <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                required
              />
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  المبلغ النقدي (₪)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cash_amount}
                  onChange={(e) => setFormData({ ...formData, cash_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  المبلغ بالشيك (₪)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.check_amount}
                  onChange={(e) => setFormData({ ...formData, check_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                ملاحظات
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.push('/admin/warehouse-finance/cash-box')}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    حفظ
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast Notification */}
      {toast.type && (
        <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl min-w-[200px] bg-green-600 text-white">
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

