'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { getAllMaintenance, updateMaintenance } from '@/lib/api';
import { fixPhoneNumber } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  Wrench,
  Search,
  Plus,
  Edit,
  Eye,
  ChevronDown,
  Printer,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Calendar,
  X,
} from 'lucide-react';

interface MaintenanceRecord {
  MaintNo: string;
  CustomerID: string;
  CustomerName: string;
  ItemName: string;
  Location: string;
  Company?: string;
  DateOfPurchase?: string;
  DateOfReceive: string;
  Problem?: string;
  ImageOfItem?: string;
  ImageOfProblem?: string;
  ImageOfWarranty?: string;
  Status: string;
  SerialNo?: string;
  UnderWarranty: string;
  CreatedAt?: string;
}

export default function MaintenancePage() {
  const router = useRouter();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all'); // 'all', 'today', 'week', 'month'
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'date' | 'status' | 'customer'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const itemsPerPage = 20;

  useEffect(() => {
    document.title = 'الصيانة - Maintenance';
  }, []);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllMaintenance(1000);
      setRecords(data);
    } catch (err: any) {
      console.error('[MaintenancePage] Failed to load records:', err);
      setError(err?.message || 'فشل تحميل سجلات الصيانة');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRecord = (record: MaintenanceRecord) => {
    router.push(`/admin/maintenance/edit/${record.MaintNo}`);
  };

  const handleViewRecord = (record: MaintenanceRecord) => {
    router.push(`/admin/maintenance/view/${record.MaintNo}`);
  };

  const handlePrintRecord = (record: MaintenanceRecord) => {
    // Open print page in new window - will auto-print when loaded
    const printUrl = `/admin/maintenance/print/${record.MaintNo}`;
    window.open(printUrl, `print-maintenance-${record.MaintNo}`, 'noopener,noreferrer');
  };

  const getActionButtons = (currentStatus: string, maintNo: string) => {
    const actions: Array<{ label: string; newStatus: string }> = [];

    switch (currentStatus) {
      case 'موجودة في المحل وجاهزة للتسليم':
        actions.push(
          { label: 'تسليمها للشركة', newStatus: 'موجودة في الشركة' },
          { label: 'إرسالها إلى المخزن', newStatus: 'موجودة في المخزن وجاهزة للتسليم' }
        );
        break;
      case 'موجودة في المخزن وجاهزة للتسليم':
        actions.push(
          { label: 'تسليمها للشركة', newStatus: 'موجودة في الشركة' },
          { label: 'إرسالها إلى المحل', newStatus: 'موجودة في المحل وجاهزة للتسليم' }
        );
        break;
      case 'موجودة في الشركة':
        actions.push(
          { label: 'استلام في المحل', newStatus: 'جاهزة للتسليم للزبون من المحل' },
          { label: 'استلام في المخزن', newStatus: 'جاهزة للتسليم للزبون من المخزن' },
          { label: 'إرجاع وخصم', newStatus: 'تم ارجاعها للشركة وخصمها للزبون' }
        );
        break;
      case 'جاهزة للتسليم للزبون من المخزن':
        actions.push(
          { label: 'تسليم للزبون', newStatus: 'سلمت للزبون' },
          { label: 'إرسال إلى المحل', newStatus: 'جاهزة للتسليم للزبون من المحل' }
        );
        break;
      case 'جاهزة للتسليم للزبون من المحل':
        actions.push(
          { label: 'تسليم للزبون', newStatus: 'سلمت للزبون' },
          { label: 'إرسال للمخزن', newStatus: 'جاهزة للتسليم للزبون من المخزن' }
        );
        break;
      default:
        // للحالات الأخرى (مثل "سلمت للزبون" و "تم ارجاعها للشركة وخصمها للزبون")
        // لا توجد إجراءات متاحة
        break;
    }

    return actions;
  };

  const handleStatusChange = async (maintNo: string, newStatus: string) => {
    setUpdatingStatus(maintNo);
    try {
      await updateMaintenance(maintNo, { status: newStatus as any });
      // Update the record locally without full reload
      setRecords((prevRecords) =>
        prevRecords.map((record) =>
          record.MaintNo === maintNo ? { ...record, Status: newStatus } : record
        )
      );
    } catch (err: any) {
      console.error('[MaintenancePage] Failed to update status:', err);
      setError(err?.message || 'فشل تحديث الحالة');
      // Reload records on error to ensure consistency
      await loadRecords();
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleWhatsApp = async (record: MaintenanceRecord, countryCode: '970' | '972') => {
    try {
      // Fetch customer data directly from Supabase
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('phone, name')
        .eq('customer_id', record.CustomerID)
        .single();

      if (customerError || !customer) {
        console.error('[MaintenancePage] Error fetching customer:', customerError);
        alert('فشل جلب بيانات العميل');
        return;
      }

      const customerPhone = customer.phone || '';
      
      if (!customerPhone || customerPhone.trim() === '') {
        alert('لا يوجد رقم هاتف للعميل');
        return;
      }

      // Fix phone number format
      const fixedPhone = fixPhoneNumber(customerPhone);
      
      // Get local number (remove leading 0 for WhatsApp)
      const getLocalNumber = (phoneNum: string): string => {
        if (!phoneNum) return '';
        const cleaned = phoneNum.trim().replace(/\s+/g, '').replace(/-/g, '');
        // Remove leading 0 if present
        if (cleaned.startsWith('0')) {
          return cleaned.substring(1);
        }
        return cleaned;
      };

      const localNumber = getLocalNumber(fixedPhone);
      const whatsappNumber = `${countryCode}${localNumber}`;

      // Determine pickup location based on status
      let pickupLocation = '';
      if (record.Status === 'جاهزة للتسليم للزبون من المحل') {
        pickupLocation = 'المعرض في جنين - شارع الناصرة';
      } else if (record.Status === 'جاهزة للتسليم للزبون من المخزن') {
        pickupLocation = 'المعرض في جنين - مقر المخزن في المنطقة الصناعية';
      }

      // Create WhatsApp message
      const message = `السلام عليكم ورحمة الله وبركاته

نود إعلامكم أن القطعة "${record.ItemName}" جاهزة للاستلام
يمكنكم استلامها من ${pickupLocation}

رقم الصيانة: ${record.MaintNo}
${record.SerialNo ? `الرقم التسلسلي: ${record.SerialNo}\n` : ''}
نتمنى لكم يوم سعيد`;

      // Open WhatsApp
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      console.error('[MaintenancePage] Error sending WhatsApp:', error);
      alert(`فشل إرسال رسالة واتساب: ${error?.message || 'خطأ غير معروف'}`);
    }
  };

  // Check if WhatsApp button should be shown for this status
  const shouldShowWhatsApp = (status: string) => {
    return status === 'جاهزة للتسليم للزبون من المحل' || 
           status === 'جاهزة للتسليم للزبون من المخزن';
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

  // Get status badge color
  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'موجودة في المحل وجاهزة للتسليم': 'bg-blue-100 text-blue-800',
      'موجودة في المخزن وجاهزة للتسليم': 'bg-purple-100 text-purple-800',
      'موجودة في الشركة': 'bg-yellow-100 text-yellow-800',
      'جاهزة للتسليم للزبون من المحل': 'bg-green-100 text-green-800',
      'جاهزة للتسليم للزبون من المخزن': 'bg-green-100 text-green-800',
      'سلمت للزبون': 'bg-gray-100 text-gray-800',
      'تم ارجاعها للشركة وخصمها للزبون': 'bg-red-100 text-red-800',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredAndSortedRecords = useMemo(() => {
    let filtered = records;

    // Search by maintenance number, customer name, item name, or serial number
    if (searchQuery.trim()) {
      const searchWords = searchQuery
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0);
      
      filtered = filtered.filter((record) => {
        const maintNo = String(record.MaintNo || '').toLowerCase();
        const customerName = String(record.CustomerName || '').toLowerCase();
        const itemName = String(record.ItemName || '').toLowerCase();
        const serialNo = String(record.SerialNo || '').toLowerCase();
        const customerID = String(record.CustomerID || '').toLowerCase();
        
        const searchableText = `${maintNo} ${customerName} ${itemName} ${serialNo} ${customerID}`;
        
        return searchWords.every(word => searchableText.includes(word));
      });
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((record) => record.Status === statusFilter);
    }

    // Filter by location
    if (locationFilter !== 'all') {
      filtered = filtered.filter((record) => record.Location === locationFilter);
    }

    // Filter by company
    if (companyFilter !== 'all') {
      filtered = filtered.filter((record) => record.Company === companyFilter);
    }

    // Filter by date
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter((record) => {
        if (!record.DateOfReceive) return false;
        const receiveDate = new Date(record.DateOfReceive);
        
        switch (dateFilter) {
          case 'today':
            return receiveDate >= today;
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return receiveDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return receiveDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Sort records
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          const dateA = new Date(a.DateOfReceive || a.CreatedAt || 0).getTime();
          const dateB = new Date(b.DateOfReceive || b.CreatedAt || 0).getTime();
          comparison = dateA - dateB;
          break;
        case 'status':
          comparison = a.Status.localeCompare(b.Status, 'ar');
          break;
        case 'customer':
          comparison = (a.CustomerName || a.CustomerID).localeCompare(b.CustomerName || b.CustomerID, 'ar');
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [records, searchQuery, statusFilter, locationFilter, companyFilter, dateFilter, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedRecords.length / itemsPerPage);
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedRecords, currentPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, locationFilter, companyFilter, dateFilter]);

  const statusOptions = [
    'موجودة في المحل وجاهزة للتسليم',
    'موجودة في المخزن وجاهزة للتسليم',
    'موجودة في الشركة',
    'جاهزة للتسليم للزبون من المحل',
    'جاهزة للتسليم للزبون من المخزن',
    'سلمت للزبون',
    'تم ارجاعها للشركة وخصمها للزبون',
  ];

  const companyOptions = [
    'ADC',
    'ضبان',
    'مسلماني',
    'الادم',
    'ستلايت المنار',
    'ترست',
    'حسام الشريف',
    'الحاج صبحي',
    'ميجا',
    'برستيج',
    'سبيتاني',
    'المنار للاجهزة الكهربائية',
    'عمار الاغبر',
    'حلاوة نابلس',
    'JR',
    'شركة يافا',
    'هوم بلس',
  ];

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">جاري تحميل سجلات الصيانة...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">الصيانة</h1>
            <p className="text-gray-600 mt-1">
              إدارة سجلات الصيانة ({filteredAndSortedRecords.length} سجل)
            </p>
          </div>
          <button
            onClick={() => router.push('/admin/maintenance/new')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            <Plus size={20} />
            إضافة سجل صيانة جديد
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search
              size={20}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="بحث برقم الصيانة أو اسم العميل أو القطعة أو الرقم التسلسلي..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Status Filter */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-1">الحالة</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 appearance-none pr-8 text-sm"
              >
                <option value="all">جميع الحالات</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute left-3 bottom-2.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Location Filter */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-1">الموقع</label>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 appearance-none pr-8 text-sm"
              >
                <option value="all">جميع المواقع</option>
                <option value="المحل">المحل</option>
                <option value="المخزن">المخزن</option>
              </select>
              <ChevronDown size={16} className="absolute left-3 bottom-2.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Company Filter */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-1">الشركة</label>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 appearance-none pr-8 text-sm"
              >
                <option value="all">جميع الشركات</option>
                {companyOptions.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute left-3 bottom-2.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Date Filter */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-1">التاريخ</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 appearance-none pr-8 text-sm"
              >
                <option value="all">جميع التواريخ</option>
                <option value="today">اليوم</option>
                <option value="week">آخر أسبوع</option>
                <option value="month">آخر شهر</option>
              </select>
              <ChevronDown size={16} className="absolute left-3 bottom-2.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Sort */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-1">الترتيب</label>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'status' | 'customer')}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 appearance-none pr-8 text-sm"
                >
                  <option value="date">التاريخ</option>
                  <option value="status">الحالة</option>
                  <option value="customer">العميل</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  title={sortOrder === 'asc' ? 'تصاعدي' : 'تنازلي'}
                >
                  <ArrowUpDown size={16} className={sortOrder === 'desc' ? 'rotate-180' : ''} />
                </button>
              </div>
            </div>
          </div>

          {/* Active Filters */}
          {(statusFilter !== 'all' || locationFilter !== 'all' || companyFilter !== 'all' || dateFilter !== 'all' || searchQuery) && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-600">الفلاتر النشطة:</span>
              {statusFilter !== 'all' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs hover:bg-blue-200 transition-colors"
                >
                  {statusFilter}
                  <X size={12} />
                </button>
              )}
              {locationFilter !== 'all' && (
                <button
                  onClick={() => setLocationFilter('all')}
                  className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs hover:bg-purple-200 transition-colors"
                >
                  {locationFilter}
                  <X size={12} />
                </button>
              )}
              {companyFilter !== 'all' && (
                <button
                  onClick={() => setCompanyFilter('all')}
                  className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs hover:bg-green-200 transition-colors"
                >
                  {companyFilter}
                  <X size={12} />
                </button>
              )}
              {dateFilter !== 'all' && (
                <button
                  onClick={() => setDateFilter('all')}
                  className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs hover:bg-yellow-200 transition-colors"
                >
                  {dateFilter === 'today' ? 'اليوم' : dateFilter === 'week' ? 'آخر أسبوع' : 'آخر شهر'}
                  <X size={12} />
                </button>
              )}
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs hover:bg-gray-200 transition-colors"
                >
                  بحث: {searchQuery.substring(0, 20)}
                  <X size={12} />
                </button>
              )}
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setLocationFilter('all');
                  setCompanyFilter('all');
                  setDateFilter('all');
                  setSearchQuery('');
                }}
                className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
              >
                إزالة الكل
              </button>
            </div>
          )}
        </div>

        {/* Records Table */}
        {filteredAndSortedRecords.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Wrench size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">لا توجد سجلات صيانة</p>
            {(statusFilter !== 'all' || locationFilter !== 'all' || companyFilter !== 'all' || dateFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setLocationFilter('all');
                  setCompanyFilter('all');
                  setDateFilter('all');
                  setSearchQuery('');
                }}
                className="mt-4 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                إزالة جميع الفلاتر
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        رقم الصيانة
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        العميل
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        اسم القطعة
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        الموقع
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        تاريخ الاستقبال
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        الحالة
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedRecords.map((record) => (
                    <tr key={record.MaintNo} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-gray-900">{record.MaintNo}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-gray-900">{record.CustomerName || record.CustomerID}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-gray-900">{record.ItemName}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-gray-600">{record.Location}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-gray-600">{formatDate(record.DateOfReceive)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col gap-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(record.Status)}`}>
                            {record.Status}
                          </span>
                          {getActionButtons(record.Status, record.MaintNo).length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {getActionButtons(record.Status, record.MaintNo).map((action, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleStatusChange(record.MaintNo, action.newStatus)}
                                  disabled={updatingStatus === record.MaintNo}
                                  className={`text-xs px-2.5 py-1 border border-gray-300 rounded-md hover:bg-gray-100 hover:border-gray-400 transition-colors text-gray-900 font-medium ${
                                    updatingStatus === record.MaintNo ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                  }`}
                                  title={action.newStatus}
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                          {updatingStatus === record.MaintNo && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Loader2 size={12} className="animate-spin" />
                              <span>جاري التحديث...</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {shouldShowWhatsApp(record.Status) && (
                            <div className="relative group">
                              <button
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="إرسال واتساب"
                              >
                                <MessageCircle size={18} />
                              </button>
                              <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                                <div className="p-2 space-y-1">
                                  <button
                                    onClick={() => handleWhatsApp(record, '970')}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-right text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                  >
                                    <MessageCircle size={16} className="text-green-600" />
                                    <span className="flex-1">واتساب: 970</span>
                                  </button>
                                  <button
                                    onClick={() => handleWhatsApp(record, '972')}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-right text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                  >
                                    <MessageCircle size={16} className="text-green-600" />
                                    <span className="flex-1">واتساب: 972</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => handlePrintRecord(record)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="طباعة"
                          >
                            <Printer size={18} />
                          </button>
                          <button
                            onClick={() => handleViewRecord(record)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="عرض"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => handleEditRecord(record)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="تعديل"
                          >
                            <Edit size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    عرض {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedRecords.length)} من {filteredAndSortedRecords.length} سجل
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={20} />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
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
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                              currentPage === pageNum
                                ? 'bg-gray-900 text-white'
                                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={20} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

