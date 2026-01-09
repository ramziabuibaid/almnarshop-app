'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Save, Loader2, Trash2 } from 'lucide-react';
import { saveCustomer, deleteCustomer, generateCustomerID } from '@/lib/api';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: any | null;
  onSuccess: (customerId?: string) => void;
}

export default function CustomerFormModal({
  isOpen,
  onClose,
  customer,
  onSuccess,
}: CustomerFormModalProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    CustomerID: '',
    Name: '',
    ShamelNo: '',
    Phone: '',
    Email: '',
    Address: '',
    PostalCode: '',
    Type: 'زبون',
    Notes: '',
    Balance: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [generatedCustomerID, setGeneratedCustomerID] = useState<string>('');
  const [isGeneratingID, setIsGeneratingID] = useState(false);

  // Initialize form data when modal opens or customer changes
  useEffect(() => {
    if (isOpen) {
      if (customer) {
        // Debug: Log all customer data to see what fields are available
        console.log('[CustomerFormModal] Loading customer data:', customer);
        console.log('[CustomerFormModal] Customer keys:', Object.keys(customer));
        console.log('[CustomerFormModal] ShamelNo variations:', {
          'Shamel No': customer['Shamel No'],
          'ShamelNo': customer.ShamelNo,
          'shamelNo': customer.shamelNo,
          'ShamelNO': customer.ShamelNO,
          'shamelNO': customer.shamelNO,
        });
        
        // Edit mode - pre-fill with customer data
        // Try all possible variations of ShamelNo field name
        const shamelNo = customer['Shamel No'] || 
                        customer.ShamelNo || 
                        customer.shamelNo || 
                        customer.ShamelNO || 
                        customer.shamelNO || 
                        '';
        
        const customerID = customer.CustomerID || customer.id || customer.customerID || '';
        
        console.log('[CustomerFormModal] Resolved ShamelNo value:', shamelNo);
        
        // Map English type values to Arabic when loading
        const customerType = customer.Type || customer.type || 'زبون';
        let mappedType = customerType;
        // Convert English to Arabic if needed
        if (customerType === 'Customer' || customerType === 'customer') {
          mappedType = 'زبون';
        } else if (customerType === 'Merchant' || customerType === 'merchant') {
          mappedType = 'تاجر';
        } else if (customerType === 'Supplier' || customerType === 'supplier') {
          mappedType = 'مورد';
        } else if (customerType === 'Accounting' || customerType === 'accounting') {
          mappedType = 'تنظيمات محاسبية';
        }
        
        setFormData({
          CustomerID: customerID,
          Name: customer.Name || customer.name || '',
          ShamelNo: String(shamelNo || ''), // Ensure it's a string
          Phone: customer.Phone || customer.phone || '',
          Email: customer.Email || customer.email || '',
          Address: customer.Address || customer.address || '',
          PostalCode: customer.PostalCode || customer.postalCode || '',
          Type: mappedType,
          Notes: customer.Notes || customer.notes || '',
          Balance: customer.Balance !== undefined && customer.Balance !== null ? String(customer.Balance) : '',
        });
        
        // Set generated ID to current customer ID for edit mode
        setGeneratedCustomerID(customerID);
        
        console.log('[CustomerFormModal] Form data initialized:', {
          CustomerID: customerID,
          Name: customer.Name || customer.name || '',
          ShamelNo: shamelNo,
        });
      } else {
        // Add mode - empty form and generate new customer ID
        setFormData({
          CustomerID: '',
          Name: '',
          ShamelNo: '',
          Phone: '',
          Email: '',
          Address: '',
          PostalCode: '',
          Type: 'زبون',
          Notes: '',
          Balance: '',
        });
        
        // Generate new customer ID
        setIsGeneratingID(true);
        generateCustomerID()
          .then((newID) => {
            setGeneratedCustomerID(newID);
            setFormData((prev) => ({ ...prev, CustomerID: newID }));
          })
          .catch((err) => {
            console.error('[CustomerFormModal] Error generating customer ID:', err);
            setError('فشل توليد رقم الزبون. يرجى المحاولة مرة أخرى.');
          })
          .finally(() => {
            setIsGeneratingID(false);
          });
      }
      setError('');
    }
  }, [isOpen, customer]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (!formData.Name.trim()) {
        setError('الاسم مطلوب');
        setIsSubmitting(false);
        return;
      }

      // Prepare customer data for API
      let customerData: any = {
        Name: formData.Name.trim(),
      };

      // Set CustomerID - use generated ID for new customers, or existing ID for editing
      const customerIDToUse = generatedCustomerID || formData.CustomerID;
      if (customerIDToUse) {
        customerData.CustomerID = customerIDToUse;
      }

      // If editing, preserve all original fields to avoid data loss
      if (customer && formData.CustomerID) {
        
        // Balance can be edited - use form value if provided, otherwise preserve original
        // If form has Balance value, use it; otherwise preserve original
        if (formData.Balance && formData.Balance.trim()) {
          const balanceValue = parseFloat(formData.Balance.trim());
          if (!isNaN(balanceValue)) {
            customerData.Balance = balanceValue;
          }
        } else if (customer.Balance !== undefined && customer.Balance !== null) {
          // Preserve original balance if form is empty
          customerData.Balance = customer.Balance;
        }
        // Preserve other fields that might exist
        if (customer.Photo !== undefined) {
          customerData.Photo = customer.Photo;
        }
      }

      // Add/update editable fields
      // Always include ShamelNo - preserve original if form is empty
      // Backend may use 'Shamel No' (with space) or 'ShamelNo' (without space) or 'ShamelNO'
      // Send all variations to ensure compatibility
      // Safely handle trim - ensure value is a string first
      const shamelNoFormValue = formData.ShamelNo ? String(formData.ShamelNo).trim() : '';
      let shamelNoValue = shamelNoFormValue;
      // If editing and ShamelNo is empty in form, preserve original value
      if (customer && !shamelNoValue) {
        shamelNoValue = String(customer['Shamel No'] || customer.ShamelNo || customer.shamelNo || customer.ShamelNO || customer.shamelNO || '');
      }
      // Always send ShamelNo (even if empty) to preserve it
      customerData.ShamelNo = shamelNoValue;
      customerData['Shamel No'] = shamelNoValue; // Also send with space for backend compatibility
      customerData.ShamelNO = shamelNoValue; // Also send as ShamelNO (all caps) for backend compatibility
      
      // Add PostalCode
      if (formData.PostalCode.trim()) {
        customerData.PostalCode = formData.PostalCode.trim();
      } else if (customer && customer.PostalCode) {
        customerData.PostalCode = customer.PostalCode;
      }
      
      if (formData.Phone.trim()) {
        customerData.Phone = formData.Phone.trim();
      } else if (customer && customer.Phone) {
        // Preserve existing phone if not provided
        customerData.Phone = customer.Phone;
      }
      
      if (formData.Email.trim()) {
        customerData.Email = formData.Email.trim();
      } else if (customer && customer.Email) {
        // Preserve existing email if not provided
        customerData.Email = customer.Email;
      }
      
      if (formData.Address.trim()) {
        customerData.Address = formData.Address.trim();
      } else if (customer && customer.Address) {
        // Preserve existing address if not provided
        customerData.Address = customer.Address;
      }
      
      if (formData.Type) {
        customerData.Type = formData.Type;
      }
      
      if (formData.Notes.trim()) {
        customerData.Notes = formData.Notes.trim();
      } else if (customer && customer.Notes) {
        // Preserve existing notes if not provided
        customerData.Notes = customer.Notes;
      }

      console.log('[CustomerFormModal] Submitting customer:', customerData);
      console.log('[CustomerFormModal] Original customer data:', customer);
      console.log('[CustomerFormModal] Form data:', formData);
      console.log('[CustomerFormModal] ShamelNo value:', shamelNoValue);
      console.log('[CustomerFormModal] LastInvoiceDate preserved:', customerData.LastInvoiceDate);
      console.log('[CustomerFormModal] LastPaymentDate preserved:', customerData.LastPaymentDate);

      const result = await saveCustomer(customerData);

      // Success - close modal and refresh
      // Pass the customer ID to onSuccess callback
      const savedCustomerId = result?.data?.customer_id || customerIDToUse || generatedCustomerID;
      onSuccess(savedCustomerId);
      onClose();
    } catch (err: any) {
      console.error('[CustomerFormModal] Error saving customer:', err);
      setError(err?.message || 'فشل حفظ العميل. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!customer) return;

    const customerId = customer.CustomerID || customer.id || customer.customerID || '';
    if (!customerId) {
      alert('لا يمكن حذف هذا الزبون: رقم الزبون غير موجود');
      return;
    }

    const customerName = customer.Name || customer.name || 'هذا الزبون';
    const confirmMessage = `هل أنت متأكد من حذف الزبون "${customerName}"؟\n\nهذا الإجراء لا يمكن التراجع عنه.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);
    setError('');
    try {
      const result = await deleteCustomer(customerId);
      
      if (result.status === 'blocked' && result.references) {
        const refs = result.references;
        const messages: string[] = [];
        
        if (refs.shopReceipts.length > 0) {
          messages.push(`سندات قبض: ${refs.shopReceipts.slice(0, 10).join(', ')}${refs.shopReceipts.length > 10 ? ` و${refs.shopReceipts.length - 10} أخرى` : ''}`);
        }
        if (refs.shopPayments.length > 0) {
          messages.push(`سندات صرف: ${refs.shopPayments.slice(0, 10).join(', ')}${refs.shopPayments.length > 10 ? ` و${refs.shopPayments.length - 10} أخرى` : ''}`);
        }
        if (refs.shopInvoices.length > 0) {
          messages.push(`فواتير مبيعات المحل: ${refs.shopInvoices.slice(0, 10).join(', ')}${refs.shopInvoices.length > 10 ? ` و${refs.shopInvoices.length - 10} أخرى` : ''}`);
        }
        if (refs.warehouseInvoices.length > 0) {
          messages.push(`فواتير مبيعات المخزن: ${refs.warehouseInvoices.slice(0, 10).join(', ')}${refs.warehouseInvoices.length > 10 ? ` و${refs.warehouseInvoices.length - 10} أخرى` : ''}`);
        }
        if (refs.quotations.length > 0) {
          messages.push(`عروض أسعار: ${refs.quotations.slice(0, 10).join(', ')}${refs.quotations.length > 10 ? ` و${refs.quotations.length - 10} أخرى` : ''}`);
        }
        if (refs.maintenance.length > 0) {
          messages.push(`صيانة: ${refs.maintenance.slice(0, 10).join(', ')}${refs.maintenance.length > 10 ? ` و${refs.maintenance.length - 10} أخرى` : ''}`);
        }
        if (refs.checks.length > 0) {
          messages.push(`شيكات راجعة: ${refs.checks.slice(0, 10).join(', ')}${refs.checks.length > 10 ? ` و${refs.checks.length - 10} أخرى` : ''}`);
        }
        
        const errorMessage = `لا يمكن حذف الزبون لأنه مرتبط بـ:\n\n${messages.join('\n')}\n\nيرجى إصلاح أو حذف هذه السجلات أولاً.`;
        setError(errorMessage);
        return;
      }
      
      alert('تم حذف الزبون بنجاح');
      onSuccess();
      onClose();
      // Redirect to customers list if we're on a customer profile page
      if (typeof window !== 'undefined' && window.location.pathname.includes('/admin/customers/')) {
        router.push('/admin/customers');
      }
    } catch (err: any) {
      console.error('[CustomerFormModal] Error deleting customer:', err);
      setError(err?.message || 'فشل حذف العميل. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {customer ? 'تعديل العميل' : 'إضافة عميل جديد'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              disabled={isSubmitting}
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer ID */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  رقم الزبون
                </label>
                <input
                  type="text"
                  value={isGeneratingID ? 'جاري التوليد...' : (generatedCustomerID || formData.CustomerID)}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed font-mono"
                  dir="ltr"
                />
                {isGeneratingID && (
                  <p className="text-xs text-gray-500 mt-1">يرجى الانتظار...</p>
                )}
              </div>

              {/* Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  الاسم <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.Name}
                  onChange={(e) => handleChange('Name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  required
                  dir="rtl"
                />
              </div>

              {/* Shamel No */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  رقم الزبون في الشامل
                </label>
                <input
                  type="text"
                  value={formData.ShamelNo}
                  onChange={(e) => handleChange('ShamelNo', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                />
              </div>

              {/* Postal Code */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  الرمز البريدي
                </label>
                <input
                  type="text"
                  value={formData.PostalCode}
                  onChange={(e) => handleChange('PostalCode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  الهاتف
                </label>
                <input
                  type="tel"
                  value={formData.Phone}
                  onChange={(e) => handleChange('Phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={formData.Email}
                  onChange={(e) => handleChange('Email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  النوع
                </label>
                <select
                  value={formData.Type}
                  onChange={(e) => handleChange('Type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                >
                  <option value="زبون">زبون</option>
                  <option value="تاجر">تاجر</option>
                  <option value="مورد">مورد</option>
                  <option value="تنظيمات محاسبية">تنظيمات محاسبية</option>
                </select>
              </div>

              {/* Balance */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  الرصيد
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.Balance}
                  onChange={(e) => handleChange('Balance', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  placeholder="0.00"
                />
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  العنوان
                </label>
                <textarea
                  value={formData.Address}
                  onChange={(e) => handleChange('Address', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 resize-none"
                  dir="rtl"
                />
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  ملاحظات
                </label>
                <textarea
                  value={formData.Notes}
                  onChange={(e) => handleChange('Notes', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 resize-none"
                  dir="rtl"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4">
              {customer && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting || isSubmitting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      جاري الحذف...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      حذف
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting || isDeleting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isDeleting}
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {customer ? 'حفظ التعديلات' : 'إضافة العميل'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

