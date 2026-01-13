'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import CustomerSelect from '@/components/admin/CustomerSelect';
import { getWarehousePayment, updateWarehousePayment, getAllCustomers } from '@/lib/api';
import {
  Loader2,
  Save,
  ArrowRight,
} from 'lucide-react';

export default function EditWarehousePaymentPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const params = useParams();
  const paymentId = params.id as string;
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | null }>({ message: '', type: null });
  const [formData, setFormData] = useState({
    customerID: '',
    date: new Date().toISOString().split('T')[0],
    cash_amount: '',
    check_amount: '',
    notes: '',
  });

  useEffect(() => {
    loadPayment();
    loadCustomers();
  }, [paymentId]);

  const loadCustomers = async () => {
    try {
      const data = await getAllCustomers();
      setCustomers(data);
    } catch (err: any) {
      console.error('[EditWarehousePayment] Failed to load customers:', err);
    }
  };

  const loadPayment = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payment = await getWarehousePayment(paymentId);
      console.log('[EditWarehousePayment] Loaded payment:', payment);
      
      // Get customer_id or related_party
      const customerId = payment.customer_id || payment.related_party || '';
      
      // Format date to YYYY-MM-DD format
      let formattedDate = new Date().toISOString().split('T')[0];
      if (payment.date) {
        try {
          // If date is already in YYYY-MM-DD format, use it directly
          if (typeof payment.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(payment.date)) {
            formattedDate = payment.date.split('T')[0]; // Take only date part if it includes time
          } else {
            // Otherwise, parse it as a date
            const dateObj = new Date(payment.date);
            if (!isNaN(dateObj.getTime())) {
              formattedDate = dateObj.toISOString().split('T')[0];
            }
          }
        } catch (e) {
          console.error('[EditWarehousePayment] Error parsing date:', payment.date, e);
        }
      }
      
      console.log('[EditWarehousePayment] Formatted date:', { original: payment.date, formatted: formattedDate });
      
      setFormData({
        customerID: customerId,
        date: formattedDate,
        cash_amount: payment.cash_amount?.toString() || '0',
        check_amount: payment.check_amount?.toString() || '0',
        notes: payment.notes || '',
      });
    } catch (err: any) {
      console.error('[EditWarehousePayment] Failed to load payment:', err);
      setError(err?.message || 'فشل تحميل سند الدفع');
    } finally {
      setIsLoading(false);
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
        customer_id: formData.customerID,
        notes: formData.notes.trim() || undefined,
      };

      await updateWarehousePayment(paymentId, payload, admin?.username);
      
      // Show success toast
      setToast({ message: 'تم تحديث سند الدفع بنجاح', type: 'success' });
      
      // Redirect to cash box after 1.5 seconds
      setTimeout(() => {
        router.push('/admin/warehouse-finance/cash-box');
      }, 1500);
    } catch (err: any) {
      console.error('[EditWarehousePayment] Failed to update payment:', err);
      setError(err?.message || 'فشل تحديث سند الدفع');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">جاري تحميل سند الدفع...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">تعديل سند دفع - المستودع</h1>
            <p className="text-gray-600 mt-1">تعديل سند الدفع رقم: {paymentId}</p>
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
                    حفظ التغييرات
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

