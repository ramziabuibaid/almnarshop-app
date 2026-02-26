'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import CustomerSelect from '@/components/admin/CustomerSelect';
import ImageUploadField from '@/components/admin/ImageUploadField';
import { getMaintenance, updateMaintenance, deleteMaintenance, getAllCustomers } from '@/lib/api';
import {
  Loader2,
  Save,
  Trash2,
  ArrowLeft,
  ScanLine,
  X,
  Printer,
} from 'lucide-react';

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

export default function EditMaintenancePage() {
  const router = useRouter();
  const params = useParams();
  const { admin } = useAdminAuth();
  const maintNo = params?.id as string;

  // Check if user has accountant permission (for delete)
  const canAccountant = admin?.is_super_admin || admin?.permissions?.accountant === true;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    customerID: '',
    itemName: '',
    location: 'المحل' as 'المحل' | 'المخزن',
    company: '',
    dateOfPurchase: '',
    dateOfReceive: '',
    problem: '',
    imageOfItem: '',
    imageOfProblem: '',
    imageOfWarranty: '',
    serialNo: '',
    underWarranty: 'NO' as 'YES' | 'NO',
    status: 'موجودة في المحل وجاهزة للتسليم' as 'موجودة في المحل وجاهزة للتسليم' | 'موجودة في المخزن وجاهزة للتسليم' | 'موجودة في الشركة' | 'جاهزة للتسليم للزبون من المحل' | 'جاهزة للتسليم للزبون من المخزن' | 'سلمت للزبون' | 'تم ارجاعها للشركة وخصمها للزبون',
    costAmount: '',
    costReason: '',
    isPaid: false,
  });

  const [printQrOverlayMaintNo, setPrintQrOverlayMaintNo] = useState<string | null>(null);
  const printQrIframeRef = useRef<HTMLIFrameElement>(null);

  const isMobilePrint = () => typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  useEffect(() => {
    if (maintNo) {
      loadRecord();
      loadCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maintNo]);

  useEffect(() => {
    if (!printQrOverlayMaintNo) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'print-ready' && printQrIframeRef.current?.contentWindow) {
        const prevTitle = document.title;
        if (e.data?.title) document.title = e.data.title;
        try {
          printQrIframeRef.current.contentWindow.print();
        } catch (_) { }
        setTimeout(() => { document.title = prevTitle; }, 500);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [printQrOverlayMaintNo]);

  const loadRecord = async () => {
    setLoading(true);
    setError(null);
    try {
      const record = await getMaintenance(maintNo);

      const dateOfPurchase = record.DateOfPurchase ? new Date(record.DateOfPurchase).toISOString().split('T')[0] : '';
      const dateOfReceive = record.DateOfReceive ? new Date(record.DateOfReceive).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      setFormData({
        customerID: record.CustomerID || '',
        itemName: record.ItemName || '',
        location: (record.Location as 'المحل' | 'المخزن') || 'المحل',
        company: record.Company || '',
        dateOfPurchase: dateOfPurchase,
        dateOfReceive: dateOfReceive,
        problem: record.Problem || '',
        imageOfItem: record.ImageOfItem || '',
        imageOfProblem: record.ImageOfProblem || '',
        imageOfWarranty: record.ImageOfWarranty || '',
        serialNo: record.SerialNo || '',
        underWarranty: (record.UnderWarranty as 'YES' | 'NO') || 'NO',
        status: record.Status || 'موجودة في المحل وجاهزة للتسليم',
        costAmount: record.CostAmount ? String(record.CostAmount) : '',
        costReason: record.CostReason || '',
        isPaid: record.IsPaid || false,
      });
    } catch (err: any) {
      console.error('[EditMaintenancePage] Failed to load record:', err);
      setError(err?.message || 'فشل تحميل سجل الصيانة');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await getAllCustomers();
      setCustomers(data);
    } catch (err: any) {
      console.error('[EditMaintenancePage] Failed to load customers:', err);
    }
  };

  const handleImageUpload = (field: 'imageOfItem' | 'imageOfProblem' | 'imageOfWarranty', filePath: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: filePath,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.customerID) {
      setError('⚠️ يجب اختيار العميل');
      return;
    }

    if (!formData.itemName.trim()) {
      setError('⚠️ يجب إدخال اسم القطعة');
      return;
    }

    if (formData.itemName.trim().length < 3) {
      setError('⚠️ اسم القطعة يجب أن يكون على الأقل 3 أحرف');
      return;
    }

    if (!formData.dateOfReceive) {
      setError('⚠️ يجب تحديد تاريخ الاستقبال');
      return;
    }

    // Validate date is not in the future
    const receiveDate = new Date(formData.dateOfReceive);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (receiveDate > today) {
      setError('⚠️ تاريخ الاستقبال لا يمكن أن يكون في المستقبل');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        customerID: formData.customerID,
        itemName: formData.itemName.trim(),
        location: formData.location,
        company: formData.company.trim() || undefined,
        dateOfPurchase: formData.dateOfPurchase || undefined,
        dateOfReceive: formData.dateOfReceive,
        problem: formData.problem.trim() || undefined,
        imageOfItem: formData.imageOfItem || undefined,
        imageOfProblem: formData.imageOfProblem || undefined,
        imageOfWarranty: formData.imageOfWarranty || undefined,
        serialNo: formData.serialNo.trim() || undefined,
        underWarranty: formData.underWarranty,
        status: formData.status,
        costAmount: formData.costAmount && formData.costAmount.trim() !== '' ? parseFloat(formData.costAmount) : undefined,
        costReason: formData.costReason.trim() || undefined,
        isPaid: formData.isPaid,
      };

      await updateMaintenance(maintNo, payload);
      router.push('/admin/maintenance');
    } catch (err: any) {
      console.error('[EditMaintenancePage] Failed to update record:', err);
      setError(err?.message || 'فشل تحديث سجل الصيانة');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteMaintenance(maintNo, admin?.username);
      router.push('/admin/maintenance');
    } catch (err: any) {
      console.error('[EditMaintenancePage] Failed to delete record:', err);
      setError(err?.message || 'فشل حذف سجل الصيانة');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-cairo">جاري تحميل السجل...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 font-cairo" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => router.push('/admin/maintenance')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 font-cairo">تعديل سجل الصيانة</h1>
          <span className="text-sm sm:text-base text-gray-500 font-cairo">#{maintNo}</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => {
              if (isMobilePrint()) {
                window.open(`/admin/maintenance/print-qr/${maintNo}`, `print-qr-${maintNo}`, 'noopener,noreferrer');
                return;
              }
              setPrintQrOverlayMaintNo(maintNo);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium font-cairo text-sm"
            title="طباعة ملصق الباركود بحجم 50x25"
          >
            <ScanLine size={18} />
            <span className="hidden sm:inline">طباعة الباركود</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
            <p className="text-red-700 text-sm sm:text-base font-cairo">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 space-y-4 sm:space-y-8">
          {/* Customer Selection */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm sm:text-base font-semibold text-gray-900 font-cairo">
                معلومات العميل <span className="text-red-500">*</span>
              </label>
            </div>
            <CustomerSelect
              value={formData.customerID}
              onChange={(customerID) => setFormData({ ...formData, customerID })}
              customers={customers}
              required
            />
            {!formData.customerID && (
              <p className="mt-2 text-xs text-gray-500 font-cairo">يرجى اختيار العميل من القائمة</p>
            )}
          </div>

          {/* Item Information */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200 space-y-3 sm:space-y-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-3 sm:mb-4 font-cairo">معلومات القطعة</h2>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-2 font-cairo">
                اسم القطعة <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                placeholder="مثال: تلفزيون سامسونج 55 بوصة"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white font-cairo text-sm sm:text-base"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-2 font-cairo">
                  الموقع <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value as 'المحل' | 'المخزن' })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white font-cairo text-sm sm:text-base"
                  required
                >
                  <option value="المحل">المحل</option>
                  <option value="المخزن">المخزن</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-2 font-cairo">
                  الشركة الكفيلة
                </label>
                <select
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white font-cairo text-sm sm:text-base"
                >
                  <option value="">اختر الشركة (اختياري)</option>
                  {companyOptions.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-2 font-cairo">
                  تاريخ الشراء
                </label>
                <input
                  type="date"
                  value={formData.dateOfPurchase}
                  onChange={(e) => setFormData({ ...formData, dateOfPurchase: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white font-cairo text-sm sm:text-base"
                />
                <p className="mt-1 text-xs text-gray-500 font-cairo">اختياري - تاريخ شراء القطعة</p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-2 font-cairo">
                  تاريخ الاستقبال <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.dateOfReceive}
                  onChange={(e) => setFormData({ ...formData, dateOfReceive: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white font-cairo text-sm sm:text-base"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 font-cairo">تاريخ استلام القطعة للصيانة</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-2 font-cairo">
                  رقم السيريال
                </label>
                <input
                  type="text"
                  value={formData.serialNo}
                  onChange={(e) => setFormData({ ...formData, serialNo: e.target.value })}
                  placeholder="رقم السيريال للقطعة"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white font-cairo text-sm sm:text-base"
                />
                <p className="mt-1 text-xs text-gray-500 font-cairo">اختياري - الرقم التسلسلي للقطعة</p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-2 font-cairo">
                  تحت الكفالة
                </label>
                <select
                  value={formData.underWarranty}
                  onChange={(e) => setFormData({ ...formData, underWarranty: e.target.value as 'YES' | 'NO' })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white font-cairo text-sm sm:text-base"
                >
                  <option value="NO">لا</option>
                  <option value="YES">نعم</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 font-cairo">هل القطعة تحت الكفالة؟</p>
              </div>
            </div>
          </div>

          {/* Problem Description */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-3 sm:mb-4 font-cairo">وصف المشكلة</h2>
            <textarea
              value={formData.problem}
              onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
              placeholder="وصف تفصيلي للمشكلة أو العطل في القطعة..."
              rows={5}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white resize-y font-cairo text-sm sm:text-base"
            />
            <p className="mt-2 text-xs text-gray-500 font-cairo">اختياري - وصف المشكلة أو العطل في القطعة</p>
          </div>

          {/* Images */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-3 sm:mb-4 font-cairo">الصور</h2>
            <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4 font-cairo">يمكنك رفع صور للقطعة والمشكلة والكفالة (اختياري)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <ImageUploadField
                label="صورة القطعة"
                currentValue={formData.imageOfItem}
                previewUrl={formData.imageOfItem ? undefined : undefined}
                onUploadComplete={(filePath) => handleImageUpload('imageOfItem', filePath)}
              />
              <ImageUploadField
                label="صورة المشكلة"
                currentValue={formData.imageOfProblem}
                previewUrl={formData.imageOfProblem ? undefined : undefined}
                onUploadComplete={(filePath) => handleImageUpload('imageOfProblem', filePath)}
              />
              <ImageUploadField
                label="صورة الكفالة"
                currentValue={formData.imageOfWarranty}
                previewUrl={formData.imageOfWarranty ? undefined : undefined}
                onUploadComplete={(filePath) => handleImageUpload('imageOfWarranty', filePath)}
              />
            </div>
          </div>

          {/* Status */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-3 sm:mb-4 font-cairo">الحالة</h2>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white font-cairo text-sm sm:text-base"
            >
              <option value="موجودة في المحل وجاهزة للتسليم">موجودة في المحل وجاهزة للتسليم</option>
              <option value="موجودة في المخزن وجاهزة للتسليم">موجودة في المخزن وجاهزة للتسليم</option>
              <option value="موجودة في الشركة">موجودة في الشركة</option>
              <option value="جاهزة للتسليم للزبون من المحل">جاهزة للتسليم للزبون من المحل</option>
              <option value="جاهزة للتسليم للزبون من المخزن">جاهزة للتسليم للزبون من المخزن</option>
              <option value="سلمت للزبون">سلمت للزبون</option>
              <option value="تم ارجاعها للشركة وخصمها للزبون">تم ارجاعها للشركة وخصمها للزبون</option>
            </select>
            <p className="mt-2 text-xs text-gray-500 font-cairo">يمكن تغيير الحالة أيضاً من صفحة القائمة مباشرة</p>
          </div>

          {/* Financial Information */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-3 sm:mb-4 font-cairo">المعلومات المالية</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-2 font-cairo">
                  مبلغ التكلفة (₪)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.costAmount}
                  onChange={(e) => setFormData({ ...formData, costAmount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white font-cairo text-sm sm:text-base"
                />
                <p className="mt-1 text-xs text-gray-500 font-cairo">مبلغ التكلفة المدفوع للشركة (اختياري)</p>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-2 font-cairo">
                  تم الدفع
                </label>
                <select
                  value={formData.isPaid ? 'YES' : 'NO'}
                  onChange={(e) => setFormData({ ...formData, isPaid: e.target.value === 'YES' })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white font-cairo text-sm sm:text-base"
                >
                  <option value="NO">لا</option>
                  <option value="YES">نعم</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 font-cairo">هل تم دفع التكلفة للشركة؟</p>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-2 font-cairo">
                سبب التكلفة
              </label>
              <textarea
                value={formData.costReason}
                onChange={(e) => setFormData({ ...formData, costReason: e.target.value })}
                placeholder="وصف سبب التكلفة (مثال: إصلاح خارج الكفالة، قطع غيار إضافية، إلخ)"
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white resize-y font-cairo text-sm sm:text-base"
              />
              <p className="mt-1 text-xs text-gray-500 font-cairo">وصف سبب التكلفة (اختياري)</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-gray-200">
            {canAccountant && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed font-cairo text-sm sm:text-base"
              >
                {deleting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={20} />
                    <span>حذف السجل</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push('/admin/maintenance')}
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium font-cairo text-sm sm:text-base"
              disabled={saving}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving || !formData.customerID || !formData.itemName.trim() || !formData.dateOfReceive}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed font-cairo text-sm sm:text-base"
            >
              {saving ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Save size={20} />
                  <span>حفظ التغييرات</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {printQrOverlayMaintNo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          dir="rtl"
          onClick={() => setPrintQrOverlayMaintNo(null)}
        >
          <div
            className="relative bg-white rounded-lg shadow-xl flex flex-col max-w-full max-h-full overflow-hidden"
            style={{ minWidth: '120mm', maxHeight: '95vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <span className="text-sm font-cairo text-gray-700">معاينة طباعة — ملصق الباركود</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printQrIframeRef.current?.contentWindow?.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-cairo bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Printer size={20} />
                  طباعة مرة أخرى
                </button>
                <button
                  type="button"
                  onClick={() => setPrintQrOverlayMaintNo(null)}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors"
                  aria-label="إغلاق"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-white min-h-0 flex items-center justify-center bg-gray-100">
              <iframe
                ref={printQrIframeRef}
                src={`/admin/maintenance/print-qr/${printQrOverlayMaintNo}?embed=1`}
                title="طباعة ملصق الباركود"
                className="border border-gray-300 shadow-sm bg-white"
                style={{ width: '50mm', height: '25mm' }}
              />
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

