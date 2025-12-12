'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { getWarehouseSalesInvoices, updateWarehouseSalesInvoiceSign, updateWarehouseSalesInvoiceStatus } from '@/lib/api';
import { Lock } from 'lucide-react';
import {
  Loader2,
  FileText,
  Search,
  Printer,
  Plus,
  Edit,
  CheckCircle,
  XCircle,
  ChevronDown,
} from 'lucide-react';

interface WarehouseSalesInvoice {
  InvoiceID: string;
  CustomerID: string;
  CustomerName: string;
  Date: string;
  AccountantSign: string;
  Notes?: string;
  Discount: number;
  Status: string;
  TotalAmount: number;
  CreatedAt?: string;
}

export default function WarehouseSalesPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const [invoices, setInvoices] = useState<WarehouseSalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [signFilter, setSignFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const pageSize = 20;

  // Check if user has permission to access warehouse invoices
  const canAccessWarehouseInvoices = admin?.is_super_admin || admin?.permissions?.accessWarehouseInvoices === true;

  useEffect(() => {
    loadInvoices();
  }, [currentPage]);

  const loadInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getWarehouseSalesInvoices(currentPage, pageSize);
      setInvoices(result.invoices);
      setTotalInvoices(result.total);
    } catch (err: any) {
      console.error('[WarehouseSalesPage] Failed to load invoices:', err);
      setError(err?.message || 'فشل تحميل الفواتير');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintInvoice = (invoice: WarehouseSalesInvoice) => {
    const printUrl = `/admin/warehouse-sales/print/${invoice.InvoiceID}`;
    window.open(printUrl, '_blank');
  };

  const handleEditInvoice = (invoice: WarehouseSalesInvoice) => {
    router.push(`/admin/warehouse-sales/edit/${invoice.InvoiceID}`);
  };

  const handleToggleSign = async (invoice: WarehouseSalesInvoice) => {
    try {
      const newSign = invoice.AccountantSign === 'مرحلة' ? 'غير مرحلة' : 'مرحلة';
      await updateWarehouseSalesInvoiceSign(invoice.InvoiceID, newSign as 'مرحلة' | 'غير مرحلة');
      // Reload current page instead of all invoices
      loadInvoices();
    } catch (err: any) {
      console.error('[WarehouseSalesPage] Failed to update sign:', err);
      alert('فشل تحديث حالة الترحيل: ' + (err?.message || 'خطأ غير معروف'));
    }
  };

  const handleStatusChange = async (invoice: WarehouseSalesInvoice, newStatus: 'غير مدفوع' | 'تقسيط شهري' | 'دفعت بالكامل' | 'مدفوع جزئي') => {
    try {
      await updateWarehouseSalesInvoiceStatus(invoice.InvoiceID, newStatus);
      // Reload current page instead of all invoices
      loadInvoices();
    } catch (err: any) {
      console.error('[WarehouseSalesPage] Failed to update status:', err);
      alert('فشل تحديث الحالة: ' + (err?.message || 'خطأ غير معروف'));
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

  const filteredInvoices = useMemo(() => {
    let filtered = invoices;

    // Search by invoice ID, customer name, or customer ID - supports multiple words
    if (searchQuery.trim()) {
      const searchWords = searchQuery
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0);
      
      filtered = filtered.filter((invoice) => {
        const invoiceID = String(invoice.InvoiceID || '').toLowerCase();
        const customerName = String(invoice.CustomerName || '').toLowerCase();
        const customerID = String(invoice.CustomerID || '').toLowerCase();
        
        const searchableText = `${invoiceID} ${customerName} ${customerID}`;
        
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
  }, [invoices, searchQuery, statusFilter, signFilter]);

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">فواتير مبيعات المخزن</h1>
            <p className="text-gray-600 mt-1">
              إدارة فواتير مبيعات المخزن ({totalInvoices} فاتورة إجمالي)
            </p>
          </div>
          <button
            onClick={() => router.push('/admin/warehouse-sales/new')}
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
            <div className="relative">
              <Search
                size={20}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="بحث برقم الفاتورة أو اسم العميل..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-500"
              />
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
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.InvoiceID} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-gray-900">{invoice.InvoiceID}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-gray-900">{invoice.CustomerName || invoice.CustomerID}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-gray-600">{formatDate(invoice.Date)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
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
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleToggleSign(invoice)}
                          className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            invoice.AccountantSign === 'مرحلة'
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                          title={invoice.AccountantSign === 'مرحلة' ? 'غير مرحلة' : 'مرحلة'}
                        >
                          {invoice.AccountantSign === 'مرحلة' ? (
                            <>
                              <CheckCircle size={16} />
                              <span>مرحلة</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={16} />
                              <span>غير مرحلة</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-semibold text-gray-900">{formatCurrency(invoice.TotalAmount)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleEditInvoice(invoice)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="تعديل"
                          >
                            <Edit size={18} />
                          </button>
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
        )}

        {/* Pagination */}
        {totalInvoices > pageSize && (
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">
              عرض {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalInvoices)} من {totalInvoices}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                السابق
              </button>
              <span className="text-sm text-gray-600">
                صفحة {currentPage} من {Math.ceil(totalInvoices / pageSize)}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalInvoices / pageSize), prev + 1))}
                disabled={currentPage >= Math.ceil(totalInvoices / pageSize)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

