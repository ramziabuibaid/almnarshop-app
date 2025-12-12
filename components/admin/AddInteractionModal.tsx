'use client';

import { useState, useEffect } from 'react';
import { X, Save, Loader2, Phone, MessageSquare, MapPin, Mail } from 'lucide-react';
import { logActivity } from '@/lib/api';

interface AddInteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: any | null;
  onSuccess: () => void;
}

export default function AddInteractionModal({
  isOpen,
  onClose,
  customer,
  onSuccess,
}: AddInteractionModalProps) {
  const [formData, setFormData] = useState({
    Channel: 'Phone',
    Status: 'تم اعطاء وقت',
    Notes: '',
    PromiseAmount: '',
    NextFollowUpDate: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens/closes or customer changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        Channel: 'Phone',
        Status: 'تم اعطاء وقت',
        Notes: '',
        PromiseAmount: '',
        NextFollowUpDate: '',
      });
      setError('');
    }
  }, [isOpen, customer]);

  const handleChange = (field: string, value: string | number) => {
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
      if (!formData.Notes.trim()) {
        setError('الملاحظات مطلوبة');
        setIsSubmitting(false);
        return;
      }

      if (!customer || !customer.CustomerID) {
        setError('معرف العميل مطلوب');
        setIsSubmitting(false);
        return;
      }

      // Map Arabic status to English for backend
      const statusMapping: Record<string, string> = {
        'تم اعطاء وقت': 'Promised to Pay',
        'لا يوجد رد': 'No Answer',
        'تم الدفع': 'Resolved',
      };

      // Map channel names (In Shop -> Visit for backend compatibility)
      const channelMapping: Record<string, string> = {
        'In Shop': 'Visit',
      };

      // Helper function to convert date to ISO format (YYYY-MM-DD)
      // Input type="date" gives YYYY-MM-DD, which is already ISO format
      // But we need to ensure it's in the correct format for backend
      const formatDateToISO = (dateString: string): string | undefined => {
        if (!dateString || dateString.trim() === '') {
          return undefined;
        }
        
        const trimmed = dateString.trim();
        
        // If already in YYYY-MM-DD format (from input type="date"), return as is
        const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
        if (isoPattern.test(trimmed)) {
          return trimmed;
        }
        
        // If in DD-MM-YYYY format, convert to YYYY-MM-DD
        const ddMMyyyyPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
        const match = trimmed.match(ddMMyyyyPattern);
        if (match) {
          const [, day, month, year] = match;
          return `${year}-${month}-${day}`;
        }
        
        // If it's an ISO date string with time, extract just the date part
        try {
          const date = new Date(trimmed);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
        } catch (error) {
          console.warn('[AddInteractionModal] Error parsing date:', trimmed, error);
        }
        
        // Return original if can't parse
        return trimmed || undefined;
      };

      // Map Channel to ActionType
      const actionTypeMapping: Record<string, string> = {
        'Phone': 'Call',
        'WhatsApp': 'WhatsApp',
        'Visit': 'Visit',
        'In Shop': 'Visit',
        'Email': 'Email',
      };
      const actionType = actionTypeMapping[formData.Channel] || formData.Channel;

      // Map Status to Outcome
      const outcomeMapping: Record<string, string> = {
        'تم اعطاء وقت': 'Promised',
        'لا يوجد رد': 'No Answer',
        'تم الدفع': 'Resolved',
        'Promised to Pay': 'Promised',
        'No Answer': 'No Answer',
        'Resolved': 'Resolved',
      };
      const outcome = outcomeMapping[formData.Status] || formData.Status;

      // Convert NextFollowUpDate to ISO format for PromiseDate
      const promiseDate = formatDateToISO(formData.NextFollowUpDate);

      // Prepare activity data for CRM_Activity table
      const activityData = {
        CustomerID: customer.CustomerID || customer.id || customer.customerID || '',
        ActionType: actionType,
        Outcome: outcome,
        Notes: formData.Notes.trim(),
        PromiseDate: promiseDate, // ISO format (YYYY-MM-DD)
        PromiseAmount: formData.PromiseAmount ? parseFloat(String(formData.PromiseAmount)) : undefined,
      };

      console.log('[AddInteractionModal] Submitting activity to CRM_Activity:', activityData);
      console.log('[AddInteractionModal] Field mappings:', {
        Channel: formData.Channel,
        '-> ActionType': actionType,
        Status: formData.Status,
        '-> Outcome': outcome,
        NextFollowUpDate: formData.NextFollowUpDate,
        '-> PromiseDate': promiseDate,
      });

      await logActivity(activityData);

      // Success - close modal and refresh
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[AddInteractionModal] Error saving interaction:', err);
      setError(err?.message || 'فشل حفظ التفاعل. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const channelIcons = {
    Phone: Phone,
    WhatsApp: MessageSquare,
    Visit: MapPin,
    'In Shop': MapPin,
    Email: Mail,
  };

  const channelLabels: Record<string, string> = {
    Phone: 'اتصال هاتفي',
    WhatsApp: 'واتس اب',
    Visit: 'زيارة عند الزبون',
    'In Shop': 'في المحل',
    Email: 'بريد إلكتروني',
  };

  const statusOptions = [
    { value: 'تم اعطاء وقت', label: 'تم اعطاء وقت' },
    { value: 'لا يوجد رد', label: 'لا يوجد رد' },
    { value: 'تم الدفع', label: 'تم الدفع' },
  ];

  // Filter status options based on channel
  const availableStatusOptions = formData.Channel === 'WhatsApp' || formData.Channel === 'Phone'
    ? statusOptions
    : statusOptions.filter(opt => opt.value !== 'لا يوجد رد');

  const ChannelIcon = channelIcons[formData.Channel as keyof typeof channelIcons] || Phone;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-xl font-bold text-gray-900">إضافة تفاعل</h2>
              {customer && (
                <p className="text-sm text-gray-600 mt-1">
                  {customer.Name || customer.name || 'عميل'}
                </p>
              )}
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

            {/* Channel */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                قناة التواصل
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['Phone', 'WhatsApp', 'Visit', 'In Shop'] as const).map((channel) => {
                  const Icon = channelIcons[channel];
                  const label = channelLabels[channel] || channel;
                  return (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => {
                        handleChange('Channel', channel);
                        // Reset status if it's not available for new channel
                        if (channel !== 'WhatsApp' && channel !== 'Phone' && formData.Status === 'لا يوجد رد') {
                          handleChange('Status', 'تم اعطاء وقت');
                        }
                      }}
                      className={`flex flex-col items-center gap-2 px-3 py-3 border-2 rounded-lg transition-colors ${
                        formData.Channel === channel
                          ? 'border-gray-900 bg-gray-50 text-gray-900'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-xs font-medium text-center">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                الحالة
              </label>
              <select
                value={formData.Status}
                onChange={(e) => handleChange('Status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                required
              >
                {availableStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                الملاحظات <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.Notes}
                onChange={(e) => handleChange('Notes', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 resize-none"
                placeholder="أدخل ملاحظات التفاعل..."
                required
                dir="rtl"
              />
            </div>

            {/* Promise Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                المبلغ الموعود (اختياري)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.PromiseAmount}
                onChange={(e) => handleChange('PromiseAmount', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                placeholder="0.00"
              />
            </div>

            {/* Next Follow-up Date */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                تاريخ المتابعة القادمة
              </label>
              <input
                type="date"
                value={formData.NextFollowUpDate}
                onChange={(e) => handleChange('NextFollowUpDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
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
                    حفظ التفاعل
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

