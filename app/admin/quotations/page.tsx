'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  getQuotationsFromSupabase,
  deleteQuotation,
  updateQuotationStatus,
} from '@/lib/api';
import {
  Loader2,
  FileText,
  Search,
  Printer,
  Edit,
  Trash2,
  Plus,
} from 'lucide-react';

interface Quotation {
  QuotationID: string;
  Date: string;
  CustomerID: string | null;
  customer?: { name?: string; phone?: string; address?: string };
  Notes?: string;
  Status: string;
  SpecialDiscountAmount: number;
  GiftDiscountAmount: number;
  totalAmount?: number;
}

const STATUS_OPTIONS = [
  'مسودة',
  'مقدم للزبون',
  'مدفوع كلي أو جزئي تم الحجز',
  'تم تسلم جزء من الطلبية',
  'مسلمة بالكامل',
  'ملغي',
];

export default function QuotationsPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('الكل');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalQuotations, setTotalQuotations] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    loadQuotations();
  }, [currentPage, showAll]);

  const loadQuotations = async () => {
    setLoading(true);
    setError(null);
    try {
      if (showAll) {
        // Load all quotations (use a very large page size)
        const result = await getQuotationsFromSupabase(1, 10000);
        setQuotations(result.quotations);
        setTotalQuotations(result.total);
      } else {
        // Load paginated quotations
        const result = await getQuotationsFromSupabase(currentPage, pageSize);
        setQuotations(result.quotations);
        setTotalQuotations(result.total);
      }
    } catch (err: any) {
      console.error('[QuotationsPage] Failed to load quotations:', err);
      setError(err?.message || 'فشل تحميل العروض السعرية');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (quotationId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العرض السعري؟')) {
      return;
    }

    setDeletingId(quotationId);
    try {
      await deleteQuotation(quotationId);
      // Reload quotations after deletion
      loadQuotations();
    } catch (err: any) {
      console.error('[QuotationsPage] Failed to delete quotation:', err);
      alert(err?.message || 'فشل حذف العرض السعري');
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusChange = async (quotationId: string, newStatus: string) => {
    setUpdatingStatusId(quotationId);
    try {
      await updateQuotationStatus(quotationId, newStatus);
      // Update local state immediately for better UX
      setQuotations(prev => prev.map(q => 
        q.QuotationID === quotationId ? { ...q, Status: newStatus } : q
      ));
    } catch (err: any) {
      console.error('[QuotationsPage] Failed to update quotation status:', err);
      alert(err?.message || 'فشل تحديث حالة العرض السعري');
      // Reload to revert any optimistic update
      loadQuotations();
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const handlePrint = (quotationId: string) => {
    const url = `/admin/quotations/print/${quotationId}`;
    window.open(url, '_blank');
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (!amount || amount === 0) return '₪0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'مسودة': 'bg-gray-100 text-gray-800',
      'مقدم للزبون': 'bg-blue-100 text-blue-800',
      'مدفوع كلي أو جزئي تم الحجز': 'bg-yellow-100 text-yellow-800',
      'تم تسلم جزء من الطلبية': 'bg-orange-100 text-orange-800',
      'مسلمة بالكامل': 'bg-green-100 text-green-800',
      'ملغي': 'bg-red-100 text-red-800',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredQuotations = useMemo(() => {
    let filtered = quotations;
    
    // Apply status filter
    if (statusFilter && statusFilter !== 'الكل') {
      filtered = filtered.filter((quotation) => quotation.Status === statusFilter);
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((quotation) => {
        return (
          String(quotation.QuotationID || '').toLowerCase().includes(query) ||
          String(quotation.CustomerID || '').toLowerCase().includes(query) ||
          String(quotation.Notes || '').toLowerCase().includes(query) ||
          String(quotation.Status || '').toLowerCase().includes(query)
        );
      });
    }
    
    return filtered;
  }, [quotations, searchQuery, statusFilter]);

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
                loadQuotations().catch((err) => {
                  setError(err?.message || 'فشل تحميل العروض السعرية');
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
            <h1 className="text-3xl font-bold text-gray-900">العروض السعرية</h1>
            <p className="text-gray-600 mt-1">
              عرض وإدارة جميع العروض السعرية ({totalQuotations} عرض إجمالي)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setShowAll(!showAll);
                setCurrentPage(1);
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-cairo"
            >
              {showAll ? 'عرض بصفحات' : 'عرض الكل'}
            </button>
            <button
              onClick={() => router.push('/admin/quotations/new')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo"
            >
              <Plus size={20} />
              عرض سعري جديد
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="بحث برقم العرض، الزبون، الملاحظات، أو الحالة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 font-cairo whitespace-nowrap">فلترة:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-cairo"
              >
                <option value="الكل">الكل</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quotations List */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {filteredQuotations.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">لا توجد عروض سعرية</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                      # العرض
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                      التاريخ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                      الزبون
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                      الحالة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                      المبلغ الإجمالي
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                      الملاحظات
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredQuotations.map((quotation, index) => (
                    <tr key={quotation.QuotationID || `quotation-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 font-cairo">{quotation.QuotationID}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 font-cairo">{formatDate(quotation.Date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 font-cairo">
                          {quotation.customer?.name || quotation.CustomerID || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={quotation.Status}
                          onChange={(e) => handleStatusChange(quotation.QuotationID, e.target.value)}
                          disabled={updatingStatusId === quotation.QuotationID}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer font-cairo transition-colors ${getStatusColor(quotation.Status)} ${updatingStatusId === quotation.QuotationID ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status} className="bg-white text-gray-900">
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900 font-cairo">
                          {formatCurrency(quotation.totalAmount || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 max-w-xs truncate font-cairo">
                          {quotation.Notes || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePrint(quotation.QuotationID)}
                            className="text-blue-600 hover:text-blue-900 flex items-center gap-1 font-cairo"
                          >
                            <Printer size={16} />
                            طباعة
                          </button>
                          <button
                            onClick={() => router.push(`/admin/quotations/${quotation.QuotationID}`)}
                            className="text-yellow-600 hover:text-yellow-900 flex items-center gap-1 font-cairo"
                          >
                            <Edit size={16} />
                            تعديل
                          </button>
                          <button
                            onClick={() => handleDelete(quotation.QuotationID)}
                            disabled={deletingId === quotation.QuotationID}
                            className="text-red-600 hover:text-red-900 flex items-center gap-1 font-cairo disabled:opacity-50"
                          >
                            <Trash2 size={16} />
                            حذف
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

        {/* Pagination */}
        {!showAll && totalQuotations > pageSize && (
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600 font-cairo">
              عرض {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalQuotations)} من {totalQuotations}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-cairo"
              >
                السابق
              </button>
              <span className="text-sm text-gray-600 font-cairo">
                صفحة {currentPage} من {Math.ceil(totalQuotations / pageSize)}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalQuotations / pageSize), prev + 1))}
                disabled={currentPage >= Math.ceil(totalQuotations / pageSize)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-cairo"
              >
                التالي
              </button>
            </div>
          </div>
        )}

        {/* Summary */}
        {filteredQuotations.length > 0 && (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600 font-cairo">
              العروض المعروضة: <span className="font-semibold">{filteredQuotations.length}</span> من <span className="font-semibold">{totalQuotations}</span>
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

