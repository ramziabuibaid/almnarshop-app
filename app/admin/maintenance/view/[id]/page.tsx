'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import MaintenanceTimeline from '@/components/admin/MaintenanceTimeline';
import { getMaintenance } from '@/lib/api';
import {
  Loader2,
  ArrowLeft,
  Edit,
  Image as ImageIcon,
  Printer,
  MessageCircle,
  History,
  X,
} from 'lucide-react';
import { convertDriveImageUrl } from '@/lib/api';
import { fixPhoneNumber } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function ViewMaintenancePage() {
  const router = useRouter();
  const params = useParams();
  const maintNo = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [printOverlayMaintNo, setPrintOverlayMaintNo] = useState<string | null>(null);
  const printIframeRef = useRef<HTMLIFrameElement>(null);

  const isMobilePrint = () => typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  useEffect(() => {
    if (maintNo) {
      loadRecord();
    }
  }, [maintNo]);

  useEffect(() => {
    if (!printOverlayMaintNo) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'print-ready' && printIframeRef.current?.contentWindow) {
        try {
          printIframeRef.current.contentWindow.print();
        } catch (_) {}
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [printOverlayMaintNo]);

  const loadRecord = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMaintenance(maintNo);
      setRecord(data);
    } catch (err: any) {
      console.error('[ViewMaintenancePage] Failed to load record:', err);
      setError(err?.message || 'فشل تحميل سجل الصيانة');
    } finally {
      setLoading(false);
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

  const getImageUrl = (imagePath: string | undefined) => {
    if (!imagePath) return null;
    return convertDriveImageUrl(imagePath);
  };

  const handleWhatsApp = async (countryCode: '970' | '972') => {
    if (!record) return;
    
    try {
      // Fetch customer data directly from Supabase
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('phone, name')
        .eq('customer_id', record.CustomerID)
        .single();

      if (customerError || !customer) {
        console.error('[ViewMaintenancePage] Error fetching customer:', customerError);
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
      console.error('[ViewMaintenancePage] Error sending WhatsApp:', error);
      alert(`فشل إرسال رسالة واتساب: ${error?.message || 'خطأ غير معروف'}`);
    }
  };

  // Check if WhatsApp button should be shown for this status
  const shouldShowWhatsApp = (status: string) => {
    return status === 'جاهزة للتسليم للزبون من المحل' || 
           status === 'جاهزة للتسليم للزبون من المخزن';
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">جاري تحميل السجل...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !record) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error || 'السجل غير موجود'}</p>
          </div>
          <button
            onClick={() => router.push('/admin/maintenance')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft size={20} />
            العودة للقائمة
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/maintenance')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">عرض سجل الصيانة</h1>
              <p className="text-gray-500">#{record.MaintNo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {shouldShowWhatsApp(record.Status) && (
              <div className="relative group">
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  title="إرسال واتساب"
                >
                  <MessageCircle size={20} />
                  إرسال واتساب
                </button>
                <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => handleWhatsApp('970')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-right text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MessageCircle size={16} className="text-green-600" />
                      <span className="flex-1">واتساب: 970</span>
                    </button>
                    <button
                      onClick={() => handleWhatsApp('972')}
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
              onClick={() => {
                if (isMobilePrint()) {
                  window.open(`/admin/maintenance/print/${record.MaintNo}`, `print-maintenance-${record.MaintNo}`, 'noopener,noreferrer');
                  return;
                }
                setPrintOverlayMaintNo(record.MaintNo);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
            >
              <Printer size={20} />
              طباعة
            </button>
            <button
              onClick={() => router.push(`/admin/maintenance/edit/${record.MaintNo}`)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              <Edit size={20} />
              تعديل
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200" dir="rtl">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                activeTab === 'details'
                  ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Edit size={18} />
              التفاصيل
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                activeTab === 'history'
                  ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <History size={18} />
              السجل التاريخي
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'details' && (
            <div className="p-6 space-y-6">
          {/* Customer Info */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">معلومات العميل</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">اسم العميل</label>
                <p className="text-gray-900 font-medium">{record.CustomerName || record.CustomerID}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">رقم العميل</label>
                <p className="text-gray-900">{record.CustomerID}</p>
              </div>
            </div>
          </div>

          {/* Item Information */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">معلومات القطعة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">اسم القطعة</label>
                <p className="text-gray-900 font-medium">{record.ItemName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">الموقع</label>
                <p className="text-gray-900">{record.Location}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">الشركة الكفيلة</label>
                <p className="text-gray-900">{record.Company || '—'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">رقم السيريال</label>
                <p className="text-gray-900">{record.SerialNo || '—'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">تحت الكفالة</label>
                <p className="text-gray-900">{record.UnderWarranty === 'YES' ? 'نعم' : 'لا'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">الحالة</label>
                <p className="text-gray-900 font-medium">{record.Status}</p>
              </div>
              {record.CostAmount !== null && record.CostAmount !== undefined && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">مبلغ التكلفة</label>
                  <p className="text-gray-900 font-medium">{record.CostAmount} ₪</p>
                </div>
              )}
              {record.CostReason && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">سبب التكلفة</label>
                  <p className="text-gray-900">{record.CostReason}</p>
                </div>
              )}
              {record.IsPaid !== undefined && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">تم الدفع</label>
                  <p className="text-gray-900">{record.IsPaid ? 'نعم' : 'لا'}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">تاريخ الشراء</label>
                <p className="text-gray-900">{formatDate(record.DateOfPurchase)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">تاريخ الاستقبال</label>
                <p className="text-gray-900">{formatDate(record.DateOfReceive)}</p>
              </div>
            </div>
          </div>

          {/* Problem Description */}
          {record.Problem && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">وصف المشكلة</h2>
              <p className="text-gray-900 whitespace-pre-wrap">{record.Problem}</p>
            </div>
          )}

          {/* Images */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">الصور</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {record.ImageOfItem && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">صورة القطعة</label>
                  <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={getImageUrl(record.ImageOfItem) || ''}
                      alt="صورة القطعة"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
              {record.ImageOfProblem && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">صورة المشكلة</label>
                  <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={getImageUrl(record.ImageOfProblem) || ''}
                      alt="صورة المشكلة"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
              {record.ImageOfWarranty && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">صورة الكفالة</label>
                  <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={getImageUrl(record.ImageOfWarranty) || ''}
                      alt="صورة الكفالة"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
              {!record.ImageOfItem && !record.ImageOfProblem && !record.ImageOfWarranty && (
                <div className="col-span-3 text-center py-8 text-gray-500">
                  <ImageIcon size={48} className="mx-auto mb-2 text-gray-300" />
                  <p>لا توجد صور</p>
                </div>
              )}
            </div>
          </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="p-6">
              <MaintenanceTimeline maintNo={maintNo} />
            </div>
          )}
        </div>
      </div>

      {printOverlayMaintNo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          dir="rtl"
          onClick={() => setPrintOverlayMaintNo(null)}
        >
          <div
            className="relative bg-white rounded-lg shadow-xl flex flex-col max-w-full max-h-full overflow-hidden"
            style={{ minWidth: '120mm', maxHeight: '95vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <span className="text-sm font-cairo text-gray-700">معاينة الطباعة — معاملة صيانة</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printIframeRef.current?.contentWindow?.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-cairo bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Printer size={20} />
                  طباعة مرة أخرى
                </button>
                <button
                  type="button"
                  onClick={() => setPrintOverlayMaintNo(null)}
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
                src={`/admin/maintenance/print/${printOverlayMaintNo}?embed=1`}
                title="طباعة معاملة الصيانة"
                className="w-full border-0 bg-white"
                style={{ minHeight: '70vh', height: '70vh' }}
              />
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

