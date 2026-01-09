'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import CustomerSelect from '@/components/admin/CustomerSelect';
import CustomerFormModal from '@/components/admin/CustomerFormModal';
import ImageUploadField from '@/components/admin/ImageUploadField';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { saveMaintenance, getAllCustomers } from '@/lib/api';
import {
  Loader2,
  Save,
  ArrowLeft,
  Camera,
  UserPlus,
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
  const { admin } = useAdminAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  
  // Determine default location and status based on admin's work location
  const getDefaultLocationAndStatus = () => {
    const workLocation = admin?.work_location || 'المحل';
    if (workLocation === 'المخزن') {
      return {
        location: 'المخزن' as 'المحل' | 'المخزن',
        status: 'موجودة في المخزن وجاهزة للتسليم' as const,
      };
    }
    return {
      location: 'المحل' as 'المحل' | 'المخزن',
      status: 'موجودة في المحل وجاهزة للتسليم' as const,
    };
  };

  const defaults = getDefaultLocationAndStatus();
  
  const [formData, setFormData] = useState({
    customerID: '',
    itemName: '',
    location: defaults.location,
    company: '',
    dateOfPurchase: '',
    dateOfReceive: new Date().toISOString().split('T')[0],
    problem: '',
    imageOfItem: '',
    imageOfProblem: '',
    imageOfWarranty: '',
    serialNo: '',
    underWarranty: 'NO' as 'YES' | 'NO',
    status: defaults.status,
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  // Update form data when admin work location changes
  useEffect(() => {
    if (admin) {
      const newDefaults = getDefaultLocationAndStatus();
      setFormData((prev) => ({
        ...prev,
        location: newDefaults.location,
        status: newDefaults.status,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin?.work_location]);

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

  const handleCustomerAdded = async (newCustomerId?: string) => {
    // Reload customers list to get the newly added customer
    const updatedCustomers = await getAllCustomers();
    setCustomers(updatedCustomers);
    
    // If customer ID is provided, select it automatically
    if (newCustomerId) {
      setFormData((prev) => ({ ...prev, customerID: newCustomerId }));
    }
    
    setIsCustomerModalOpen(false);
  };

  const handleImageUpload = (field: 'imageOfItem' | 'imageOfProblem' | 'imageOfWarranty', filePath: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: filePath,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    if (!formData.company || !formData.company.trim()) {
      setError('⚠️ يجب اختيار الشركة الكفيلة');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        customerID: formData.customerID,
        itemName: formData.itemName.trim(),
        location: formData.location,
        company: formData.company.trim(),
        dateOfPurchase: formData.dateOfPurchase || undefined,
        dateOfReceive: formData.dateOfReceive,
        problem: formData.problem.trim() || undefined,
        imageOfItem: formData.imageOfItem || undefined,
        imageOfProblem: formData.imageOfProblem || undefined,
        imageOfWarranty: formData.imageOfWarranty || undefined,
        serialNo: formData.serialNo.trim() || undefined,
        underWarranty: formData.underWarranty,
        status: formData.status,
        created_by: admin?.id || undefined,
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
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-8">
          {/* Customer Selection */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-base font-semibold text-gray-900">
                معلومات العميل <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-white rounded-lg transition-colors border border-gray-300"
                title="إضافة زبون جديد"
              >
                <UserPlus size={16} />
                <span>إضافة زبون جديد</span>
              </button>
            </div>
            <CustomerSelect
              value={formData.customerID}
              onChange={(customerID) => setFormData({ ...formData, customerID })}
              customers={customers}
              required
            />
            {!formData.customerID && (
              <p className="mt-2 text-xs text-gray-500">يرجى اختيار العميل من القائمة أو إضافة عميل جديد</p>
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
              {!formData.itemName.trim() && (
                <p className="mt-1 text-xs text-gray-500">يرجى إدخال اسم القطعة المراد صيانتها</p>
              )}
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
                {admin?.work_location && (
                  <p className="mt-1 text-xs text-blue-600">
                    ✓ تم تعيين الموقع تلقائياً بناءً على مكان عملك ({admin.work_location})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  الشركة الكفيلة <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
                  required
                >
                  <option value="">اختر الشركة</option>
                  {companyOptions.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
                {!formData.company && (
                  <p className="mt-1 text-xs text-gray-500">يرجى اختيار الشركة الكفيلة</p>
                )}
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
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-4">الحالة الأولية</h2>
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
            {admin?.work_location && (
              <p className="mt-2 text-xs text-blue-600">
                ✓ تم تعيين الحالة تلقائياً بناءً على مكان عملك ({admin.work_location})
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">يمكن تغيير الحالة لاحقاً من صفحة القائمة</p>
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
              disabled={saving || !formData.customerID || !formData.itemName.trim() || !formData.dateOfReceive || !formData.company || !formData.company.trim()}
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

        {/* Customer Form Modal */}
        <CustomerFormModal
          isOpen={isCustomerModalOpen}
          onClose={() => setIsCustomerModalOpen(false)}
          customer={null}
          onSuccess={handleCustomerAdded}
        />
      </div>
    </AdminLayout>
  );
}

