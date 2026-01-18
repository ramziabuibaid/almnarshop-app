'use client';

import { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { getShopSalesInvoices, getShopSalesInvoice, updateShopSalesInvoiceSign, updateShopSalesInvoiceStatus } from '@/lib/api';
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

interface ShopSalesInvoice {
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

export default function ShopSalesPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const [allInvoices, setAllInvoices] = useState<ShopSalesInvoice[]>([]); // Store all loaded invoices
  const [loading, setLoading] = useState(true); // Start with loading true

  useLayoutEffect(() => {
    document.title = 'فواتير مبيعات المحل';
  }, []);
  const [loadingMore, setLoadingMore] = useState(false); // For background loading
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [signFilter, setSignFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const INVOICES_PER_PAGE = 30;
  const [viewing, setViewing] = useState<{
    invoice: any | null;
    details: any[] | null;
  }>({ invoice: null, details: null });
  const [viewLoading, setViewLoading] = useState(false);
  const [updatingSettlement, setUpdatingSettlement] = useState(false);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<string | null>(null);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());

  // Check if user has permission to access shop invoices
  const canAccessShopInvoices = admin?.is_super_admin || admin?.permissions?.accessShopInvoices === true;
  // Check if user has accountant permission (for posting and status changes)
  const canAccountant = admin?.is_super_admin || admin?.permissions?.accountant === true;

  useEffect(() => {
    document.title = 'مبيعات المحل - Shop Sales';
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
        console.error('[ShopSalesPage] Failed to load users:', error);
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
      console.error('[ShopSalesPage] Failed to load users:', err);
    }
  };

  // Load first page quickly, then load more in background
  const loadFirstPage = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load first page immediately for fast initial display
      const firstPageResult = await getShopSalesInvoices(1, INVOICES_PER_PAGE);
      setAllInvoices(firstPageResult.invoices);
      setLoading(false); // Show page immediately
      
      // Continue loading more invoices in background
      if (firstPageResult.total > INVOICES_PER_PAGE) {
        setLoadingMore(true);
        loadMoreInvoices();
      }
    } catch (err: any) {
      console.error('[ShopSalesPage] Failed to load invoices:', err);
      setError(err?.message || 'فشل تحميل الفواتير');
      setAllInvoices([]);
      setLoading(false);
    }
  };

  // Load remaining invoices in background
  const loadMoreInvoices = async () => {
    try {
      // Load a large number of invoices in background
      const result = await getShopSalesInvoices(1, 1000);
      setAllInvoices(result.invoices);
    } catch (err: any) {
      console.error('[ShopSalesPage] Failed to load more invoices:', err);
      // Don't show error to user, just log it
    } finally {
      setLoadingMore(false);
    }
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, signFilter]);

  const handlePrintInvoice = (invoice: ShopSalesInvoice) => {
    // Open print page in new window - will auto-print when loaded
    const printUrl = `/admin/shop-sales/print/${invoice.InvoiceID}`;
    window.open(printUrl, `print-shop-${invoice.InvoiceID}`, 'noopener,noreferrer');
  };

  const handleEditInvoice = (invoice: ShopSalesInvoice) => {
    if (invoice.AccountantSign === 'مرحلة') {
      alert('لا يمكن تعديل فاتورة مرحلة');
      return;
    }
    router.push(`/admin/shop-sales/edit/${invoice.InvoiceID}`);
  };

  const handleViewInvoice = async (invoice: ShopSalesInvoice) => {
    try {
      setViewLoading(true);
      const fullInvoice = await getShopSalesInvoice(invoice.InvoiceID);
      setViewing({
        invoice: fullInvoice,
        details: fullInvoice?.Items || [],
      });
    } catch (err: any) {
      console.error('[ShopSalesPage] Failed to view invoice:', err);
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

    setUpdatingSettlement(true);
    try {
      await updateShopSalesInvoiceSign(invoiceId, 'مرحلة');
      // Reload invoice data
      const fullInvoice = await getShopSalesInvoice(invoiceId);
      setViewing({
        invoice: fullInvoice,
        details: fullInvoice?.Items || [],
      });
      // Update local state immediately (optimistic update like maintenance page)
      setAllInvoices(prev => prev.map(inv => 
        inv.InvoiceID === invoiceId ? { ...inv, AccountantSign: 'مرحلة' } : inv
      ));
    } catch (err: any) {
      console.error('[ShopSalesPage] Failed to update settlement status:', err);
      alert(err?.message || 'فشل تحديث حالة الترحيل');
    } finally {
      setUpdatingSettlement(false);
    }
  };

  const handleMarkAsSettledFromTable = async (invoice: ShopSalesInvoice) => {
    const invoiceId = invoice.InvoiceID;
    if (!invoiceId) return;

    setUpdatingSettlement(true);
    setUpdatingInvoiceId(invoiceId);
    try {
      await updateShopSalesInvoiceSign(invoiceId, 'مرحلة');
      // Update local state immediately
      setAllInvoices(prev => prev.map(inv => 
        inv.InvoiceID === invoiceId ? { ...inv, AccountantSign: 'مرحلة' } : inv
      ));
    } catch (err: any) {
      console.error('[ShopSalesPage] Failed to update settlement status:', err);
      alert(err?.message || 'فشل تحديث حالة الفاتورة');
    } finally {
      setUpdatingSettlement(false);
      setUpdatingInvoiceId(null);
    }
  };

  const handleMarkAsUnsettled = async (invoice: ShopSalesInvoice) => {
    const invoiceId = invoice.InvoiceID;
    if (!invoiceId) return;

    setUpdatingSettlement(true);
    setUpdatingInvoiceId(invoiceId);
    try {
      await updateShopSalesInvoiceSign(invoiceId, 'غير مرحلة');
      // Update local state immediately
      setAllInvoices(prev => prev.map(inv => 
        inv.InvoiceID === invoiceId ? { ...inv, AccountantSign: 'غير مرحلة' } : inv
      ));
    } catch (err: any) {
      console.error('[ShopSalesPage] Failed to update settlement status:', err);
      alert(err?.message || 'فشل تحديث حالة الفاتورة');
    } finally {
      setUpdatingSettlement(false);
      setUpdatingInvoiceId(null);
    }
  };

  const handleStatusChange = async (invoice: ShopSalesInvoice, newStatus: 'غير مدفوع' | 'تقسيط شهري' | 'دفعت بالكامل' | 'مدفوع جزئي') => {
    // Check permission
    if (!canAccountant) {
      alert('ليس لديك صلاحية لتغيير حالة الفاتورة');
      return;
    }

    try {
      await updateShopSalesInvoiceStatus(invoice.InvoiceID, newStatus);
      // Update local state immediately (optimistic update like maintenance page)
      setAllInvoices(prev => prev.map(inv => 
        inv.InvoiceID === invoice.InvoiceID ? { ...inv, Status: newStatus } : inv
      ));
    } catch (err: any) {
      console.error('[ShopSalesPage] Failed to update status:', err);
      alert('فشل تحديث الحالة: ' + (err?.message || 'خطأ غير معروف'));
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

    return filtered;
  }, [allInvoices, searchQuery, statusFilter, signFilter]);

  // Client-side pagination (like maintenance page)
  const totalPages = Math.ceil(filteredInvoices.length / INVOICES_PER_PAGE);
  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * INVOICES_PER_PAGE;
    return filteredInvoices.slice(startIndex, startIndex + INVOICES_PER_PAGE);
  }, [filteredInvoices, currentPage]);

  // Check permissions
  if (!canAccessShopInvoices) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Lock size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2 font-cairo">ليس لديك صلاحية للوصول إلى صفحة فواتير مبيعات المحل</p>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">فواتير مبيعات المحل</h1>
            <p className="text-gray-600 mt-1">
              إدارة فواتير مبيعات المحل ({allInvoices.length.toLocaleString()} فاتورة محملة
              {loadingMore && <span className="text-blue-600"> - جاري تحميل المزيد...</span>})
            </p>
          </div>
          <button
            onClick={() => router.push('/admin/shop-sales/new')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            <Plus size={20} />
            إضافة فاتورة جديدة
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 appearance-none pr-8"
              >
                <option value="all">جميع الحالات</option>
                <option value="غير مدفوع">غير مدفوع</option>
                <option value="تقسيط شهري">تقسيط شهري</option>
                <option value="دفعت بالكامل">دفعت بالكامل</option>
                <option value="مدفوع جزئي">مدفوع جزئي</option>
              </select>
              <ChevronDown size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
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

        {/* Invoices Table */}
        {filteredInvoices.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FileText size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">لا توجد فواتير</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      رقم الفاتورة
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      العميل
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      التاريخ
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      الحالة
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      الترحيل
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
                  {paginatedInvoices.map((invoice) => (
                    <tr key={invoice.InvoiceID} className="hover:bg-gray-200 transition-colors">
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-gray-900">{invoice.InvoiceID}</div>
                        {(() => {
                          const userId = invoice.created_by || invoice.createdBy || invoice.user_id || '';
                          if (userId && userMap.has(userId)) {
                            const username = userMap.get(userId);
                            return (
                              <div className="text-xs text-gray-500 mt-1">
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
                            // If Ctrl/Cmd or Shift is pressed, open in new tab
                            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                              window.open(`/admin/customers/${invoice.CustomerID}`, '_blank', 'noopener,noreferrer');
                              return;
                            }
                            // Otherwise, navigate in same tab
                            router.push(`/admin/customers/${invoice.CustomerID}`);
                          }}
                          onMouseDown={(e) => {
                            // Handle middle mouse button - open in new tab
                            if (e.button === 1) {
                              e.preventDefault();
                              window.open(`/admin/customers/${invoice.CustomerID}`, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
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
                        <div className="text-gray-600">
                          <div>{formatDate(invoice.Date)}</div>
                        {invoice.CreatedAt && (
                            <div className="text-xs text-gray-500 mt-0.5">{formatTime(invoice.CreatedAt)}</div>
                        )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canAccountant ? (
                          <select
                            value={invoice.Status}
                            onChange={(e) => handleStatusChange(invoice, e.target.value as any)}
                            className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-900 text-gray-900"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="غير مدفوع">غير مدفوع</option>
                            <option value="تقسيط شهري">تقسيط شهري</option>
                            <option value="دفعت بالكامل">دفعت بالكامل</option>
                            <option value="مدفوع جزئي">مدفوع جزئي</option>
                          </select>
                        ) : (
                          <span className="text-sm text-gray-900">{invoice.Status}</span>
                        )}
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
                        <div className="font-semibold text-gray-900">{formatCurrency(invoice.TotalAmount)}</div>
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
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex items-center justify-between">
                <div className="text-sm text-gray-700">
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
                          className={`px-3 py-1 rounded-lg transition-colors ${
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
        )}

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
                    التاريخ: {formatDate(viewing.invoice.Date || viewing.invoice.date)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {viewLoading && <Loader2 size={18} className="animate-spin text-gray-500" />}
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
                          await updateShopSalesInvoiceSign(invoiceId, 'غير مرحلة');
                          const fullInvoice = await getShopSalesInvoice(invoiceId);
                          setViewing({
                            invoice: fullInvoice,
                            details: fullInvoice?.Items || [],
                          });
                          setAllInvoices(prev => prev.map(inv => 
                            inv.InvoiceID === invoiceId ? { ...inv, AccountantSign: 'غير مرحلة' } : inv
                          ));
                        } catch (err: any) {
                          console.error('[ShopSalesPage] Failed to update settlement status:', err);
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

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-700 font-cairo">
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
                  <div>
                    <div className="text-gray-500">الحالة</div>
                    <div className="font-semibold">{viewing.invoice.Status || viewing.invoice.status || '—'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-700 font-cairo">
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
                        <tr key={item.DetailsID || item.details_id || idx} className="border-b border-gray-100">
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
      </div>
    </AdminLayout>
  );
}

