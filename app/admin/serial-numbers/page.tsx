'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Search, Loader2, Eye, FileText, Calendar, User, Package, Building2, ShoppingCart, Receipt, X } from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { searchSerialNumber, getSerialNumberDetails } from '@/lib/api_serial_numbers';

interface SerialNumberResult {
  serial_id: string;
  serial_no: string;
  product_id: string;
  product_name?: string;
  invoice_type: 'cash' | 'shop_sales' | 'warehouse_sales' | 'quotation';
  invoice_id: string;
  customer_id?: string;
  customer_name?: string;
  sale_date?: string;
  status: string;
  notes?: string;
  created_at: string;
}

export default function SerialNumbersPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SerialNumberResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSerial, setSelectedSerial] = useState<SerialNumberResult | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const data = await searchSerialNumber(searchQuery.trim());
      setResults(data || []);
    } catch (error: any) {
      console.error('[SerialNumbers] Search error:', error);
      alert(error?.message || 'فشل البحث');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (serial: SerialNumberResult) => {
    setSelectedSerial(serial);
    setLoadingDetails(true);
    try {
      const data = await getSerialNumberDetails(serial.serial_id);
      setDetails(data);
    } catch (error: any) {
      console.error('[SerialNumbers] Get details error:', error);
      alert(error?.message || 'فشل تحميل التفاصيل');
    } finally {
      setLoadingDetails(false);
    }
  };

  const getInvoiceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      cash: 'فاتورة نقدية',
      shop_sales: 'فاتورة مبيعات المحل',
      warehouse_sales: 'فاتورة مبيعات المخزن',
      quotation: 'عرض سعر',
    };
    return labels[type] || type;
  };

  const getInvoiceTypeIcon = (type: string) => {
    switch (type) {
      case 'cash':
        return <Receipt size={18} className="text-blue-600" />;
      case 'shop_sales':
        return <ShoppingCart size={18} className="text-green-600" />;
      case 'warehouse_sales':
        return <Building2 size={18} className="text-purple-600" />;
      case 'quotation':
        return <FileText size={18} className="text-orange-600" />;
      default:
        return <FileText size={18} />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      sold: 'مباع',
      returned: 'مرتجع',
      warranty: 'ضمان',
      damaged: 'تالف',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      sold: 'bg-green-100 text-green-800',
      returned: 'bg-yellow-100 text-yellow-800',
      warranty: 'bg-blue-100 text-blue-800',
      damaged: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <AdminLayout>
      <div className="space-y-6 font-cairo" dir="rtl">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 font-cairo">البحث عن الأرقام التسلسلية</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base font-cairo">ابحث عن رقم تسلسلي معين لتتبع القطعة</p>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                placeholder="أدخل الرقم التسلسلي للبحث..."
                className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !searchQuery.trim()}
              className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>جاري البحث...</span>
                </>
              ) : (
                <>
                  <Search size={18} />
                  <span>بحث</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 font-cairo">
                النتائج ({results.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {results.map((result) => (
                <div
                  key={result.serial_id}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleViewDetails(result)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Package size={18} className="text-gray-600" />
                        <span className="text-lg font-bold text-gray-900 font-cairo">
                          {result.serial_no}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-cairo ${getStatusColor(result.status)}`}>
                          {getStatusLabel(result.status)}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600 font-cairo">
                        {result.product_name && (
                          <div className="flex items-center gap-2">
                            <Package size={14} />
                            <span>المنتج: {result.product_name} ({result.product_id})</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          {getInvoiceTypeIcon(result.invoice_type)}
                          <span>{getInvoiceTypeLabel(result.invoice_type)}: {result.invoice_id}</span>
                        </div>
                        {result.customer_name && (
                          <div className="flex items-center gap-2">
                            <User size={14} />
                            <span>الزبون: {result.customer_name}</span>
                          </div>
                        )}
                        {result.sale_date && (
                          <div className="flex items-center gap-2">
                            <Calendar size={14} />
                            <span>تاريخ البيع: {new Date(result.sale_date).toLocaleDateString('ar-EG')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails(result);
                      }}
                      className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo text-sm flex items-center gap-2"
                    >
                      <Eye size={16} />
                      <span>عرض التفاصيل</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {searchQuery && !loading && results.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Package size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-cairo">لم يتم العثور على نتائج</p>
          </div>
        )}

        {/* Details Modal */}
        {selectedSerial && (
          <div 
            className="fixed bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            style={{ 
              top: 0,
              bottom: 0,
              left: 0,
              right: isDesktop ? '256px' : '0' // In RTL: sidebar is on right, so start from right: 256px
            }}
            onClick={() => {
              setSelectedSerial(null);
              setDetails(null);
            }}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200" 
              onClick={(e) => e.stopPropagation()} 
              dir="rtl"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900 font-cairo">تفاصيل الرقم التسلسلي</h2>
                  <button
                    onClick={() => {
                      setSelectedSerial(null);
                      setDetails(null);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                    title="إغلاق"
                  >
                    <X size={20} />
                  </button>
                </div>

                {loadingDetails ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={32} className="animate-spin text-gray-400" />
                  </div>
                ) : details ? (
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-gray-900 font-cairo mb-2">{selectedSerial.serial_no}</div>
                      <div className={`inline-block px-3 py-1 rounded text-sm font-cairo ${getStatusColor(selectedSerial.status)}`}>
                        {getStatusLabel(selectedSerial.status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 font-cairo">المنتج</label>
                        <div className="text-gray-900 font-bold font-cairo">
                          {details.product_name || 'غير معروف'} ({details.product_id})
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 font-cairo">نوع الفاتورة</label>
                        <div className="flex items-center gap-2 text-gray-900 font-bold font-cairo">
                          {getInvoiceTypeIcon(selectedSerial.invoice_type)}
                          {getInvoiceTypeLabel(selectedSerial.invoice_type)}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 font-cairo">رقم الفاتورة</label>
                        <div className="text-gray-900 font-bold font-cairo">{selectedSerial.invoice_id}</div>
                      </div>
                      {details.customer_name && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 font-cairo">الزبون</label>
                          <div className="text-gray-900 font-bold font-cairo">{details.customer_name}</div>
                        </div>
                      )}
                      {details.sale_date && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 font-cairo">تاريخ البيع</label>
                          <div className="text-gray-900 font-bold font-cairo">
                            {new Date(details.sale_date).toLocaleDateString('ar-EG')}
                          </div>
                        </div>
                      )}
                      {details.notes && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1 font-cairo">ملاحظات</label>
                          <div className="text-gray-900 font-cairo">{details.notes}</div>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                      <button
                        onClick={() => {
                          // Navigate to invoice based on type
                          if (selectedSerial.invoice_type === 'cash') {
                            router.push(`/admin/invoices/${selectedSerial.invoice_id}`);
                          } else if (selectedSerial.invoice_type === 'shop_sales') {
                            router.push(`/admin/shop-sales/${selectedSerial.invoice_id}`);
                          } else if (selectedSerial.invoice_type === 'warehouse_sales') {
                            router.push(`/admin/warehouse-sales/${selectedSerial.invoice_id}`);
                          } else if (selectedSerial.invoice_type === 'quotation') {
                            router.push(`/admin/quotations/${selectedSerial.invoice_id}`);
                          }
                        }}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo"
                      >
                        عرض الفاتورة
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-600 font-cairo">لا توجد تفاصيل</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
