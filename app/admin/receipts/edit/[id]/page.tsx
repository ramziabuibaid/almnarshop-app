'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import CustomerSelect from '@/components/admin/CustomerSelect';
import { getShopReceipt, updateShopReceipt, deleteShopReceipt, getAllCustomers } from '@/lib/api';
import {
  Loader2,
  Save,
  Trash2,
  ArrowLeft,
  X,
} from 'lucide-react';

export default function EditReceiptPage() {
  const router = useRouter();
  const params = useParams();
  const { admin } = useAdminAuth();
  const receiptId = params?.id as string;
  
  // Check if user has accountant permission (for delete)
  const canAccountant = admin?.is_super_admin || admin?.permissions?.accountant === true;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    customerID: '',
    date: new Date().toISOString().split('T')[0],
    cashAmount: '',
    chequeAmount: '',
    notes: '',
  });

  useEffect(() => {
    if (receiptId) {
      loadReceipt();
      loadCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptId]);

  const loadReceipt = async () => {
    setLoading(true);
    setError(null);
    try {
      const receipt = await getShopReceipt(receiptId);
      
      // Format date for input
      const receiptDate = receipt.Date ? new Date(receipt.Date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      
      setFormData({
        customerID: receipt.CustomerID || '',
        date: receiptDate,
        cashAmount: receipt.CashAmount ? receipt.CashAmount.toString() : '',
        chequeAmount: receipt.ChequeAmount ? receipt.ChequeAmount.toString() : '',
        notes: receipt.Notes || '',
      });
    } catch (err: any) {
      console.error('[EditReceiptPage] Failed to load receipt:', err);
      setError(err?.message || 'فشل تحميل سند القبض');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await getAllCustomers();
      setCustomers(data);
    } catch (err: any) {
      console.error('[EditReceiptPage] Failed to load customers:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!formData.customerID) {
        throw new Error('يجب اختيار العميل');
      }

      const payload = {
        customerID: formData.customerID,
        date: formData.date,
        cashAmount: formData.cashAmount ? parseFloat(formData.cashAmount) : 0,
        chequeAmount: formData.chequeAmount ? parseFloat(formData.chequeAmount) : 0,
        notes: formData.notes || undefined,
      };

      await updateShopReceipt(receiptId, payload);
      router.push('/admin/receipts');
    } catch (err: any) {
      console.error('[EditReceiptPage] Failed to update receipt:', err);
      setError(err?.message || 'فشل تحديث سند القبض');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذا السند؟ لا يمكن التراجع عن هذا الإجراء.')) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteShopReceipt(receiptId);
      router.push('/admin/receipts');
    } catch (err: any) {
      console.error('[EditReceiptPage] Failed to delete receipt:', err);
      setError(err?.message || 'فشل حذف سند القبض');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 size={32} className="animate-spin text-gray-600" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/receipts')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">تعديل سند قبض</h1>
            <span className="text-gray-500">#{receiptId}</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

            {/* Cash Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                المبلغ النقدي
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.cashAmount}
                onChange={(e) => setFormData({ ...formData, cashAmount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                placeholder="0.00"
              />
            </div>

            {/* Cheque Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                المبلغ بالشيك
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.chequeAmount}
                onChange={(e) => setFormData({ ...formData, chequeAmount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                placeholder="0.00"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                الملاحظات
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                placeholder="ملاحظات إضافية..."
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>حفظ التغييرات</span>
                  </>
                )}
              </button>

              {canAccountant && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>جاري الحذف...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      <span>حذف السند</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => router.push('/admin/receipts')}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}

