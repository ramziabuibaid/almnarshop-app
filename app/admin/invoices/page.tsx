'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  getCashInvoicesFromSupabase,
  getCashInvoice,
  updateCashInvoiceSettlementStatus,
} from '@/lib/api';
import {
  Loader2,
  FileText,
  Search,
  Printer,
  Edit,
  Eye,
  Lock,
} from 'lucide-react';

interface CashInvoice {
  InvoiceID: string;
  DateTime: string;
  Status: string;
  Notes?: string;
  Discount?: number;
  totalAmount?: number;
  isSettled?: boolean;
}

export default function InvoicesPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const [invoices, setInvoices] = useState<CashInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewing, setViewing] = useState<{
    invoice: any | null;
    details: any[] | null;
  }>({ invoice: null, details: null });
  const [viewLoading, setViewLoading] = useState(false);
  const [updatingSettlement, setUpdatingSettlement] = useState(false);

  // Check if user has permission to view cash invoices
  const canViewCashInvoices = admin?.is_super_admin || admin?.permissions?.viewCashInvoices === true;

  useEffect(() => {
    document.title = 'الفواتير النقدية - Cash Invoices';
  }, []);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCashInvoicesFromSupabase(100);
      setInvoices(data);
    } catch (err: any) {
      console.error('[InvoicesPage] Failed to load invoices:', err);
      setError(err?.message || 'فشل تحميل الفواتير');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintInvoice = (invoice: CashInvoice) => {
    // Open print page in new window - user will click print button manually
    // This prevents browser freezing
    const printUrl = `/admin/invoices/print/${invoice.InvoiceID}`;
    window.open(printUrl, `print-${invoice.InvoiceID}`, 'noopener,noreferrer');
  };


  const handleViewInvoice = async (invoice: CashInvoice) => {
    try {
      setViewLoading(true);
      const fullInvoice = await getCashInvoice(invoice.InvoiceID);
      setViewing({
        invoice: fullInvoice,
        details: fullInvoice?.details || [],
      });
    } catch (err: any) {
      console.error('[InvoicesPage] Failed to view invoice:', err);
      alert(err?.message || 'فشل تحميل بيانات الفاتورة');
    } finally {
      setViewLoading(false);
    }
  };

  const closeView = () => {
    setViewing({ invoice: null, details: null });
  };

  const handleMarkAsSettled = async () => {
    if (!viewing.invoice) return;
    
    const invoiceId = viewing.invoice.InvoiceID || viewing.invoice.invoice_id;
    if (!invoiceId) return;

    if (!confirm('هل أنت متأكد من تغيير حالة الفاتورة إلى مرحلة؟')) {
      return;
    }

    setUpdatingSettlement(true);
    try {
      await updateCashInvoiceSettlementStatus(invoiceId, true);
      // Reload invoice data
      const fullInvoice = await getCashInvoice(invoiceId);
      setViewing({
        invoice: fullInvoice,
        details: fullInvoice?.details || [],
      });
      // Reload invoices list to update the status
      await loadInvoices();
      alert('تم تغيير حالة الفاتورة إلى مرحلة بنجاح');
    } catch (err: any) {
      console.error('[InvoicesPage] Failed to update settlement status:', err);
      alert(err?.message || 'فشل تحديث حالة الفاتورة');
    } finally {
      setUpdatingSettlement(false);
    }
  };

  const handleEditInvoice = (invoice: CashInvoice) => {
    router.push(`/admin/invoices/${invoice.InvoiceID}`);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      // Use Asia/Jerusalem timezone for Palestine (UTC+2 or UTC+3)
      return date.toLocaleString('en-US', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
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

  const filteredInvoices = useMemo(() => {
    if (!searchQuery) return invoices;
    const query = searchQuery.toLowerCase();
    return invoices.filter((invoice) => {
      return String(invoice.InvoiceID || '').toLowerCase().includes(query);
    });
  }, [invoices, searchQuery]);

  // Check permissions
  if (!canViewCashInvoices) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Lock size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2 font-cairo">ليس لديك صلاحية لعرض الفواتير النقدية</p>
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
            <p className="text-gray-600 font-cairo">جاري التحميل...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <p className="text-red-600 text-lg mb-4 font-cairo">{error}</p>
            <button
              onClick={() => {
                loadInvoices().catch((err) => {
                  setError(err?.message || 'فشل تحميل الفواتير');
                });
              }}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 font-cairo" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">أرشيف الفواتير النقدية</h1>
            <p className="text-gray-600 mt-1">عرض وإدارة جميع الفواتير النقدية</p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="بحث برقم الفاتورة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
          </div>
        </div>

        {/* Invoices List */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">لا توجد فواتير</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                      # الفاتورة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                      التاريخ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                      حالة التسوية
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                      الملاحظات
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                      مبلغ الفاتورة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInvoices.map((invoice, index) => (
                    <tr key={invoice.InvoiceID || `invoice-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 font-cairo">{invoice.InvoiceID}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 font-cairo">{formatDate(invoice.DateTime)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-cairo ${
                            invoice.isSettled
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {invoice.isSettled ? 'مرحلة' : 'غير مرحلة'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 max-w-xs truncate font-cairo">
                          {invoice.Notes || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900 font-cairo">
                          {formatCurrency(invoice.totalAmount || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewInvoice(invoice)}
                            className="text-gray-700 hover:text-gray-900 flex items-center gap-1 font-cairo"
                          >
                            <Eye size={16} />
                            عرض
                          </button>
                          <button
                            onClick={() => handlePrintInvoice(invoice)}
                            className="text-blue-600 hover:text-blue-900 flex items-center gap-1 font-cairo"
                          >
                            <Printer size={16} />
                            طباعة
                          </button>
                          <button
                            onClick={() => handleEditInvoice(invoice)}
                            className="text-yellow-600 hover:text-yellow-900 flex items-center gap-1 font-cairo"
                          >
                            <Edit size={16} />
                            تعديل
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        {filteredInvoices.length > 0 && (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600 font-cairo">
              إجمالي الفواتير: <span className="font-semibold">{filteredInvoices.length}</span>
            </p>
          </div>
        )}
      </div>

      {/* Modal عرض الفاتورة */}
      {viewing.invoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" dir="rtl">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900 font-cairo">
                  معاينة الفاتورة: {viewing.invoice.InvoiceID || viewing.invoice.invoice_id}
                </h3>
                <p className="text-sm text-gray-600 font-cairo">
                  التاريخ: {formatDate(viewing.invoice.DateTime || viewing.invoice.date_time)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {viewLoading && <Loader2 size={18} className="animate-spin text-gray-500" />}
                {viewing.invoice && !viewing.invoice.isSettled && (
                  <button
                    onClick={handleMarkAsSettled}
                    disabled={updatingSettlement}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-cairo flex items-center gap-1"
                  >
                    {updatingSettlement ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        جاري التحديث...
                      </>
                    ) : (
                      'تغيير إلى مرحلة'
                    )}
                  </button>
                )}
                <button
                  onClick={closeView}
                  className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo"
                >
                  إغلاق
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-700 font-cairo">
                <div>
                  <div className="text-gray-500">رقم الفاتورة</div>
                  <div className="font-semibold">{viewing.invoice.InvoiceID || viewing.invoice.invoice_id}</div>
                </div>
                <div>
                  <div className="text-gray-500">حالة التسوية</div>
                  <div className="font-semibold">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        viewing.invoice.isSettled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {viewing.invoice.isSettled ? 'مرحلة' : 'غير مرحلة'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">الخصم</div>
                  <div className="font-semibold">{formatCurrency(viewing.invoice.Discount || viewing.invoice.discount || 0)}</div>
                </div>
                <div>
                  <div className="text-gray-500">الصافي</div>
                  <div className="font-semibold">
                    {formatCurrency(
                      (viewing.invoice.totalAmount || viewing.invoice.total_amount || 0)
                    )}
                  </div>
                </div>
              </div>

              {viewing.invoice.Notes && (
                <div className="text-sm text-gray-700 font-cairo">
                  <span className="text-gray-500">ملاحظات: </span>
                  {viewing.invoice.Notes}
                </div>
              )}

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">#</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">الصنف</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">الكمية</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">السعر</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewing.details || []).map((item, idx) => (
                      <tr key={item.detailID || item.detail_id || idx} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-right text-gray-800">{idx + 1}</td>
                        <td className="px-3 py-2 text-right text-gray-800">
                          {item.ProductName || item.productName || item.product_name || item.Name || item.name || '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-800">
                          {item.Quantity || item.quantity || 0}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-800">
                          {formatCurrency(item.UnitPrice || item.unit_price || 0)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-800 font-semibold">
                          {formatCurrency(
                            (item.Quantity || item.quantity || 0) * (item.UnitPrice || item.unit_price || 0)
                          )}
                        </td>
                      </tr>
                    ))}
                    {(viewing.details || []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-gray-500 font-cairo">
                          لا توجد بنود للعرض
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}


