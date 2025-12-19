'use client';

import { useState, useEffect } from 'react';
import { X, Save, Loader2, Banknote } from 'lucide-react';
import { saveShopReceipt, saveShopPayment } from '@/lib/api';
import { useAdminAuth } from '@/context/AdminAuthContext';

interface ReceiptPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: any | null;
  onSuccess: () => void;
  type: 'receipt' | 'payment'; // 'receipt' for سند قبض, 'payment' for سند صرف
}

export default function ReceiptPaymentModal({
  isOpen,
  onClose,
  customer,
  onSuccess,
  type,
}: ReceiptPaymentModalProps) {
  const { admin } = useAdminAuth();
  const canViewBalances = admin?.is_super_admin || admin?.permissions?.viewBalances === true;
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    cashAmount: '',
    chequeAmount: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const formatBalance = (balance: number | undefined | null) => {
    const value = balance || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Reset form when modal opens/closes or customer changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        cashAmount: '',
        chequeAmount: '',
        notes: '',
      });
      setError('');
    }
  }, [isOpen, customer]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Validate that at least one amount is provided
      const cashAmount = parseFloat(formData.cashAmount) || 0;
      const chequeAmount = parseFloat(formData.chequeAmount) || 0;
      
      if (cashAmount === 0 && chequeAmount === 0) {
        setError('يجب إدخال مبلغ نقدي أو شيك على الأقل');
        setIsSubmitting(false);
        return;
      }

      if (!customer || !customer.CustomerID) {
        setError('معرف العميل مطلوب');
        setIsSubmitting(false);
        return;
      }

      const payload = {
        customerID: customer.CustomerID || customer.id || customer.customerID,
        date: formData.date,
        cashAmount: cashAmount > 0 ? cashAmount : undefined,
        chequeAmount: chequeAmount > 0 ? chequeAmount : undefined,
        notes: formData.notes.trim() || undefined,
      };

      if (type === 'receipt') {
        await saveShopReceipt(payload);
      } else {
        await saveShopPayment(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[ReceiptPaymentModal] Failed to save:', err);
      setError(err?.message || `فشل حفظ ${type === 'receipt' ? 'سند القبض' : 'سند الصرف'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const title = type === 'receipt' ? 'إضافة سند قبض' : 'إضافة سند صرف';
  const customerName = customer?.Name || customer?.name || 'غير محدد';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${type === 'receipt' ? 'bg-green-100' : 'bg-red-100'}`}>
              <Banknote size={20} className={type === 'receipt' ? 'text-green-700' : 'text-red-700'} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-600">
                العميل: {customerName}
                {canViewBalances && customer && (customer.Balance || customer.balance) !== undefined && (
                  <span className="ml-2 font-medium text-gray-900">
                    - الرصيد: {formatBalance(customer.Balance || customer.balance || 0)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isSubmitting}
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              التاريخ <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              required
            />
          </div>

          {/* Cash Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              المبلغ النقدي
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.cashAmount}
              onChange={(e) => handleChange('cashAmount', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              placeholder="0.00"
            />
          </div>

          {/* Cheque Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              المبلغ بالشيك
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.chequeAmount}
              onChange={(e) => handleChange('chequeAmount', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              placeholder="0.00"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ملاحظات
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 resize-none"
              placeholder="ملاحظات إضافية..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 px-4 py-2 ${
                type === 'receipt' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              } text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
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
  );
}

