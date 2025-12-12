'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import CustomerSelect from '@/components/admin/CustomerSelect';
import ImageUploadField from '@/components/admin/ImageUploadField';
import { saveMaintenance, getAllCustomers } from '@/lib/api';
import {
  Loader2,
  Save,
  ArrowLeft,
  Camera,
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

export default function NewMaintenancePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    customerID: '',
    itemName: '',
    location: 'المحل' as 'المحل' | 'المخزن',
    company: '',
    dateOfPurchase: '',
    dateOfReceive: new Date().toISOString().split('T')[0],
    problem: '',
    imageOfItem: '',
    imageOfProblem: '',
    imageOfWarranty: '',
    serialNo: '',
    underWarranty: 'NO' as 'YES' | 'NO',
    status: 'موجودة في المحل وجاهزة للتسليم' as 'موجودة في المحل وجاهزة للتسليم' | 'موجودة في المخزن وجاهزة للتسليم' | 'موجودة في الشركة' | 'جاهزة للتسليم للزبون من المحل' | 'جاهزة للتسليم للزبون من المخزن' | 'سلمت للزبون' | 'تم ارجاعها للشركة وخصمها للزبون',
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await getAllCustomers();
      setCustomers(data);
    } catch (err: any) {
      console.error('[NewMaintenancePage] Failed to load customers:', err);
      setError(err?.message || 'فشل تحميل العملاء');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (field: 'imageOfItem' | 'imageOfProblem' | 'imageOfWarranty', filePath: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: filePath,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerID) {
      setError('يجب اختيار العميل');
      return;
    }
    
    if (!formData.itemName.trim()) {
      setError('يجب إدخال اسم القطعة');
      return;
    }
    
    if (!formData.dateOfReceive) {
      setError('يجب تحديد تاريخ الاستقبال');
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
      };

      await saveMaintenance(payload);
      router.push('/admin/maintenance');
    } catch (err: any) {
      console.error('[NewMaintenancePage] Error saving maintenance:', err);
      setError(err?.message || 'فشل حفظ سجل الصيانة');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">جاري التحميل...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">إضافة سجل صيانة جديد</h1>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          {/* Customer Selection */}
          <div>
            <CustomerSelect
              value={formData.customerID}
              onChange={(customerID) => setFormData({ ...formData, customerID })}
              customers={customers}
              required
            />
          </div>

          {/* Item Information */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2">معلومات القطعة</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                اسم القطعة <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  الموقع <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value as 'المحل' | 'المخزن' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  required
                >
                  <option value="المحل">المحل</option>
                  <option value="المخزن">المخزن</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  الشركة الكفيلة
                </label>
                <select
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                >
                  <option value="">اختر الشركة</option>
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
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  تاريخ الشراء
                </label>
                <input
                  type="date"
                  value={formData.dateOfPurchase}
                  onChange={(e) => setFormData({ ...formData, dateOfPurchase: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  تاريخ الاستقبال <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.dateOfReceive}
                  onChange={(e) => setFormData({ ...formData, dateOfReceive: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  رقم السيريال
                </label>
                <input
                  type="text"
                  value={formData.serialNo}
                  onChange={(e) => setFormData({ ...formData, serialNo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  تحت الكفالة
                </label>
                <select
                  value={formData.underWarranty}
                  onChange={(e) => setFormData({ ...formData, underWarranty: e.target.value as 'YES' | 'NO' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                >
                  <option value="NO">لا</option>
                  <option value="YES">نعم</option>
                </select>
              </div>
            </div>
          </div>

          {/* Problem Description */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">وصف المشكلة</h2>
            <textarea
              value={formData.problem}
              onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
              placeholder="وصف المشكلة..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
          </div>

          {/* Images */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">الصور</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ImageUploadField
                label="صورة القطعة"
                currentValue={formData.imageOfItem}
                onUploadComplete={(filePath) => handleImageUpload('imageOfItem', filePath)}
              />
              <ImageUploadField
                label="صورة المشكلة"
                currentValue={formData.imageOfProblem}
                onUploadComplete={(filePath) => handleImageUpload('imageOfProblem', filePath)}
              />
              <ImageUploadField
                label="صورة الكفالة"
                currentValue={formData.imageOfWarranty}
                onUploadComplete={(filePath) => handleImageUpload('imageOfWarranty', filePath)}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">الحالة</h2>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            >
              <option value="موجودة في المحل وجاهزة للتسليم">موجودة في المحل وجاهزة للتسليم</option>
              <option value="موجودة في المخزن وجاهزة للتسليم">موجودة في المخزن وجاهزة للتسليم</option>
              <option value="موجودة في الشركة">موجودة في الشركة</option>
              <option value="جاهزة للتسليم للزبون من المحل">جاهزة للتسليم للزبون من المحل</option>
              <option value="جاهزة للتسليم للزبون من المخزن">جاهزة للتسليم للزبون من المخزن</option>
              <option value="سلمت للزبون">سلمت للزبون</option>
              <option value="تم ارجاعها للشركة وخصمها للزبون">تم ارجاعها للشركة وخصمها للزبون</option>
            </select>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
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
                  حفظ السجل
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}

