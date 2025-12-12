'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { getMaintenance } from '@/lib/api';
import {
  Loader2,
  ArrowLeft,
  Edit,
  Image as ImageIcon,
  Printer,
} from 'lucide-react';
import { convertDriveImageUrl } from '@/lib/api';

export default function ViewMaintenancePage() {
  const router = useRouter();
  const params = useParams();
  const maintNo = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<any>(null);

  useEffect(() => {
    if (maintNo) {
      loadRecord();
    }
  }, [maintNo]);

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

  const getImageUrl = (imagePath: string | undefined) => {
    if (!imagePath) return null;
    return convertDriveImageUrl(imagePath);
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
            <button
              onClick={() => {
                const printUrl = `/admin/maintenance/print/${record.MaintNo}`;
                window.open(printUrl, '_blank');
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

        {/* Record Details */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
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
      </div>
    </AdminLayout>
  );
}

