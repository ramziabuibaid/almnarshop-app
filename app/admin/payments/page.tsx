'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import CustomerSelect from '@/components/admin/CustomerSelect';
import { Lock } from 'lucide-react';
import { getShopPayments, saveShopPayment, getAllCustomers } from '@/lib/api';
import {
  Loader2,
  FileText,
  Search,
  Printer,
  Plus,
  X,
  Save,
  Edit,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface ShopPayment {
  PayID: string;
  CustomerID: string;
  CustomerName: string;
  Date: string;
  CashAmount: number;
  ChequeAmount: number;
  TotalAmount: number;
  Notes?: string;
  CreatedAt?: string;
}

export default function PaymentsPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  
  // Check if user has permission to access payments page
  const canAccessPayPage = admin?.is_super_admin || admin?.permissions?.accessPayPage === true;
  const [payments, setPayments] = useState<ShopPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPayments, setTotalPayments] = useState(0);
  const PAYMENTS_PER_PAGE = 20;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    customerID: '',
    date: new Date().toISOString().split('T')[0],
    cashAmount: '',
    chequeAmount: '',
    notes: '',
  });

  useEffect(() => {
    document.title = 'سندات الدفع - Payments';
  }, []);

  useEffect(() => {
    loadPayments(1);
    loadCustomers();
  }, []);

  // Reload when page changes
  useEffect(() => {
    if (currentPage > 0) {
      loadPayments(currentPage);
    }
  }, [currentPage]);

  const loadPayments = async (page: number = currentPage) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getShopPayments(page, PAYMENTS_PER_PAGE);
      setPayments(result.payments);
      setTotalPayments(result.total);
    } catch (err: any) {
      console.error('[PaymentsPage] Failed to load payments:', err);
      setError(err?.message || 'فشل تحميل سندات الدفع');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await getAllCustomers();
      setCustomers(data);
    } catch (err: any) {
      console.error('[PaymentsPage] Failed to load customers:', err);
    }
  };

  const handlePrintPayment = (payment: ShopPayment) => {
    // Open print page in new window - will auto-print when loaded
    const printUrl = `/admin/payments/print/${payment.PayID}`;
    window.open(printUrl, `print-payment-${payment.PayID}`, 'noopener,noreferrer');
  };

  const handleAddNew = () => {
    setFormData({
      customerID: '',
      date: new Date().toISOString().split('T')[0],
      cashAmount: '',
      chequeAmount: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
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
        notes: formData.notes.trim() || undefined,
      };

      await saveShopPayment(payload);
      setIsModalOpen(false);
      loadPayments();
    } catch (err: any) {
      console.error('[PaymentsPage] Failed to save payment:', err);
      setError(err?.message || 'فشل حفظ سند الدفع');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        numberingSystem: 'latn',
      });
    } catch {
      return '—';
    }
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (!amount || amount === 0) return '₪0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // For search, we need to filter client-side, but for normal browsing, use server-side pagination
  const filteredPayments = useMemo(() => {
    // If there's a search query, filter client-side
    if (searchQuery.trim()) {
      const searchWords = searchQuery
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0);
      
      return payments.filter((payment) => {
        const payID = String(payment.PayID || '').toLowerCase();
        const customerName = String(payment.CustomerName || '').toLowerCase();
        const customerID = String(payment.CustomerID || '').toLowerCase();
        const searchableText = `${payID} ${customerName} ${customerID}`;
        return searchWords.every(word => searchableText.includes(word));
      });
    }
    // No search - return all loaded payments (already paginated from server)
    return payments;
  }, [payments, searchQuery]);

  // Pagination - use totalPayments for total pages when not searching
  const totalPages = Math.ceil((searchQuery.trim() ? filteredPayments.length : totalPayments) / PAYMENTS_PER_PAGE);
  const startIndex = (currentPage - 1) * PAYMENTS_PER_PAGE;
  const endIndex = startIndex + PAYMENTS_PER_PAGE;
  const paginatedPayments = searchQuery.trim() 
    ? filteredPayments.slice(startIndex, endIndex)
    : filteredPayments; // Already paginated from server

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Check permissions
  if (!canAccessPayPage) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Lock size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2 font-cairo">ليس لديك صلاحية للوصول إلى صفحة سندات دفع المحل</p>
            <p className="text-gray-500 text-sm font-cairo">يرجى التواصل مع المشرف للحصول على الصلاحية</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">جاري تحميل سندات الدفع...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">سندات دفع المحل</h1>
            <p className="text-gray-600 mt-1">
              إدارة سندات دفع المحل ({searchQuery.trim() ? filteredPayments.length : totalPayments} سند)
            </p>
          </div>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            <Plus size={20} />
            إضافة سند جديد
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="relative">
            <Search
              size={20}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="بحث برقم السند أو اسم العميل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* Payments Table */}
        {filteredPayments.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FileText size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">لا توجد سندات دفع</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      رقم السند
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      العميل
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      التاريخ
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      نقدي
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      شيك
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      الإجمالي
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedPayments.map((payment) => (
                    <tr key={payment.PayID} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-gray-900">{payment.PayID}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                              window.open(`/admin/customers/${payment.CustomerID}`, '_blank', 'noopener,noreferrer');
                              return;
                            }
                            router.push(`/admin/customers/${payment.CustomerID}`);
                          }}
                          onMouseDown={(e) => {
                            if (e.button === 1) {
                              e.preventDefault();
                              window.open(`/admin/customers/${payment.CustomerID}`, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          title="فتح بروفايل الزبون (Ctrl+Click أو Shift+Click لفتح في تبويب جديد)"
                        >
                          {payment.CustomerName || payment.CustomerID}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-gray-600">{formatDate(payment.Date)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-gray-900">{formatCurrency(payment.CashAmount)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-gray-900">{formatCurrency(payment.ChequeAmount)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-semibold text-gray-900">{formatCurrency(payment.TotalAmount)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => router.push(`/admin/payments/edit/${payment.PayID}`)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="تعديل"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handlePrintPayment(payment)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="طباعة"
                          >
                            <Printer size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  عرض {startIndex + 1} إلى {Math.min(endIndex, searchQuery.trim() ? filteredPayments.length : totalPayments)} من {searchQuery.trim() ? filteredPayments.length : totalPayments} سند
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="الصفحة السابقة"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <div className="text-sm text-gray-700">
                    صفحة {currentPage} من {totalPages}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="الصفحة التالية"
                  >
                    <ChevronLeft size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Payment Modal */}
      {isModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-bold text-gray-900">إضافة سند دفع جديد</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  disabled={isSubmitting}
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>

              {/* Form */}
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
                    onClick={() => setIsModalOpen(false)}
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
        </>
      )}
    </AdminLayout>
  );
}

