'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { getAllMaintenance, updateMaintenance } from '@/lib/api';
import {
  Loader2,
  Wrench,
  Search,
  Plus,
  Edit,
  Eye,
  ChevronDown,
  Printer,
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
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

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
    const printUrl = `/admin/maintenance/print/${record.MaintNo}`;
    window.open(printUrl, '_blank');
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

  const filteredRecords = useMemo(() => {
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

    return filtered;
  }, [records, searchQuery, statusFilter, locationFilter, companyFilter]);

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">الصيانة</h1>
            <p className="text-gray-600 mt-1">
              إدارة سجلات الصيانة ({filteredRecords.length} سجل)
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
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search
                size={20}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="بحث برقم الصيانة أو اسم العميل أو القطعة..."
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
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Location Filter */}
            <div className="relative">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 appearance-none pr-8"
              >
                <option value="all">جميع المواقع</option>
                <option value="المحل">المحل</option>
                <option value="المخزن">المخزن</option>
              </select>
              <ChevronDown size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Company Filter */}
            <div className="relative">
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 appearance-none pr-8"
              >
                <option value="all">جميع الشركات</option>
                {companyOptions.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Records Table */}
        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Wrench size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">لا توجد سجلات صيانة</p>
          </div>
        ) : (
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
                  {filteredRecords.map((record) => (
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
                        <div className="flex flex-col gap-1">
                          <div className="text-xs text-gray-600 mb-1">{record.Status}</div>
                          <div className="flex flex-wrap gap-1">
                            {getActionButtons(record.Status, record.MaintNo).map((action, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleStatusChange(record.MaintNo, action.newStatus)}
                                disabled={updatingStatus === record.MaintNo}
                                className={`text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 transition-colors text-gray-900 ${
                                  updatingStatus === record.MaintNo ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                }`}
                                title={action.newStatus}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                          {updatingStatus === record.MaintNo && (
                            <Loader2 size={12} className="inline-block animate-spin text-gray-400 mt-1" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
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
        )}
      </div>
    </AdminLayout>
  );
}

