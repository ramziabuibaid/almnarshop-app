'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { getWarehouseSalesInvoices, getWarehouseSalesInvoice, searchWarehouseSalesInvoiceById, updateWarehouseSalesInvoiceSign, updateWarehouseSalesInvoiceStatus } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Lock } from 'lucide-react';
import {
  Loader2,
  FileText,
  Search,
  Printer,
  Plus,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  ChevronDown,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface WarehouseSalesInvoice {
  InvoiceID: string;
  CustomerID: string;
  CustomerName: string;
  CustomerShamelNo?: string;
  Date: string;
  AccountantSign: string;
  Notes?: string;
  Discount: number;
  Status: string;
  TotalAmount: number;
  CreatedAt?: string;
  created_by?: string;
  createdBy?: string;
  user_id?: string;
}

export default function WarehouseSalesPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const [allInvoices, setAllInvoices] = useState<WarehouseSalesInvoice[]>([]); // Store all loaded invoices
  const [loading, setLoading] = useState(true); // Start with loading true

  useLayoutEffect(() => {
    document.title = 'فواتير مبيعات المخزن';
  }, []);
  const [loadingMore, setLoadingMore] = useState(false); // For background loading
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [signFilter, setSignFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const INVOICES_PER_PAGE = 50;
  const [searchByIdResult, setSearchByIdResult] = useState<WarehouseSalesInvoice | null>(null);
  const [viewing, setViewing] = useState<{
    invoice: any | null;
    details: any[] | null;
  }>({ invoice: null, details: null });
  const [viewLoading, setViewLoading] = useState(false);
  const [updatingSettlement, setUpdatingSettlement] = useState(false);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<string | null>(null);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const [printOverlayInvoiceId, setPrintOverlayInvoiceId] = useState<string | null>(null);
  const printIframeRef = useRef<HTMLIFrameElement>(null);
  const isMobilePrint = () => typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Check if user has permission to access warehouse invoices
  const canAccessWarehouseInvoices = admin?.is_super_admin || admin?.permissions?.accessWarehouseInvoices === true;
  // Check if user has accountant permission (for posting and status changes)
  const canAccountant = admin?.is_super_admin || admin?.permissions?.accountant === true;

  useEffect(() => {
    document.title = 'مبيعات المخزن - Warehouse Sales';
    loadFirstPage();
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data: users, error } = await supabase
        .from('admin_users')
        .select('id, username')
        .order('username');

      if (error) {
        console.error('[WarehouseSalesPage] Failed to load users:', error);
        return;
      }

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
      console.error('[WarehouseSalesPage] Failed to load users:', err);
    }
  };

  // Load last 50 invoices only (same technique as cash invoices; use Search by ID for older)
  const loadFirstPage = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getWarehouseSalesInvoices(1, INVOICES_PER_PAGE);
      setAllInvoices(result.invoices);
    } catch (err: any) {
      console.error('[WarehouseSalesPage] Failed to load invoices:', err);
      setError(err?.message || 'فشل تحميل الفواتير');
      setAllInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  // When user searches, try to fetch by exact invoice ID so older invoices (not in last 50) can be found
  useEffect(() => {
    const q = (searchQuery || '').trim();
    if (!q) {
      setSearchByIdResult(null);
      return;
    }
    let cancelled = false;
    searchWarehouseSalesInvoiceById(q).then((found) => {
      if (!cancelled && found) setSearchByIdResult(found);
      else if (!cancelled) setSearchByIdResult(null);
    });
    return () => { cancelled = true; };
  }, [searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, signFilter]);

  useEffect(() => {
    if (!printOverlayInvoiceId) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'print-ready' && printIframeRef.current?.contentWindow) {
        try {
          printIframeRef.current.contentWindow.print();
        } catch (_) {}
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [printOverlayInvoiceId]);

  const handlePrintInvoice = (invoice: WarehouseSalesInvoice) => {
    if (isMobilePrint()) {
      window.open(`/admin/warehouse-sales/print/${invoice.InvoiceID}`, `print-warehouse-${invoice.InvoiceID}`, 'noopener,noreferrer');
      return;
    }
    setPrintOverlayInvoiceId(invoice.InvoiceID);
  };

  const handleEditInvoice = (invoice: WarehouseSalesInvoice) => {
    if (invoice.AccountantSign === 'مرحلة') {
      alert('لا يمكن تعديل فاتورة مرحلة');
      return;
    }
    router.push(`/admin/warehouse-sales/edit/${invoice.InvoiceID}`);
  };

  const handleViewInvoice = async (invoice: WarehouseSalesInvoice) => {
    // Show modal immediately with basic invoice data (optimistic display)
    setViewing({
      invoice: invoice as any, // Use the invoice from the list immediately
      details: [], // Will be loaded
    });
    setViewLoading(true);
    
    // Load full invoice data in background
    try {
      const fullInvoice = await getWarehouseSalesInvoice(invoice.InvoiceID);
      setViewing({
        invoice: fullInvoice,
        details: fullInvoice?.Items || [],
      });
    } catch (err: any) {
      console.error('[WarehouseSalesPage] Failed to view invoice:', err);
      alert(err?.message || 'فشل تحميل بيانات الفاتورة');
      // Keep the modal open with basic data
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

    setUpdatingSettlement(true);
    try {
      await updateWarehouseSalesInvoiceSign(invoiceId, 'مرحلة');
      // Reload invoice data
      const fullInvoice = await getWarehouseSalesInvoice(invoiceId);
      setViewing({
        invoice: fullInvoice,
        details: fullInvoice?.Items || [],
      });
      // Update local state immediately (optimistic update like maintenance page)
      setAllInvoices(prev => prev.map(inv => 
        inv.InvoiceID === invoiceId ? { ...inv, AccountantSign: 'مرحلة' } : inv
      ));
    } catch (err: any) {
      console.error('[WarehouseSalesPage] Failed to update settlement status:', err);
      alert(err?.message || 'فشل تحديث حالة الترحيل');
    } finally {
      setUpdatingSettlement(false);
    }
  };

  const handleMarkAsSettledFromTable = async (invoice: WarehouseSalesInvoice) => {
    const invoiceId = invoice.InvoiceID;
    if (!invoiceId) return;

    setUpdatingSettlement(true);
    setUpdatingInvoiceId(invoiceId);
    try {
      await updateWarehouseSalesInvoiceSign(invoiceId, 'مرحلة');
      // Update local state immediately
      setAllInvoices(prev => prev.map(inv => 
        inv.InvoiceID === invoiceId ? { ...inv, AccountantSign: 'مرحلة' } : inv
      ));
    } catch (err: any) {
      console.error('[WarehouseSalesPage] Failed to update settlement status:', err);
      alert(err?.message || 'فشل تحديث حالة الفاتورة');
    } finally {
      setUpdatingSettlement(false);
      setUpdatingInvoiceId(null);
    }
  };

  const handleMarkAsUnsettled = async (invoice: WarehouseSalesInvoice) => {
    const invoiceId = invoice.InvoiceID;
    if (!invoiceId) return;

    setUpdatingSettlement(true);
    setUpdatingInvoiceId(invoiceId);
    try {
      await updateWarehouseSalesInvoiceSign(invoiceId, 'غير مرحلة');
      // Update local state immediately
      setAllInvoices(prev => prev.map(inv => 
        inv.InvoiceID === invoiceId ? { ...inv, AccountantSign: 'غير مرحلة' } : inv
      ));
    } catch (err: any) {
      console.error('[WarehouseSalesPage] Failed to update settlement status:', err);
      alert(err?.message || 'فشل تحديث حالة الفاتورة');
    } finally {
      setUpdatingSettlement(false);
      setUpdatingInvoiceId(null);
    }
  };

  const handleStatusChange = async (invoice: WarehouseSalesInvoice, newStatus: 'غير مدفوع' | 'تقسيط شهري' | 'دفعت بالكامل' | 'مدفوع جزئي') => {
    // Check permission
    if (!canAccountant) {
      alert('ليس لديك صلاحية لتغيير حالة الفاتورة');
      return;
    }

    try {
      await updateWarehouseSalesInvoiceStatus(invoice.InvoiceID, newStatus);
      // Update local state immediately (optimistic update like maintenance page)
      setAllInvoices(prev => prev.map(inv => 
        inv.InvoiceID === invoice.InvoiceID ? { ...inv, Status: newStatus } : inv
      ));
    } catch (err: any) {
      console.error('[WarehouseSalesPage] Failed to update status:', err);
      alert('فشل تحديث الحالة: ' + (err?.message || 'خطأ غير معروف'));
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

  const formatCurrency = (amount: number | undefined | null) => {
    if (!amount || amount === 0) return '₪0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Apply client-side search and filters (like maintenance page)
  const filteredInvoices = useMemo(() => {
    let filtered = allInvoices;

    // Apply search - supports multiple words (like maintenance page)
    if (searchQuery.trim()) {
      const searchWords = searchQuery
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0);
      
      filtered = filtered.filter((invoice) => {
        const invoiceId = String(invoice.InvoiceID || '').toLowerCase();
        const customerName = String(invoice.CustomerName || '').toLowerCase();
        const customerId = String(invoice.CustomerID || '').toLowerCase();
        
        const searchableText = `${invoiceId} ${customerName} ${customerId}`;
        
        return searchWords.every(word => searchableText.includes(word));
      });
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((invoice) => invoice.Status === statusFilter);
    }

    // Filter by accountant sign
    if (signFilter !== 'all') {
      filtered = filtered.filter((invoice) => invoice.AccountantSign === signFilter);
    }

    // Include search-by-ID result so user can find invoices not in the last 50
    if (searchByIdResult && !filtered.some((inv) => inv.InvoiceID === searchByIdResult.InvoiceID)) {
      return [searchByIdResult, ...filtered];
    }
    return filtered;
  }, [allInvoices, searchQuery, statusFilter, signFilter, searchByIdResult]);

  // Client-side pagination (like maintenance page)
  const totalPages = Math.ceil(filteredInvoices.length / INVOICES_PER_PAGE);
  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * INVOICES_PER_PAGE;
    return filteredInvoices.slice(startIndex, startIndex + INVOICES_PER_PAGE);
  }, [filteredInvoices, currentPage]);

  // Check permissions
  if (!canAccessWarehouseInvoices) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Lock size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2 font-cairo">ليس لديك صلاحية للوصول إلى صفحة فواتير مبيعات المخزن</p>
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
            <p className="text-gray-600">جاري تحميل الفواتير...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 font-cairo">فواتير مبيعات المخزن</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base font-cairo">
              إدارة فواتير مبيعات المخزن ({allInvoices.length.toLocaleString('en-US')} فاتورة محملة
              {loadingMore && <span className="text-blue-600"> - جاري تحميل المزيد...</span>})
            </p>
          </div>
          <button
            onClick={() => router.push('/admin/warehouse-sales/new')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium w-full sm:w-auto text-sm sm:text-base font-cairo"
          >
            <Plus size={20} />
            <span>إضافة فاتورة جديدة</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search
                size={20}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="بحث برقم الفاتورة أو اسم العميل أو رقم الزبون..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-500"
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

            {/* Accountant Sign Filter */}
            <div className="relative">
              <select
                value={signFilter}
                onChange={(e) => setSignFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 appearance-none pr-8"
              >
                <option value="all">جميع حالات الترحيل</option>
                <option value="مرحلة">مرحلة</option>
                <option value="غير مرحلة">غير مرحلة</option>
              </select>
              <ChevronDown size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Search Results Info */}
        {searchQuery && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              تم العثور على <span className="font-semibold">{filteredInvoices.length}</span> فاتورة تطابق البحث
            </p>
          </div>
        )}

        {/* Invoices Table */}
        {filteredInvoices.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 sm:p-12 text-center">
            <FileText size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-base sm:text-lg font-cairo">
              {searchQuery ? 'لم يتم العثور على فواتير تطابق البحث' : 'لا توجد فواتير'}
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
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider font-cairo">
                        رقم الفاتورة
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider font-cairo">
                        العميل
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider font-cairo">
                        التاريخ
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider font-cairo">
                        الترحيل
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider font-cairo">
                        الإجمالي
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider font-cairo">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedInvoices.map((invoice) => (
                      <tr key={invoice.InvoiceID} className="hover:bg-gray-200 transition-colors">
                        <td className="px-4 py-3 text-right">
                          <div className="font-medium text-gray-900 font-cairo">{invoice.InvoiceID}</div>
                          {(() => {
                            const userId = invoice.created_by || invoice.createdBy || invoice.user_id || '';
                            if (userId && userMap.has(userId)) {
                              const username = userMap.get(userId);
                              return (
                                <div className="text-xs text-gray-500 mt-1 font-cairo">
                                  {username}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey || e.shiftKey) {
                                window.open(`/admin/customers/${invoice.CustomerID}`, '_blank', 'noopener,noreferrer');
                                return;
                              }
                              router.push(`/admin/customers/${invoice.CustomerID}`);
                            }}
                            onMouseDown={(e) => {
                              if (e.button === 1) {
                                e.preventDefault();
                                window.open(`/admin/customers/${invoice.CustomerID}`, '_blank', 'noopener,noreferrer');
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium font-cairo"
                            title="فتح بروفايل الزبون (Ctrl+Click أو Shift+Click لفتح في تبويب جديد)"
                          >
                            {invoice.CustomerName || invoice.CustomerID}
                          </button>
                          {invoice.CustomerShamelNo && (
                            <div className="text-xs text-gray-500 font-cairo mt-1">
                              {invoice.CustomerShamelNo}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-gray-600 font-cairo">
                            <div>{formatDate(invoice.Date)}</div>
                            {invoice.CreatedAt && (
                              <div className="text-xs text-gray-500 mt-0.5">{formatTime(invoice.CreatedAt)}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-cairo ${
                              invoice.AccountantSign === 'مرحلة'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {invoice.AccountantSign === 'مرحلة' ? 'مرحلة' : 'غير مرحلة'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold text-gray-900 font-cairo">{formatCurrency(invoice.TotalAmount)}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => handleViewInvoice(invoice)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="عرض"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              onClick={() => handleEditInvoice(invoice)}
                              disabled={invoice.AccountantSign === 'مرحلة'}
                              className={`p-2 rounded-lg transition-colors ${
                                invoice.AccountantSign === 'مرحلة'
                                  ? 'text-gray-400 cursor-not-allowed opacity-50'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                              title={invoice.AccountantSign === 'مرحلة' ? 'لا يمكن تعديل فاتورة مرحلة' : 'تعديل'}
                            >
                              <Edit size={18} />
                            </button>
                            {canAccountant && invoice.AccountantSign !== 'مرحلة' && (
                              <button
                                onClick={() => handleMarkAsSettledFromTable(invoice)}
                                disabled={updatingSettlement && updatingInvoiceId === invoice.InvoiceID}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="تغيير إلى مرحلة"
                              >
                                {updatingSettlement && updatingInvoiceId === invoice.InvoiceID ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <CheckCircle size={18} />
                                )}
                              </button>
                            )}
                            {canAccountant && invoice.AccountantSign === 'مرحلة' && (
                              <button
                                onClick={() => handleMarkAsUnsettled(invoice)}
                                disabled={updatingSettlement && updatingInvoiceId === invoice.InvoiceID}
                                className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="إعادة إلى غير مرحلة"
                              >
                                {updatingSettlement && updatingInvoiceId === invoice.InvoiceID ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <XCircle size={18} />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handlePrintInvoice(invoice)}
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
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {paginatedInvoices.map((invoice) => (
                <div key={invoice.InvoiceID} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-200">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-gray-900 font-cairo">#{invoice.InvoiceID}</h3>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-cairo ${
                            invoice.AccountantSign === 'مرحلة'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {invoice.AccountantSign === 'مرحلة' ? 'مرحلة' : 'غير مرحلة'}
                        </span>
                      </div>
                      {(() => {
                        const userId = invoice.created_by || invoice.createdBy || invoice.user_id || '';
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
                        {formatCurrency(invoice.TotalAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="mb-3">
                    <button
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey || e.shiftKey) {
                          window.open(`/admin/customers/${invoice.CustomerID}`, '_blank', 'noopener,noreferrer');
                          return;
                        }
                        router.push(`/admin/customers/${invoice.CustomerID}`);
                      }}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-semibold text-sm font-cairo text-right w-full"
                      title="فتح بروفايل الزبون"
                    >
                      {invoice.CustomerName || invoice.CustomerID}
                    </button>
                    {invoice.CustomerShamelNo && (
                      <div className="text-xs text-gray-500 font-cairo mt-1">
                        {invoice.CustomerShamelNo}
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 font-cairo mb-1">التاريخ</div>
                    <div className="text-sm text-gray-900 font-cairo">
                      {formatDate(invoice.Date)}
                      {invoice.CreatedAt && (
                        <div className="text-xs text-gray-500 mt-0.5">{formatTime(invoice.CreatedAt)}</div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => handleViewInvoice(invoice)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-cairo"
                    >
                      <Eye size={16} />
                      <span>عرض</span>
                    </button>
                    <button
                      onClick={() => handleEditInvoice(invoice)}
                      disabled={invoice.AccountantSign === 'مرحلة'}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors font-cairo ${
                        invoice.AccountantSign === 'مرحلة'
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                      title={invoice.AccountantSign === 'مرحلة' ? 'لا يمكن تعديل فاتورة مرحلة' : 'تعديل'}
                    >
                      <Edit size={16} />
                      <span>تعديل</span>
                    </button>
                    <button
                      onClick={() => handlePrintInvoice(invoice)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-cairo"
                    >
                      <Printer size={16} />
                      <span>طباعة</span>
                    </button>
                    {canAccountant && invoice.AccountantSign !== 'مرحلة' && (
                      <button
                        onClick={() => handleMarkAsSettledFromTable(invoice)}
                        disabled={updatingSettlement && updatingInvoiceId === invoice.InvoiceID}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="تغيير إلى مرحلة"
                      >
                        {updatingSettlement && updatingInvoiceId === invoice.InvoiceID ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <CheckCircle size={18} />
                        )}
                      </button>
                    )}
                    {canAccountant && invoice.AccountantSign === 'مرحلة' && (
                      <button
                        onClick={() => handleMarkAsUnsettled(invoice)}
                        disabled={updatingSettlement && updatingInvoiceId === invoice.InvoiceID}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="إعادة إلى غير مرحلة"
                      >
                        {updatingSettlement && updatingInvoiceId === invoice.InvoiceID ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <XCircle size={18} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 border-t border-gray-200 px-3 sm:px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs sm:text-sm text-gray-700 font-cairo text-center sm:text-right">
                  عرض <span className="font-semibold">{((currentPage - 1) * INVOICES_PER_PAGE) + 1}</span> إلى{' '}
                  <span className="font-semibold">
                    {Math.min(currentPage * INVOICES_PER_PAGE, filteredInvoices.length)}
                  </span>{' '}
                  من <span className="font-semibold">{filteredInvoices.length}</span> فاتورة
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
          </>
        )}

        {/* Modal عرض الفاتورة */}
        {viewing.invoice && (
          <div 
            className="fixed inset-0 md:right-64 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4" 
            dir="rtl"
            onClick={closeView}
          >
            <div 
              className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] overflow-hidden border border-gray-200 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-3 sm:px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 font-cairo">
                    معاينة الفاتورة: {viewing.invoice.InvoiceID || viewing.invoice.invoice_id}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 font-cairo">
                    التاريخ: {formatDate(viewing.invoice.Date || viewing.invoice.date)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      const id = viewing.invoice.InvoiceID || viewing.invoice.invoice_id;
                      if (!id) return;
                      if (isMobilePrint()) {
                        window.open(`/admin/warehouse-sales/print/${id}`, `print-warehouse-invoice-${id}`, 'noopener,noreferrer');
                        return;
                      }
                      setPrintOverlayInvoiceId(id);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-cairo"
                  >
                    <Printer size={16} />
                    <span className="hidden sm:inline">طباعة</span>
                  </button>
                  {canAccountant && viewing.invoice && viewing.invoice.AccountantSign !== 'مرحلة' && (
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
                  {canAccountant && viewing.invoice && viewing.invoice.AccountantSign === 'مرحلة' && (
                    <button
                      onClick={async () => {
                        if (!viewing.invoice) return;
                        const invoiceId = viewing.invoice.InvoiceID || viewing.invoice.invoice_id;
                        if (!invoiceId) return;
                        setUpdatingSettlement(true);
                        try {
                          await updateWarehouseSalesInvoiceSign(invoiceId, 'غير مرحلة');
                          const fullInvoice = await getWarehouseSalesInvoice(invoiceId);
                          setViewing({
                            invoice: fullInvoice,
                            details: fullInvoice?.Items || [],
                          });
                          setAllInvoices(prev => prev.map(inv => 
                            inv.InvoiceID === invoiceId ? { ...inv, AccountantSign: 'غير مرحلة' } : inv
                          ));
                        } catch (err: any) {
                          console.error('[WarehouseSalesPage] Failed to update settlement status:', err);
                          alert(err?.message || 'فشل تحديث حالة الترحيل');
                        } finally {
                          setUpdatingSettlement(false);
                        }
                      }}
                      disabled={updatingSettlement}
                      className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-cairo flex items-center gap-1"
                    >
                      {updatingSettlement ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          جاري التحديث...
                        </>
                      ) : (
                        'إعادة إلى غير مرحلة'
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

              <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs sm:text-sm text-gray-700 font-cairo">
                  <div>
                    <div className="text-gray-500">رقم الفاتورة</div>
                    <div className="font-semibold">{viewing.invoice.InvoiceID || viewing.invoice.invoice_id}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">العميل</div>
                    {viewing.invoice.CustomerID ? (
                      <button
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey || e.shiftKey) {
                            window.open(`/admin/customers/${viewing.invoice.CustomerID}`, '_blank', 'noopener,noreferrer');
                            return;
                          }
                          router.push(`/admin/customers/${viewing.invoice.CustomerID}`);
                        }}
                        onMouseDown={(e) => {
                          if (e.button === 1) {
                            e.preventDefault();
                            window.open(`/admin/customers/${viewing.invoice.CustomerID}`, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        title="فتح بروفايل الزبون (Ctrl+Click أو Shift+Click لفتح في تبويب جديد)"
                      >
                        {viewing.invoice.CustomerName || viewing.invoice.customer_name || viewing.invoice.CustomerID}
                      </button>
                    ) : (
                      <div className="font-semibold">{viewing.invoice.CustomerName || viewing.invoice.customer_name || '—'}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-gray-500">حالة الترحيل</div>
                    <div className="font-semibold">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          viewing.invoice.AccountantSign === 'مرحلة'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {viewing.invoice.AccountantSign || 'غير مرحلة'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs sm:text-sm text-gray-700 font-cairo">
                  <div>
                    <div className="text-gray-500">الخصم</div>
                    <div className="font-semibold">{formatCurrency(viewing.invoice.Discount || viewing.invoice.discount || 0)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">المجموع</div>
                    <div className="font-semibold">{formatCurrency(viewing.invoice.Subtotal || viewing.invoice.subtotal || 0)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">الصافي</div>
                    <div className="font-semibold">
                      {formatCurrency(viewing.invoice.TotalAmount || viewing.invoice.total_amount || 0)}
                    </div>
                  </div>
                </div>

                {viewing.invoice.Notes && (
                  <div className="text-sm text-gray-700 font-cairo">
                    <span className="text-gray-500">ملاحظات: </span>
                    {viewing.invoice.Notes}
                  </div>
                )}

                <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm min-w-[500px]">
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
                      {viewLoading ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Loader2 size={32} className="animate-spin text-gray-400" />
                              <p className="text-sm text-gray-600 font-cairo">جاري التحميل...</p>
                            </div>
                          </td>
                        </tr>
                      ) : (viewing.details || []).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-gray-500 font-cairo">
                            لا توجد بنود للعرض
                          </td>
                        </tr>
                      ) : (
                        (viewing.details || []).map((item, idx) => (
                          <tr key={item.DetailsID || item.details_id || idx} className="border-b border-gray-100">
                            <td className="px-3 py-2 text-right text-gray-800 font-cairo">{idx + 1}</td>
                            <td className="px-3 py-2 text-right text-gray-800">
                              <button
                                type="button"
                                onClick={(e) => {
                                  const productId = item.ProductID || item.product_id || item.id;
                                  if (!productId) return;
                                  if (e.metaKey || e.ctrlKey) {
                                    window.open(`/admin/products/${productId}`, '_blank');
                                  } else {
                                    router.push(`/admin/products/${productId}`);
                                  }
                                }}
                                className="text-blue-600 hover:text-blue-800 hover:underline transition-colors font-cairo"
                                title="عرض بروفايل المنتج (اضغط Command/Ctrl لفتح في نافذة جديدة)"
                              >
                                {item.ProductName || item.productName || item.product_name || item.Name || item.name || '—'}
                              </button>
                              {(item.notes || item.Notes) && String(item.notes || item.Notes).trim() && (
                                <p className="text-xs text-red-600 mt-1 font-cairo italic">
                                  {item.notes || item.Notes}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-800 font-cairo">
                              {item.Quantity || item.quantity || 0}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-800 font-cairo">
                              {formatCurrency(item.UnitPrice || item.unit_price || 0)}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-800 font-semibold font-cairo">
                              {formatCurrency(
                                (item.Quantity || item.quantity || 0) * (item.UnitPrice || item.unit_price || 0)
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {printOverlayInvoiceId && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            dir="rtl"
            onClick={() => setPrintOverlayInvoiceId(null)}
          >
            <div
              className="relative bg-white rounded-lg shadow-xl flex flex-col max-w-full max-h-full overflow-hidden"
              style={{ minWidth: '120mm', maxHeight: '95vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <span className="text-sm font-cairo text-gray-700">معاينة الطباعة — فاتورة مخزن</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => printIframeRef.current?.contentWindow?.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-cairo bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <Printer size={16} />
                    طباعة مرة أخرى
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintOverlayInvoiceId(null)}
                    className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors"
                    aria-label="إغلاق"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-white min-h-0">
                <iframe
                  ref={printIframeRef}
                  src={`/admin/warehouse-sales/print/${printOverlayInvoiceId}?embed=1`}
                  title="طباعة فاتورة المخزن"
                  className="w-full border-0 bg-white"
                  style={{ minHeight: '70vh', height: '70vh' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

