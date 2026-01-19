'use client';

import { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  getCashInvoicesFromSupabase,
  getCashInvoice,
  updateCashInvoiceSettlementStatus,
} from '@/lib/api';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  FileText,
  Search,
  Printer,
  Edit,
  Eye,
  Lock,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface CashInvoice {
  InvoiceID: string;
  DateTime: string;
  Status: string;
  Notes?: string;
  Discount?: number;
  totalAmount?: number;
  isSettled?: boolean;
  created_by?: string;
  createdBy?: string;
  user_id?: string;
}

export default function InvoicesPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const [invoices, setInvoices] = useState<CashInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    document.title = 'الفواتير النقدية';
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewing, setViewing] = useState<{
    invoice: any | null;
    details: any[] | null;
  }>({ invoice: null, details: null });
  const [viewLoading, setViewLoading] = useState(false);
  const [updatingSettlement, setUpdatingSettlement] = useState(false);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<string | null>(null);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const [dailyTotals, setDailyTotals] = useState<{
    today: number;
    yesterday: number;
    dayBeforeYesterday: number;
  }>({
    today: 0,
    yesterday: 0,
    dayBeforeYesterday: 0,
  });

  // Check if user has permission to view cash invoices
  const canViewCashInvoices = admin?.is_super_admin || admin?.permissions?.viewCashInvoices === true;
  
  // Check if user has accountant permission
  const canAccountant = admin?.is_super_admin || admin?.permissions?.accountant === true;

  useEffect(() => {
    document.title = 'الفواتير النقدية - Cash Invoices';
  }, []);

  useEffect(() => {
    loadInvoices();
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data: users, error } = await supabase
        .from('admin_users')
        .select('id, username')
        .order('username');

      if (error) {
        console.error('[InvoicesPage] Failed to load users:', error);
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
      console.error('[InvoicesPage] Failed to load users:', err);
    }
  };

  const loadInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load more invoices to ensure we get all invoices from last 3 days
      const data = await getCashInvoicesFromSupabase(1000);
      setInvoices(data);
      
      // Calculate daily totals for last 3 days
      calculateDailyTotals(data);
    } catch (err: any) {
      console.error('[InvoicesPage] Failed to load invoices:', err);
      setError(err?.message || 'فشل تحميل الفواتير');
    } finally {
      setLoading(false);
    }
  };

  const calculateDailyTotals = (invoicesData: CashInvoice[]) => {
    // Helper function to get date string in Jerusalem timezone
    const getDateStr = (date: Date): string => {
      return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD
    };
    
    // Helper function to subtract days from a date string (YYYY-MM-DD format)
    const subtractDays = (dateStr: string, days: number): string => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      date.setDate(date.getDate() - days);
      return getDateStr(date);
    };
    
    // Get current date and time
    const now = new Date();
    
    // Get today's date string in Jerusalem timezone
    const todayDateStr = getDateStr(now);
    
    // Calculate yesterday and day before yesterday by subtracting days from today
    // This ensures we use the same timezone conversion method
    const yesterdayDateStr = subtractDays(todayDateStr, 1);
    const dayBeforeYesterdayDateStr = subtractDays(todayDateStr, 2);

    let todayTotal = 0;
    let yesterdayTotal = 0;
    let dayBeforeYesterdayTotal = 0;

    invoicesData.forEach((invoice) => {
      if (!invoice.DateTime) return;
      
      const amount = invoice.totalAmount || 0;
      if (!amount || amount === 0) return;

      // Parse invoice date
      const invoiceDate = new Date(invoice.DateTime);
      
      // Get date string in Jerusalem timezone
      const invoiceDateStr = invoiceDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD

      // Compare date strings directly
      if (invoiceDateStr === todayDateStr) {
        todayTotal += amount;
      } else if (invoiceDateStr === yesterdayDateStr) {
        yesterdayTotal += amount;
      } else if (invoiceDateStr === dayBeforeYesterdayDateStr) {
        dayBeforeYesterdayTotal += amount;
      }
    });

    // Debug: Check invoices from last 3 days
    const invoicesFromLast3Days = invoicesData.filter(inv => {
      if (!inv.DateTime) return false;
      const invDateStr = new Date(inv.DateTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
      return invDateStr === todayDateStr || invDateStr === yesterdayDateStr || invDateStr === dayBeforeYesterdayDateStr;
    });

    console.log('[InvoicesPage] Daily totals calculation:', {
      todayTotal,
      yesterdayTotal,
      dayBeforeYesterdayTotal,
      todayDateStr,
      yesterdayDateStr,
      dayBeforeYesterdayDateStr,
      totalInvoices: invoicesData.length,
      invoicesWithAmount: invoicesData.filter(inv => inv.totalAmount && inv.totalAmount > 0).length,
      invoicesFromLast3Days: invoicesFromLast3Days.length,
      sampleInvoiceDates: invoicesData.slice(0, 10).map(inv => {
        const invDateStr = inv.DateTime ? new Date(inv.DateTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }) : null;
        return {
          InvoiceID: inv.InvoiceID,
          DateTime: inv.DateTime,
          dateStr: invDateStr,
          amount: inv.totalAmount,
          matchesToday: invDateStr === todayDateStr,
          matchesYesterday: invDateStr === yesterdayDateStr,
          matchesDayBeforeYesterday: invDateStr === dayBeforeYesterdayDateStr,
        };
      }),
      invoicesForDayBeforeYesterday: invoicesData.filter(inv => {
        if (!inv.DateTime) return false;
        const invDateStr = new Date(inv.DateTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
        return invDateStr === dayBeforeYesterdayDateStr;
      }).map(inv => ({
        InvoiceID: inv.InvoiceID,
        DateTime: inv.DateTime,
        dateStr: new Date(inv.DateTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }),
        amount: inv.totalAmount,
      })),
    });

    setDailyTotals({
      today: todayTotal,
      yesterday: yesterdayTotal,
      dayBeforeYesterday: dayBeforeYesterdayTotal,
    });
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

    setUpdatingSettlement(true);
    try {
      await updateCashInvoiceSettlementStatus(invoiceId, true);
      // Update local state immediately (optimistic update)
      setInvoices(prev => prev.map(inv => 
        inv.InvoiceID === invoiceId ? { ...inv, isSettled: true } : inv
      ));
      // Update viewing invoice state
      setViewing(prev => ({
        ...prev,
        invoice: prev.invoice ? { ...prev.invoice, isSettled: true } : null,
      }));
    } catch (err: any) {
      console.error('[InvoicesPage] Failed to update settlement status:', err);
      alert(err?.message || 'فشل تحديث حالة الفاتورة');
    } finally {
      setUpdatingSettlement(false);
    }
  };

  const handleMarkAsUnsettled = async () => {
    if (!viewing.invoice) return;
    
    const invoiceId = viewing.invoice.InvoiceID || viewing.invoice.invoice_id;
    if (!invoiceId) return;

    setUpdatingSettlement(true);
    try {
      await updateCashInvoiceSettlementStatus(invoiceId, false);
      // Update local state immediately (optimistic update)
      setInvoices(prev => prev.map(inv => 
        inv.InvoiceID === invoiceId ? { ...inv, isSettled: false } : inv
      ));
      // Update viewing invoice state
      setViewing(prev => ({
        ...prev,
        invoice: prev.invoice ? { ...prev.invoice, isSettled: false } : null,
      }));
    } catch (err: any) {
      console.error('[InvoicesPage] Failed to update settlement status:', err);
      alert(err?.message || 'فشل تحديث حالة الفاتورة');
    } finally {
      setUpdatingSettlement(false);
    }
  };

  const handleMarkInvoiceAsSettled = async (invoice: CashInvoice) => {
    const invoiceId = invoice.InvoiceID;
    if (!invoiceId) return;

    setUpdatingSettlement(true);
    setUpdatingInvoiceId(invoiceId);
    try {
      await updateCashInvoiceSettlementStatus(invoiceId, true);
      // Update local state immediately (optimistic update)
      setInvoices(prev => prev.map(inv => 
        inv.InvoiceID === invoiceId ? { ...inv, isSettled: true } : inv
      ));
    } catch (err: any) {
      console.error('[InvoicesPage] Failed to update settlement status:', err);
      alert(err?.message || 'فشل تحديث حالة الفاتورة');
    } finally {
      setUpdatingSettlement(false);
      setUpdatingInvoiceId(null);
    }
  };

  const handleMarkInvoiceAsUnsettled = async (invoice: CashInvoice) => {
    const invoiceId = invoice.InvoiceID;
    if (!invoiceId) return;

    setUpdatingSettlement(true);
    setUpdatingInvoiceId(invoiceId);
    try {
      await updateCashInvoiceSettlementStatus(invoiceId, false);
      // Update local state immediately (optimistic update)
      setInvoices(prev => prev.map(inv => 
        inv.InvoiceID === invoiceId ? { ...inv, isSettled: false } : inv
      ));
    } catch (err: any) {
      console.error('[InvoicesPage] Failed to update settlement status:', err);
      alert(err?.message || 'فشل تحديث حالة الفاتورة');
    } finally {
      setUpdatingSettlement(false);
      setUpdatingInvoiceId(null);
    }
  };

  const handleEditInvoice = (invoice: CashInvoice) => {
    if (invoice.isSettled) {
      alert('لا يمكن تعديل فاتورة مرحلة');
      return;
    }
    router.push(`/admin/invoices/${invoice.InvoiceID}`);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      // Use Asia/Jerusalem timezone for Palestine (UTC+2 or UTC+3)
      // Format as dd/mm/yyyy
      // Get date string in YYYY-MM-DD format in Jerusalem timezone
      const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }); // YYYY-MM-DD
      const [year, month, day] = dateStr.split('-');
      // Return as dd/mm/yyyy
      return `${day}/${month}/${year}`;
    } catch {
      return '—';
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '—';
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
          
          {/* Daily Totals */}
          <div className="flex items-center gap-4">
            {/* Day Before Yesterday */}
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 min-w-[140px]">
              <div className="text-xs text-gray-500 mb-1">قبل أمس</div>
              <div className="text-xl font-bold text-gray-900">
                {formatCurrency(dailyTotals.dayBeforeYesterday)}
              </div>
            </div>
            
            {/* Yesterday */}
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 min-w-[140px]">
              <div className="text-xs text-gray-500 mb-1">أمس</div>
              <div className="text-xl font-bold text-gray-900">
                {formatCurrency(dailyTotals.yesterday)}
              </div>
            </div>
            
            {/* Today */}
            <div className="bg-blue-50 rounded-lg border-2 border-blue-500 px-4 py-3 min-w-[140px]">
              <div className="text-xs text-blue-600 mb-1 font-medium">اليوم</div>
              <div className="text-xl font-bold text-blue-900">
                {formatCurrency(dailyTotals.today)}
              </div>
            </div>
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
                    <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider font-cairo w-24">
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
                    <tr key={invoice.InvoiceID || `invoice-${index}`} className="hover:bg-gray-200 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 font-cairo">{invoice.InvoiceID}</div>
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 font-cairo">
                          <div>{formatDate(invoice.DateTime)}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{formatTime(invoice.DateTime)}</div>
                        </div>
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
                      <td className="px-2 py-4 w-24">
                        <div className="text-xs text-gray-600 max-w-[100px] truncate font-cairo" title={invoice.Notes || undefined}>
                          {invoice.Notes || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900 font-cairo">
                          {formatCurrency(invoice.totalAmount || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-col gap-2">
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
                              disabled={invoice.isSettled}
                              className={`flex items-center gap-1 font-cairo ${
                                invoice.isSettled
                                  ? 'text-gray-400 cursor-not-allowed opacity-50'
                                  : 'text-yellow-600 hover:text-yellow-900'
                              }`}
                              title={invoice.isSettled ? 'لا يمكن تعديل فاتورة مرحلة' : ''}
                            >
                              <Edit size={16} />
                              تعديل
                            </button>
                          </div>
                          {canAccountant && !invoice.isSettled && (
                            <button
                              onClick={() => handleMarkInvoiceAsSettled(invoice)}
                              disabled={updatingSettlement && updatingInvoiceId === invoice.InvoiceID}
                              className="text-green-600 hover:text-green-900 flex items-center gap-1 font-cairo disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                            >
                              {updatingSettlement && updatingInvoiceId === invoice.InvoiceID ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  جاري التحديث...
                                </>
                              ) : (
                                <>
                                  <CheckCircle size={14} />
                                  تغيير إلى مرحلة
                                </>
                              )}
                            </button>
                          )}
                          {canAccountant && invoice.isSettled && (
                            <button
                              onClick={() => handleMarkInvoiceAsUnsettled(invoice)}
                              disabled={updatingSettlement && updatingInvoiceId === invoice.InvoiceID}
                              className="text-orange-600 hover:text-orange-900 flex items-center gap-1 font-cairo disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                            >
                              {updatingSettlement && updatingInvoiceId === invoice.InvoiceID ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  جاري التحديث...
                                </>
                              ) : (
                                <>
                                  <XCircle size={14} />
                                  إعادة إلى غير مرحلة
                                </>
                              )}
                            </button>
                          )}
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
        <div className="fixed top-0 left-0 bottom-0 right-0 md:right-64 z-50 flex items-center justify-center bg-black/40 px-4" dir="rtl">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900 font-cairo">
                  معاينة الفاتورة: {viewing.invoice.InvoiceID || viewing.invoice.invoice_id}
                </h3>
                <div className="text-sm text-gray-600 font-cairo">
                  <div>التاريخ: {formatDate(viewing.invoice.DateTime || viewing.invoice.date_time)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">الوقت: {formatTime(viewing.invoice.DateTime || viewing.invoice.date_time)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {viewLoading && <Loader2 size={18} className="animate-spin text-gray-500" />}
                {canAccountant && viewing.invoice && !viewing.invoice.isSettled && (
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
                {canAccountant && viewing.invoice && viewing.invoice.isSettled && (
                  <button
                    onClick={handleMarkAsUnsettled}
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


