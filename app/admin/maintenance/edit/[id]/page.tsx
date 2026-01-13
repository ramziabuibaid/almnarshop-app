'use client';

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (maintNo) {
      loadRecord();
      loadCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maintNo]);

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
        costAmount: formData.costAmount && formData.costAmount.trim() !== '' ? parseFloat(formData.costAmount) : null,
        costReason: formData.costReason.trim() || null,
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
            <p className="text-gray-600">جاري تحميل السجل...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/maintenance')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">تعديل سجل الصيانة</h1>
          <span className="text-gray-500">#{maintNo}</span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-6 space-y-8">
          {/* Customer Selection */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-base font-semibold text-gray-900">
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
              <p className="mt-2 text-xs text-gray-500">يرجى اختيار العميل من القائمة</p>
            )}
          </div>

          {/* Item Information */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">معلومات القطعة</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                اسم القطعة <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                placeholder="مثال: تلفزيون سامسونج 55 بوصة"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  الموقع <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value as 'المحل' | 'المخزن' })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
                  required
                >
                  <option value="المحل">المحل</option>
                  <option value="المخزن">المخزن</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  الشركة الكفيلة
                </label>
                <select
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  تاريخ الشراء
                </label>
                <input
                  type="date"
                  value={formData.dateOfPurchase}
                  onChange={(e) => setFormData({ ...formData, dateOfPurchase: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
                />
                <p className="mt-1 text-xs text-gray-500">اختياري - تاريخ شراء القطعة</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  تاريخ الاستقبال <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.dateOfReceive}
                  onChange={(e) => setFormData({ ...formData, dateOfReceive: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">تاريخ استلام القطعة للصيانة</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  رقم السيريال
                </label>
                <input
                  type="text"
                  value={formData.serialNo}
                  onChange={(e) => setFormData({ ...formData, serialNo: e.target.value })}
                  placeholder="رقم السيريال للقطعة"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
                />
                <p className="mt-1 text-xs text-gray-500">اختياري - الرقم التسلسلي للقطعة</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  تحت الكفالة
                </label>
                <select
                  value={formData.underWarranty}
                  onChange={(e) => setFormData({ ...formData, underWarranty: e.target.value as 'YES' | 'NO' })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
                >
                  <option value="NO">لا</option>
                  <option value="YES">نعم</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">هل القطعة تحت الكفالة؟</p>
              </div>
            </div>
          </div>

          {/* Problem Description */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">وصف المشكلة</h2>
            <textarea
              value={formData.problem}
              onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
              placeholder="وصف تفصيلي للمشكلة أو العطل في القطعة..."
              rows={5}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white resize-y"
            />
            <p className="mt-2 text-xs text-gray-500">اختياري - وصف المشكلة أو العطل في القطعة</p>
          </div>

          {/* Images */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">الصور</h2>
            <p className="text-sm text-gray-600 mb-4">يمكنك رفع صور للقطعة والمشكلة والكفالة (اختياري)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">الحالة</h2>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
            >
              <option value="موجودة في المحل وجاهزة للتسليم">موجودة في المحل وجاهزة للتسليم</option>
              <option value="موجودة في المخزن وجاهزة للتسليم">موجودة في المخزن وجاهزة للتسليم</option>
              <option value="موجودة في الشركة">موجودة في الشركة</option>
              <option value="جاهزة للتسليم للزبون من المحل">جاهزة للتسليم للزبون من المحل</option>
              <option value="جاهزة للتسليم للزبون من المخزن">جاهزة للتسليم للزبون من المخزن</option>
              <option value="سلمت للزبون">سلمت للزبون</option>
              <option value="تم ارجاعها للشركة وخصمها للزبون">تم ارجاعها للشركة وخصمها للزبون</option>
            </select>
            <p className="mt-2 text-xs text-gray-500">يمكن تغيير الحالة أيضاً من صفحة القائمة مباشرة</p>
          </div>

          {/* Financial Information */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">المعلومات المالية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  مبلغ التكلفة (₪)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.costAmount}
                  onChange={(e) => setFormData({ ...formData, costAmount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
                />
                <p className="mt-1 text-xs text-gray-500">مبلغ التكلفة المدفوع للشركة (اختياري)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  تم الدفع
                </label>
                <select
                  value={formData.isPaid ? 'YES' : 'NO'}
                  onChange={(e) => setFormData({ ...formData, isPaid: e.target.value === 'YES' })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
                >
                  <option value="NO">لا</option>
                  <option value="YES">نعم</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">هل تم دفع التكلفة للشركة؟</p>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                سبب التكلفة
              </label>
              <textarea
                value={formData.costReason}
                onChange={(e) => setFormData({ ...formData, costReason: e.target.value })}
                placeholder="وصف سبب التكلفة (مثال: إصلاح خارج الكفالة، قطع غيار إضافية، إلخ)"
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white resize-y"
              />
              <p className="mt-1 text-xs text-gray-500">وصف سبب التكلفة (اختياري)</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            {canAccountant && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    جاري الحذف...
                  </>
                ) : (
                  <>
                    <Trash2 size={20} />
                    حذف السجل
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push('/admin/maintenance')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              disabled={saving}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving || !formData.customerID || !formData.itemName.trim() || !formData.dateOfReceive}
              className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save size={20} />
                  حفظ التغييرات
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}

