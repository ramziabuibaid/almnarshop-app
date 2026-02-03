'use client';

import { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  getQuotationsFromSupabase,
  searchQuotationById,
  deleteQuotation,
  updateQuotationStatus,
} from '@/lib/api';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  FileText,
  Search,
  Printer,
  Edit,
  Trash2,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Quotation {
  QuotationID: string;
  Date: string;
  CustomerID: string | null;
  customer?: { name?: string; phone?: string; address?: string; shamelNo?: string };
  Notes?: string;
  Status: string;
  SpecialDiscountAmount: number;
  GiftDiscountAmount: number;
  totalAmount?: number;
  CreatedAt?: string;
  CreatedBy?: string;
  created_by?: string;
  createdBy?: string;
  user_id?: string;
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
  const { admin } = useAdminAuth();
  const router = useRouter();
  // Check if user has accountant permission (for status changes)
  const canAccountant = admin?.is_super_admin || admin?.permissions?.accountant === true;
  const [allQuotations, setAllQuotations] = useState<Quotation[]>([]); // Store all loaded quotations
  const [loading, setLoading] = useState(true); // Start with loading true

  useLayoutEffect(() => {
    document.title = 'العروض السعرية';
  }, []);
  const [loadingMore, setLoadingMore] = useState(false); // For background loading
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('الكل');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const QUOTATIONS_PER_PAGE = 50;
  const [searchByIdResult, setSearchByIdResult] = useState<Quotation | null>(null);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    document.title = 'العروض السعرية - Quotations';
  }, []);

  useEffect(() => {
    document.title = 'العروض السعرية - Quotations';
    loadUsers();
    loadFirstPage();
  }, []);

  const loadUsers = async () => {
    try {
      // Fetch admin users from Supabase
      const { data: users, error } = await supabase
        .from('admin_users')
        .select('id, username')
        .order('username');

      if (error) {
        console.error('[Quotations] Failed to load users:', error);
        return;
      }

      // Create a map from user_id to username
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
      console.error('[Quotations] Failed to load users:', err);
    }
  };

  // Load last 50 quotations only (same technique as cash invoices; use Search by ID for older)
  const loadFirstPage = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getQuotationsFromSupabase(1, QUOTATIONS_PER_PAGE);
      setAllQuotations(result.quotations);
    } catch (err: any) {
      console.error('[QuotationsPage] Failed to load quotations:', err);
      setError(err?.message || 'فشل تحميل العروض السعرية');
      setAllQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  // When user searches, try to fetch by exact quotation ID so older quotations (not in last 50) can be found
  useEffect(() => {
    const q = (searchQuery || '').trim();
    if (!q) {
      setSearchByIdResult(null);
      return;
    }
    let cancelled = false;
    searchQuotationById(q).then((found) => {
      if (!cancelled && found) setSearchByIdResult(found);
      else if (!cancelled) setSearchByIdResult(null);
    });
    return () => { cancelled = true; };
  }, [searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const handleDelete = async (quotationId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العرض السعري؟')) {
      return;
    }

    setDeletingId(quotationId);
    try {
      await deleteQuotation(quotationId);
      // Update local state immediately (optimistic update like maintenance page)
      setAllQuotations(prev => prev.filter(q => q.QuotationID !== quotationId));
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
      // Update local state immediately (optimistic update like maintenance page)
      setAllQuotations(prev => prev.map(q => 
        q.QuotationID === quotationId ? { ...q, Status: newStatus } : q
      ));
    } catch (err: any) {
      console.error('[QuotationsPage] Failed to update quotation status:', err);
      alert(err?.message || 'فشل تحديث حالة العرض السعري');
      // Reload to revert any optimistic update
      await loadFirstPage();
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      // Use Asia/Jerusalem timezone for Palestine (UTC+2 or UTC+3)
      // Format as dd/mm/yyyy
      const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD
      const [year, month, day] = dateStr.split('-');
      // Return as dd/mm/yyyy
      return `${day}/${month}/${year}`;
    } catch {
      return '—';
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      // Use Asia/Jerusalem timezone for Palestine (UTC+2 or UTC+3)
      return date.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return '';
    }
  };

  const handlePrint = (quotationId: string) => {
    // Open print page in new window - will auto-print when loaded
    const url = `/admin/quotations/print/${quotationId}`;
    window.open(url, `print-quotation-${quotationId}`, 'noopener,noreferrer');
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

  // Apply client-side search and filters (like maintenance page)
  const filteredQuotations = useMemo(() => {
    let filtered = allQuotations;

    // Apply search - supports multiple words (like maintenance page)
    if (searchQuery.trim()) {
      const searchWords = searchQuery
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0);
      
      filtered = filtered.filter((quotation) => {
        const quotationId = String(quotation.QuotationID || '').toLowerCase();
        const customerName = String(quotation.customer?.name || '').toLowerCase();
        const customerId = String(quotation.CustomerID || '').toLowerCase();
        const notes = String(quotation.Notes || '').toLowerCase();
        
        const searchableText = `${quotationId} ${customerName} ${customerId} ${notes}`;
        
        return searchWords.every(word => searchableText.includes(word));
      });
    }
    
    // Apply status filter
    if (statusFilter && statusFilter !== 'الكل') {
      filtered = filtered.filter((quotation) => quotation.Status === statusFilter);
    }

    // Include search-by-ID result so user can find quotations not in the last 50
    if (searchByIdResult && !filtered.some((q) => q.QuotationID === searchByIdResult.QuotationID)) {
      return [searchByIdResult, ...filtered];
    }
    
    return filtered;
  }, [allQuotations, searchQuery, statusFilter, searchByIdResult]);

  // Client-side pagination (like maintenance page)
  const totalPages = Math.ceil(filteredQuotations.length / QUOTATIONS_PER_PAGE);
  const paginatedQuotations = useMemo(() => {
    const startIndex = (currentPage - 1) * QUOTATIONS_PER_PAGE;
    return filteredQuotations.slice(startIndex, startIndex + QUOTATIONS_PER_PAGE);
  }, [filteredQuotations, currentPage]);

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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 font-cairo">العروض السعرية</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base font-cairo">
              عرض وإدارة جميع العروض السعرية ({allQuotations.length.toLocaleString('en-US')} عرض محمل
              {loadingMore && <span className="text-blue-600"> - جاري تحميل المزيد...</span>})
            </p>
          </div>
          <button
            onClick={() => router.push('/admin/quotations/new')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo w-full sm:w-auto text-sm sm:text-base"
          >
            <Plus size={20} />
            <span>عرض سعري جديد</span>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="بحث برقم العرض، الزبون، الملاحظات، أو الحالة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-500 font-cairo"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="مسح البحث"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 font-cairo whitespace-nowrap">فلترة:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 sm:flex-none px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-cairo"
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

        {/* Search Results Info */}
        {searchQuery && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              تم العثور على <span className="font-semibold">{filteredQuotations.length}</span> عرض سعري يطابق البحث
            </p>
          </div>
        )}

        {/* Quotations List */}
        {filteredQuotations.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 sm:p-12 text-center">
            <FileText size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-base sm:text-lg font-cairo">
              {searchQuery ? 'لم يتم العثور على عروض سعرية تطابق البحث' : 'لا توجد عروض سعرية'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedQuotations.map((quotation, index) => (
                      <tr key={quotation.QuotationID || `quotation-${index}`} className="hover:bg-gray-200 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 font-cairo">
                            {quotation.QuotationID}
                          </div>
                          {(() => {
                            const userId = quotation.created_by || quotation.createdBy || quotation.user_id || quotation.CreatedBy || '';
                            if (userId && userMap.has(userId)) {
                              const username = userMap.get(userId);
                              return (
                                <div className="text-xs text-gray-500 font-cairo mt-1">
                                  {username}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600 font-cairo">
                            <div>{formatDate(quotation.Date)}</div>
                          {quotation.CreatedAt && (
                              <div className="text-xs text-gray-500 mt-0.5">{formatTime(quotation.CreatedAt)}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {quotation.CustomerID ? (
                            <div>
                              <button
                                onClick={(e) => {
                                  if (e.ctrlKey || e.metaKey || e.shiftKey) {
                                    window.open(`/admin/customers/${quotation.CustomerID}`, '_blank', 'noopener,noreferrer');
                                    return;
                                  }
                                  router.push(`/admin/customers/${quotation.CustomerID}`);
                                }}
                                onMouseDown={(e) => {
                                  if (e.button === 1) {
                                    e.preventDefault();
                                    window.open(`/admin/customers/${quotation.CustomerID}`, '_blank', 'noopener,noreferrer');
                                  }
                                }}
                                className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-cairo"
                                title="فتح بروفايل الزبون (Ctrl+Click أو Shift+Click لفتح في تبويب جديد)"
                              >
                                {quotation.customer?.name || quotation.CustomerID}
                              </button>
                              {quotation.customer?.shamelNo && (
                                <div className="text-xs text-gray-500 font-cairo mt-1">
                                  {quotation.customer.shamelNo}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-600 font-cairo">
                              {quotation.customer?.name || '—'}
                              {quotation.customer?.shamelNo && (
                                <div className="text-xs text-gray-500 font-cairo mt-1">
                                  {quotation.customer.shamelNo}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {canAccountant ? (
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
                          ) : (
                            <span className={`inline-flex px-3 py-1.5 text-xs font-semibold rounded-lg font-cairo ${getStatusColor(quotation.Status)}`}>
                              {quotation.Status}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900 font-cairo">
                            {formatCurrency(quotation.totalAmount || 0)}
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
                            {canAccountant && (
                              <button
                                onClick={() => handleDelete(quotation.QuotationID)}
                                disabled={deletingId === quotation.QuotationID}
                                className="text-red-600 hover:text-red-900 flex items-center gap-1 font-cairo disabled:opacity-50"
                              >
                                <Trash2 size={16} />
                                حذف
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {paginatedQuotations.map((quotation, index) => (
                <div key={quotation.QuotationID || `quotation-${index}`} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-200">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-gray-900 font-cairo">#{quotation.QuotationID}</h3>
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-lg font-cairo ${getStatusColor(quotation.Status)}`}>
                          {quotation.Status}
                        </span>
                      </div>
                      {(() => {
                        const userId = quotation.created_by || quotation.createdBy || quotation.user_id || quotation.CreatedBy || '';
                        if (userId && userMap.has(userId)) {
                          const username = userMap.get(userId);
                          return (
                            <div className="text-xs text-gray-500 font-cairo">
                              {username}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-gray-900 font-cairo mb-1">
                        {formatCurrency(quotation.totalAmount || 0)}
                      </div>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="mb-3">
                    {quotation.CustomerID ? (
                      <button
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey || e.shiftKey) {
                            window.open(`/admin/customers/${quotation.CustomerID}`, '_blank', 'noopener,noreferrer');
                            return;
                          }
                          router.push(`/admin/customers/${quotation.CustomerID}`);
                        }}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-semibold text-sm font-cairo text-right w-full"
                        title="فتح بروفايل الزبون"
                      >
                        {quotation.customer?.name || quotation.CustomerID}
                      </button>
                    ) : (
                      <div className="text-sm text-gray-600 font-cairo">
                        {quotation.customer?.name || '—'}
                      </div>
                    )}
                    {quotation.customer?.shamelNo && (
                      <div className="text-xs text-gray-500 font-cairo mt-1">
                        {quotation.customer.shamelNo}
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 font-cairo mb-1">التاريخ</div>
                    <div className="text-sm text-gray-900 font-cairo">
                      {formatDate(quotation.Date)}
                      {quotation.CreatedAt && (
                        <div className="text-xs text-gray-500 mt-0.5">{formatTime(quotation.CreatedAt)}</div>
                      )}
                    </div>
                  </div>

                  {/* Status (for accountant) */}
                  {canAccountant && (
                    <div className="mb-3">
                      <div className="text-xs text-gray-500 font-cairo mb-1">الحالة</div>
                      <select
                        value={quotation.Status}
                        onChange={(e) => handleStatusChange(quotation.QuotationID, e.target.value)}
                        disabled={updatingStatusId === quotation.QuotationID}
                        className={`w-full px-3 py-2 text-sm font-semibold rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer font-cairo transition-colors ${getStatusColor(quotation.Status)} ${updatingStatusId === quotation.QuotationID ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status} className="bg-white text-gray-900">
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => handlePrint(quotation.QuotationID)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-cairo"
                    >
                      <Printer size={16} />
                      <span>طباعة</span>
                    </button>
                    <button
                      onClick={() => router.push(`/admin/quotations/${quotation.QuotationID}`)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-cairo"
                    >
                      <Edit size={16} />
                      <span>تعديل</span>
                    </button>
                    {canAccountant && (
                      <button
                        onClick={() => handleDelete(quotation.QuotationID)}
                        disabled={deletingId === quotation.QuotationID}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-cairo disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingId === quotation.QuotationID ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                        <span>حذف</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {filteredQuotations.length > 0 && totalPages > 1 && (
          <div className="bg-gray-50 border-t border-gray-200 px-3 sm:px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-gray-700 font-cairo text-center sm:text-right">
              عرض <span className="font-semibold">{((currentPage - 1) * QUOTATIONS_PER_PAGE) + 1}</span> إلى{' '}
              <span className="font-semibold">
                {Math.min(currentPage * QUOTATIONS_PER_PAGE, filteredQuotations.length)}
              </span>{' '}
              من <span className="font-semibold">{filteredQuotations.length}</span> عرض سعري
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="الصفحة السابقة"
              >
                <ChevronRight size={20} className="text-gray-600" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 rounded-lg transition-colors text-sm font-cairo ${
                        currentPage === pageNum
                          ? 'bg-gray-900 text-white'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="الصفحة التالية"
              >
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
            </div>
          </div>
        )}


      </div>
    </AdminLayout>
  );
}

