'use client';

import { useState, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import CustomerSelect from '@/components/admin/CustomerSelect';
import PhoneActions from '@/components/admin/PhoneActions';
import { getDashboardData, logActivity, updatePTPStatus, getAllCustomers, deleteActivity, updateActivity, updateInstallmentStatus, updateInstallmentDate } from '@/lib/api';
import {
  Loader2,
  Phone,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Clock,
  X,
  MessageCircle,
  DollarSign,
  TrendingDown,
  Lock,
  Copy,
  MessageSquare,
  MapPin,
  Mail,
  Edit,
  Trash2,
  Save,
  Search,
} from 'lucide-react';



// Backend returns PascalCase keys from CRM_Activity table
interface Task {
  InteractionID: string; // Maps to ActivityID in CRM_Activity
  InstallmentID?: string; // Linked installment ID from crm_activities
  isInstallment?: boolean; // True if this task represents a raw promissory installment
  installmentId?: string; // The pure ID of the promissory installment if isInstallment=true
  CustomerID: string;
  CustomerName: string;
  Notes: string;
  PromiseAmount?: number;
  InstallmentAmount?: number;
  PaidAmount?: number;
  RemainingAmount?: number;
  NextDate: string; // PromiseDate from CRM_Activity (ISO format or DD-MM-YYYY)
  Type: 'Overdue' | 'Today' | 'Upcoming';
  [key: string]: any;
}

export default function TasksPage() {
  const router = useRouter();
  const { admin } = useAdminAuth();
  const currentAdminId = admin?.id || undefined;
  const [activeTab, setActiveTab] = useState<'overdue' | 'today' | 'upcoming'>('overdue');
  const [tasks, setTasks] = useState<{
    overdue: Task[];
    today: Task[];
    upcoming: Task[];
  }>({
    overdue: [],
    today: [],
    upcoming: [],
  });

  useLayoutEffect(() => {
    document.title = 'المهام والمتابعات';
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [rescheduleModal, setRescheduleModal] = useState<{
    isOpen: boolean;
    task: Task | null;
  }>({
    isOpen: false,
    task: null,
  });
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleNote, setRescheduleNote] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });
  const [copyModal, setCopyModal] = useState<{
    isOpen: boolean;
    task: Task | null;
  }>({
    isOpen: false,
    task: null,
  });
  const [copyForm, setCopyForm] = useState({
    customerID: '',
    date: '',
    note: '',
    channel: 'Phone',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [allCustomers, setAllCustomers] = useState<any[]>([]);

  // Check if user has permission to view tasks
  const canViewTasks = admin?.is_super_admin || admin?.permissions?.viewTasks === true;

  useEffect(() => {
    document.title = 'المهام والمتابعات - Tasks';
  }, []);

  useEffect(() => {
    loadTasks();
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const customers = await getAllCustomers();
      setAllCustomers(customers || []);
    } catch (error) {
      console.error('[TasksPage] Failed to load customers:', error);
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[TasksPage] Loading tasks from dashboard...');
      const data = await getDashboardData();
      console.log('[TasksPage] RAW API DATA:', JSON.stringify(data, null, 2));

      // Normalize data structure - backend returns overdue, today, upcoming arrays
      let overdue: Task[] = [];
      let today: Task[] = [];
      let upcoming: Task[] = [];

      if (data && (data.overdue || data.today || data.upcoming)) {
        overdue = Array.isArray(data.overdue) ? data.overdue : [];
        today = Array.isArray(data.today) ? data.today : [];
        upcoming = Array.isArray(data.upcoming) ? data.upcoming : [];
      } else if (Array.isArray(data)) {
        // If backend returns a direct array, categorize by Type
        overdue = data.filter((item: any) => item.Type === 'Overdue');
        today = data.filter((item: any) => item.Type === 'Today');
        upcoming = data.filter((item: any) => item.Type === 'Upcoming');
      } else {
        console.warn('[TasksPage] Unexpected data format received:', data);
        setError('Invalid data format received from server. Please check API response.');
      }

      console.log('[TasksPage] Tasks loaded:', {
        overdue: overdue.length,
        today: today.length,
        upcoming: upcoming.length,
      });

      // Log sample items to verify structure
      if (overdue.length > 0) {
        console.log('[TasksPage] Sample overdue task:', overdue[0]);
        console.log('[TasksPage] Overdue task keys:', Object.keys(overdue[0]));
      }
      if (today.length > 0) {
        console.log('[TasksPage] Sample today task:', today[0]);
        console.log('[TasksPage] Today task keys:', Object.keys(today[0]));
      }
      if (upcoming.length > 0) {
        console.log('[TasksPage] Sample upcoming task:', upcoming[0]);
        console.log('[TasksPage] Upcoming task keys:', Object.keys(upcoming[0]));
      }

      setTasks({
        overdue,
        today,
        upcoming,
      });
    } catch (error: any) {
      console.error('[TasksPage] Error loading tasks:', error);
      let errorMessage = 'فشل تحميل البيانات.';
      if (error?.message) {
        errorMessage = error.message;
      }
      setError(errorMessage);
      setTasks({ overdue: [], today: [], upcoming: [] });
    } finally {
      setLoading(false);
    }
  };

  // Format currency (ILS with English numbers)
  const formatCurrency = (amount: number | undefined | null): string => {
    if (!amount || amount === 0) return '₪0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Format date to DD-MM-YYYY
  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return '—';
    try {
      // Handle DD-MM-YYYY format
      const ddMMyyyyMatch = dateString.match(/^(\d{2})-(\d{2})-(\d{4})/);
      if (ddMMyyyyMatch) {
        return dateString; // Already in DD-MM-YYYY format
      }

      // Handle YYYY-MM-DD format
      const yyyyMMddMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (yyyyMMddMatch) {
        const [, year, month, day] = yyyyMMddMatch;
        return `${day}-${month}-${year}`;
      }

      // Try to parse as Date
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
      }

      return '—';
    } catch {
      return '—';
    }
  };

  // Convert date to YYYY-MM-DD for API
  const formatDateToYYYYMMDD = (dateString: string): string => {
    if (!dateString) return '';

    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
      return dateString.split('T')[0];
    }

    // If in DD-MM-YYYY format, convert to YYYY-MM-DD
    const ddMMyyyyMatch = dateString.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (ddMMyyyyMatch) {
      const [, day, month, year] = ddMMyyyyMatch;
      return `${year}-${month}-${day}`;
    }

    // Try to parse as Date
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (error) {
      console.warn('[TasksPage] Error formatting date:', dateString, error);
    }

    return '';
  };

  // Show toast message
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: '', type: null });
    }, 3000); // Hide after 3 seconds
  };

  const handleDeleteTask = async (task: Task) => {
    if (!admin?.is_super_admin) return;
    if (!window.confirm('هل أنت متأكد من حذف هذا الموعد؟ لا يمكن التراجع عن هذه العملية.')) return;
    
    setUpdatingIds(prev => new Set(prev).add(task.InteractionID));
    try {
      await deleteActivity(task.InteractionID);
      showToast('تم حذف الموعد بنجاح', 'success');
      loadTasks(); // Refresh the list
    } catch (error: any) {
      console.error('[Tasks] Delete error:', error);
      showToast('فشل الحذف: ' + (error.message || 'خطأ غير معروف'), 'error');
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(task.InteractionID);
        return next;
      });
    }
  };

  // Handle Resolved/Paid button
  const handleResolved = async (task: Task) => {
    if (!task.InteractionID) {
      showToast('معرف المهمة غير متوفر', 'error');
      return;
    }

    setUpdatingIds((prev) => new Set(prev).add(task.InteractionID));
    try {
      if (task.isInstallment && task.installmentId) {
        // It's a pure raw installment row
        console.log('[TasksPage] Marking raw installment as Paid:', task.installmentId);
        await updateInstallmentStatus(task.installmentId, 'Paid');
      } else {
        // It's a standard CRM activity task
        console.log('[TasksPage] Marking task as resolved:', task.InteractionID);
        await updatePTPStatus(task.InteractionID, 'Fulfilled', currentAdminId);

        // If linked to an installment, mark the installment as Paid
        if (task.InstallmentID) {
          console.log('[TasksPage] Marking linked installment as Paid:', task.InstallmentID);
          try {
            await updateInstallmentStatus(task.InstallmentID, 'Paid');
          } catch (instError) {
            console.error('[TasksPage] Error updating installment:', instError);
          }
        }
      }

      // Optimistically remove from list
      setTasks((prev) => ({
        overdue: prev.overdue.filter((t) => t.InteractionID !== task.InteractionID),
        today: prev.today.filter((t) => t.InteractionID !== task.InteractionID),
        upcoming: prev.upcoming.filter((t) => t.InteractionID !== task.InteractionID),
      }));

      showToast('تم تحديث الحالة بنجاح', 'success');
    } catch (error: any) {
      console.error('[TasksPage] Error updating status:', error);
      showToast(`فشل تحديث الحالة: ${error?.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.InteractionID);
        return next;
      });
    }
  };

  // Handle No Answer button
  const handleNoAnswer = async (task: Task) => {
    if (!task.CustomerID) {
      showToast('معرف العميل غير متوفر', 'error');
      return;
    }

    setUpdatingIds((prev) => new Set(prev).add(task.InteractionID));
    try {
      // Calculate date after 2 days from today (using local timezone)
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset to start of day
      const twoDaysLater = new Date(today);
      twoDaysLater.setDate(twoDaysLater.getDate() + 2);
      // Format as YYYY-MM-DD (local date, not UTC)
      const year = twoDaysLater.getFullYear();
      const month = String(twoDaysLater.getMonth() + 1).padStart(2, '0');
      const day = String(twoDaysLater.getDate()).padStart(2, '0');
      const twoDaysLaterStr = `${year}-${month}-${day}`;

      // الحفاظ على المبلغ الأصلي من الموعد القديم
      const originalAmount = task.PromiseAmount
        ? parseFloat(String(task.PromiseAmount))
        : 0;

      console.log('[TasksPage] Logging No Answer for 2 days later:', {
        today: today.toISOString().split('T')[0],
        twoDaysLater: twoDaysLaterStr,
        customerID: task.CustomerID,
        originalAmount: originalAmount
      });

      // First, hide the old appointment by updating its status
      // We DO NOT archive actual promissory note installments, only CRM activities
      if (task.InteractionID && !task.isInstallment) {
        try {
          await updatePTPStatus(task.InteractionID, 'Archived', currentAdminId);
          console.log('[TasksPage] Old appointment archived successfully');
        } catch (archiveError) {
          console.warn('[TasksPage] Could not archive old appointment:', archiveError);
          // Continue anyway - create new appointment
        }
      }

      // Create new appointment for 2 days later with original amount
      if (task.isInstallment && task.installmentId) {
        // Because this is an installment, update its actual due date
        await updateInstallmentDate(task.installmentId, twoDaysLaterStr);
        // And optionally log a CRM note that it was delayed due to no answer
        await logActivity({
          CustomerID: task.CustomerID,
          ActionType: 'Call',
          Outcome: 'No Answer',
          Notes: `تم تأجيل الكمبيالة تلقائياً بسبب عدم الرد (إلى تاريخ ${twoDaysLaterStr})`,
          // Omit PromiseDate/Amount to prevent duplicate CRM follow-up task
          InstallmentID: task.installmentId,
          created_by: currentAdminId,
        });
        console.log('[TasksPage] Installment due date updated successfully');
      } else {
        await logActivity({
          CustomerID: task.CustomerID,
          ActionType: 'Call',
          Outcome: 'No Answer',
          Notes: 'لم يجب',
          PromiseDate: twoDaysLaterStr, // Schedule for 2 days later
          PromiseAmount: originalAmount, // الحفاظ على المبلغ الأصلي
          InstallmentID: task.InstallmentID,
          created_by: currentAdminId,
        });
      }

      showToast('تم تسجيل الإجراء بنجاح', 'success');
      await loadTasks(); // Refresh data
    } catch (error: any) {
      console.error('[TasksPage] Error logging No Answer:', error);
      showToast(`فشل تسجيل الإجراء: ${error?.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.InteractionID);
        return next;
      });
    }
  };

  // Handle Reschedule button
  const handleRescheduleClick = (task: Task) => {
    setRescheduleModal({ isOpen: true, task });
    // Set default date to 1 week from today
    const oneWeekLater = new Date();
    oneWeekLater.setDate(oneWeekLater.getDate() + 7);
    const oneWeekLaterStr = oneWeekLater.toISOString().split('T')[0];
    setRescheduleDate(oneWeekLaterStr);
    setRescheduleNote('');
  };

  // Handle Reschedule submit
  const handleRescheduleSubmit = async () => {
    if (!rescheduleModal.task || !rescheduleDate) {
      showToast('يرجى إدخال التاريخ', 'error');
      return;
    }

    setUpdatingIds((prev) => new Set(prev).add(rescheduleModal.task!.InteractionID));
    try {
      const formattedDate = formatDateToYYYYMMDD(rescheduleDate);
      // الحفاظ على المبلغ الأصلي من المهمة القديمة
      const originalAmount = rescheduleModal.task.PromiseAmount
        ? parseFloat(String(rescheduleModal.task.PromiseAmount))
        : 0;

      console.log('[TasksPage] Rescheduling task:', {
        taskId: rescheduleModal.task.InteractionID,
        date: formattedDate,
        originalAmount: originalAmount,
        customerID: rescheduleModal.task.CustomerID
      });

      // أولاً، إخفاء الموعد القديم بتحديث حالته إلى Archived
      if (rescheduleModal.task.InteractionID && !rescheduleModal.task.isInstallment) {
        try {
          await updatePTPStatus(rescheduleModal.task.InteractionID, 'Archived', currentAdminId);
          console.log('[TasksPage] Old appointment archived successfully');
        } catch (archiveError) {
          console.warn('[TasksPage] Could not archive old appointment:', archiveError);
          // Continue anyway - create new appointment
        }
      }

      // إنشاء الموعد الجديد
      if (rescheduleModal.task.isInstallment && rescheduleModal.task.installmentId) {
        // Because this is an installment, update its actual due date
        await updateInstallmentDate(rescheduleModal.task.installmentId, formattedDate);
        // And log a CRM note that it was rescheduled
        await logActivity({
          CustomerID: rescheduleModal.task.CustomerID,
          ActionType: 'Call',
          Outcome: 'Rescheduled', // Change outcome to not trigger open promise state specifically
          Notes: (rescheduleNote || 'تمت إعادة جدولة استحقاق الكمبيالة بطلب الزبون') + ` (إلى تاريخ ${formattedDate})`,
          // Omit PromiseDate/Amount to prevent duplicate CRM follow-up task
          InstallmentID: rescheduleModal.task.installmentId,
          created_by: currentAdminId,
        });
        console.log('[TasksPage] Installment due date updated to', formattedDate);
      } else {
        await logActivity({
          CustomerID: rescheduleModal.task.CustomerID,
          ActionType: 'Call',
          Outcome: 'Promised',
          Notes: rescheduleNote || 'تم إعادة الجدولة',
          PromiseDate: formattedDate,
          PromiseAmount: originalAmount, // استخدام المبلغ الأصلي
          InstallmentID: rescheduleModal.task.InstallmentID,
          created_by: currentAdminId,
        });
      }

      showToast('تم إعادة الجدولة بنجاح', 'success');
      setRescheduleModal({ isOpen: false, task: null });
      setRescheduleDate('');
      setRescheduleNote('');
      await loadTasks(); // Refresh data
    } catch (error: any) {
      console.error('[TasksPage] Error rescheduling:', error);
      showToast(`فشل إعادة الجدولة: ${error?.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(rescheduleModal.task!.InteractionID);
        return next;
      });
    }
  };

  // Handle Copy Interaction button
  const handleCopyClick = (task: Task) => {
    setCopyModal({ isOpen: true, task });
    // Set default values from the original task
    const oneWeekLater = new Date();
    oneWeekLater.setDate(oneWeekLater.getDate() + 7);
    const oneWeekLaterStr = oneWeekLater.toISOString().split('T')[0];
    setCopyForm({
      customerID: task.CustomerID, // Default to same customer
      date: oneWeekLaterStr,
      note: task.Notes || '',
      channel: 'Phone',
    });
  };

  // Handle Copy submit
  const handleCopySubmit = async () => {
    if (!copyModal.task || !copyForm.customerID || !copyForm.date) {
      showToast('يرجى إدخال جميع الحقول المطلوبة', 'error');
      return;
    }

    setUpdatingIds((prev) => new Set(prev).add(copyModal.task!.InteractionID));
    try {
      const formattedDate = formatDateToYYYYMMDD(copyForm.date);
      // الحفاظ على المبلغ الأصلي من المهمة القديمة
      const originalAmount = copyModal.task.PromiseAmount
        ? parseFloat(String(copyModal.task.PromiseAmount))
        : 0;

      // Map channel to ActionType
      const channelMapping: Record<string, string> = {
        'Phone': 'Call',
        'WhatsApp': 'WhatsApp',
        'Visit': 'Visit',
        'Email': 'Email',
      };
      const actionType = channelMapping[copyForm.channel] || 'Call';

      console.log('[TasksPage] Copying interaction:', {
        originalTaskId: copyModal.task.InteractionID,
        newCustomerID: copyForm.customerID,
        date: formattedDate,
        originalAmount: originalAmount,
        channel: actionType
      });

      // إنشاء التفاعل الجديد (بدون إخفاء القديم)
      await logActivity({
        CustomerID: copyForm.customerID,
        ActionType: actionType,
        Outcome: 'Promised',
        Notes: copyForm.note || 'تم نسخ التفاعل',
        PromiseDate: formattedDate,
        PromiseAmount: originalAmount,
        InstallmentID: copyModal.task!.isInstallment ? copyModal.task!.installmentId : copyModal.task!.InstallmentID,
        created_by: currentAdminId,
      });

      showToast('تم نسخ التفاعل بنجاح', 'success');
      setCopyModal({ isOpen: false, task: null });
      setCopyForm({
        customerID: '',
        date: '',
        note: '',
        channel: 'Phone',
      });
      await loadTasks(); // Refresh data
    } catch (error: any) {
      console.error('[TasksPage] Error copying interaction:', error);
      showToast(`فشل نسخ التفاعل: ${error?.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(copyModal.task!.InteractionID);
        return next;
      });
    }
  };

  const normalizeSearchText = (value: string) =>
    value
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const filteredTasks = (tasks[activeTab] || []).filter(task => {
    if (!searchQuery.trim()) return true;

    const searchWords = normalizeSearchText(searchQuery)
      .split(/\s+/)
      .filter(word => word.length > 0);

    const customerPhoneRaw =
      task.CustomerPhone ||
      task.Customerphone ||
      allCustomers.find((c) => (c.CustomerID || c.id) === task.CustomerID)?.Phone ||
      allCustomers.find((c) => (c.CustomerID || c.id) === task.CustomerID)?.phone ||
      '';

    const searchableText = normalizeSearchText(
      `${task.CustomerName || ''} ${customerPhoneRaw}`
    );

    return searchWords.every(word => searchableText.includes(word));
  });

  // Check permissions
  if (!canViewTasks) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Lock size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-lg mb-2 font-cairo">ليس لديك صلاحية لعرض المهام اليومية</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-cairo">يرجى التواصل مع المشرف للحصول على الصلاحية</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 font-cairo">جاري التحميل...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400 text-lg mb-4 font-cairo">{error}</p>
            <button
              onClick={loadTasks}
              className="px-4 py-2 bg-gray-900 dark:bg-slate-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-slate-600 transition-colors font-cairo"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Toast Notification */}
      {toast.message && (
        <div
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 font-cairo transition-all duration-300 ${toast.type === 'success'
            ? 'bg-green-500 text-white'
            : 'bg-red-500 text-white'
            }`}
          style={{ animation: 'slideDown 0.3s ease-out' }}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => setToast({ message: '', type: null })}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="space-y-6 font-cairo" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">المهام والمتابعات</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">إدارة متابعة الذمم والتحصيل من العملاء</p>
          </div>
          <button
            onClick={loadTasks}
            className="px-4 py-2 bg-gray-900 dark:bg-slate-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-slate-600 transition-colors font-medium flex items-center gap-2"
          >
            <Clock size={20} />
            تحديث
          </button>
        </div>

        {/* Search Banner */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
          <div className="relative">
            <Search
              size={20}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
            />
            <input
              type="text"
              placeholder="بحث عن اسم الزبون أو رقم الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all text-sm font-cairo"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl mb-6">
          <button
            onClick={() => setActiveTab('overdue')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'overdue'
                ? 'bg-white dark:bg-slate-700 text-red-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <AlertCircle size={18} />
            متأخرة ({tasks.overdue.length})
          </button>
          <button
            onClick={() => setActiveTab('today')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'today'
                ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Calendar size={18} />
            اليوم ({tasks.today.length})
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'upcoming'
                ? 'bg-white dark:bg-slate-700 text-green-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Clock size={18} />
            قادمة ({tasks.upcoming.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-4 max-h-[700px] overflow-y-auto pb-10 pr-2">
          {filteredTasks.length === 0 ? (
            <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg p-16 text-center">
              <CheckCircle2 size={64} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg font-bold">
                {searchQuery ? 'لا توجد مهام مطابقة للبحث' : 'لا توجد مهام في هذا القسم'}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const customerPhone = task.CustomerPhone || task.Customerphone || 
                allCustomers.find((c) => (c.CustomerID || c.id) === task.CustomerID)?.Phone || 
                allCustomers.find((c) => (c.CustomerID || c.id) === task.CustomerID)?.phone || '';
              
              const isOverdue = activeTab === 'overdue';
              const isToday = activeTab === 'today';
              
              const themeColorClasses = {
                badge: isOverdue ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                       isToday ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 
                                 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                btn: isOverdue ? 'bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400' :
                     isToday ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400' :
                               'bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 text-green-700 dark:text-green-400',
                border: isOverdue ? 'border-r-red-400' : isToday ? 'border-r-blue-400' : 'border-r-green-400',
              };

              return (
                <div
                  key={task.InteractionID}
                  className={`bg-white dark:bg-slate-800 rounded-xl border-r-4 ${themeColorClasses.border} border-t border-b border-l border-gray-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                    {/* Customer Info Column */}
                    <div className="flex-1 w-full md:w-1/4">
                      <a
                        href={`/admin/customers/${task.CustomerID}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors block mb-1 truncate"
                      >
                        {task.CustomerName}
                      </a>
                      {customerPhone && (
                        <div className="mb-2 w-max max-w-full">
                           <PhoneActions phone={customerPhone} />
                        </div>
                      )}
                    </div>
                    
                    {/* Task Info Column */}
                    <div className="flex-2 w-full md:w-2/4 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold leading-none ${themeColorClasses.badge}`}>
                          <Calendar size={12} className="ml-1" />
                          {formatDate(task.NextDate)}
                        </span>
                        
                        {(task.PromiseAmount || 0) > 0 && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold leading-none bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-300">
                            <DollarSign size={12} className="ml-1" />
                            {formatCurrency(task.PromiseAmount)}
                          </span>
                        )}

                      {task.isInstallment && typeof task.RemainingAmount === 'number' && typeof task.PaidAmount === 'number' && task.PaidAmount > 0 && task.RemainingAmount > 0 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold leading-none bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                          متبقي القسط: {formatCurrency(task.RemainingAmount)}
                        </span>
                      )}

                        {task.InstallmentID && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold leading-none bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            قسط مرتبط
                          </span>
                        )}
                        
                        {task.isInstallment && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold leading-none bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                            قسط مباشر
                          </span>
                        )}
                      </div>
                      
                      {task.Notes && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 border-r-2 border-gray-200 dark:border-gray-600 pr-3 my-1 overflow-hidden text-ellipsis md:line-clamp-2">
                          {task.Notes}
                        </p>
                      )}
                      
                      {(task.CreatedByUsername || task.UpdatedByUsername) && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {task.CreatedByUsername && <span>أنشأه: {task.CreatedByUsername}</span>}
                          {task.CreatedByUsername && task.UpdatedByUsername && ' · '}
                          {task.UpdatedByUsername && <span>آخر تحديث: {task.UpdatedByUsername}</span>}
                        </p>
                      )}
                    </div>

                    {/* Actions Column */}
                    <div className="flex gap-2 w-full md:w-1/4 mt-4 md:mt-0 flex-wrap justify-end">
                      <button
                        onClick={() => handleResolved(task)}
                        disabled={updatingIds.has(task.InteractionID)}
                        className={`flex-1 md:flex-none px-4 py-2 ${themeColorClasses.btn} rounded-lg transition-colors text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5`}
                      >
                        {updatingIds.has(task.InteractionID) ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                        تم الدفع
                      </button>
                      <button
                        onClick={() => handleNoAnswer(task)}
                        disabled={updatingIds.has(task.InteractionID)}
                        className="flex-1 md:flex-none px-4 py-2 bg-gray-100 dark:bg-slate-700/80 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        {updatingIds.has(task.InteractionID) ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Phone size={16} />
                        )}
                        <span className="hidden sm:inline">لم يجب</span>
                      </button>
                      <button
                        onClick={() => handleRescheduleClick(task)}
                        disabled={updatingIds.has(task.InteractionID)}
                        className="flex-1 md:flex-none px-4 py-2 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm bg-white dark:bg-slate-800"
                      >
                        <Calendar size={16} />
                        <span className="hidden sm:inline">تأجيل</span>
                      </button>
                         <button
                           onClick={() => handleCopyClick(task)}
                           disabled={updatingIds.has(task.InteractionID)}
                           className="flex-none p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center border border-transparent hover:border-purple-200 dark:hover:border-purple-800"
                           title="نسخ تفاعل"
                         >
                           <Copy size={16} />
                         </button>
                         {admin?.is_super_admin && !task.isInstallment && (
                           <button
                             onClick={() => handleDeleteTask(task)}
                             disabled={updatingIds.has(task.InteractionID)}
                             className="flex-none p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center border border-transparent hover:border-red-200 dark:hover:border-red-800"
                             title="حذف الموعد"
                           >
                             <Trash2 size={16} />
                           </button>
                         )}
                       </div>
                    </div>
                  </div>
              );
            })
          )}
        </div>
      </div>

      {/* Reschedule Modal */}
      {rescheduleModal.isOpen && rescheduleModal.task && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          dir="rtl"
          onClick={(e) => {
            // Close modal when clicking on backdrop
            if (e.target === e.currentTarget) {
              setRescheduleModal({ isOpen: false, task: null });
              setRescheduleDate('');
              setRescheduleNote('');
            }
          }}
          style={{ backdropFilter: 'blur(2px)' }}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
            style={{ fontFamily: 'Cairo, Arial, sans-serif' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">إعادة جدولة</h3>
              <button
                onClick={() => {
                  setRescheduleModal({ isOpen: false, task: null });
                  setRescheduleDate('');
                  setRescheduleNote('');
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  تاريخ السداد الجديد <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ملاحظات
                </label>
                <textarea
                  value={rescheduleNote}
                  onChange={(e) => setRescheduleNote(e.target.value)}
                  placeholder="أضف ملاحظات حول إعادة الجدولة..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setRescheduleModal({ isOpen: false, task: null });
                  setRescheduleDate('');
                  setRescheduleNote('');
                }}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-medium"
              >
                إلغاء
              </button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={!rescheduleDate || updatingIds.has(rescheduleModal.task!.InteractionID)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {updatingIds.has(rescheduleModal.task!.InteractionID) ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    حفظ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Interaction Modal */}
      {copyModal.isOpen && copyModal.task && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          dir="rtl"
          onClick={(e) => {
            // Close modal when clicking on backdrop
            if (e.target === e.currentTarget) {
              setCopyModal({ isOpen: false, task: null });
              setCopyForm({
                customerID: '',
                date: '',
                note: '',
                channel: 'Phone',
              });
            }
          }}
          style={{ backdropFilter: 'blur(2px)' }}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto"
            style={{ fontFamily: 'Cairo, Arial, sans-serif' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">نسخ تفاعل</h3>
              <button
                onClick={() => {
                  setCopyModal({ isOpen: false, task: null });
                  setCopyForm({
                    customerID: '',
                    date: '',
                    note: '',
                    channel: 'Phone',
                  });
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Customer Selection */}
              <CustomerSelect
                value={copyForm.customerID}
                onChange={(customerID) => setCopyForm({ ...copyForm, customerID })}
                customers={allCustomers}
                placeholder="اختر العميل"
                required
              />

              {/* Channel Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  طريقة التواصل <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { value: 'Phone', label: 'اتصال هاتفي', icon: Phone },
                    { value: 'WhatsApp', label: 'واتس اب', icon: MessageSquare },
                    { value: 'Visit', label: 'زيارة', icon: MapPin },
                    { value: 'Email', label: 'بريد إلكتروني', icon: Mail },
                  ] as const).map((channel) => {
                    const Icon = channel.icon;
                    return (
                      <button
                        key={channel.value}
                        type="button"
                        onClick={() => setCopyForm({ ...copyForm, channel: channel.value })}
                        className={`flex flex-col items-center gap-2 px-3 py-3 border-2 rounded-lg transition-colors ${copyForm.channel === channel.value
                          ? 'border-gray-900 bg-gray-50 dark:bg-slate-800/50 text-gray-900 dark:text-gray-100'
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 text-gray-600 dark:text-gray-400'
                          }`}
                      >
                        <Icon size={20} />
                        <span className="text-xs font-medium text-center">{channel.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  تاريخ الموعد <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={copyForm.date}
                  onChange={(e) => setCopyForm({ ...copyForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ملاحظات
                </label>
                <textarea
                  value={copyForm.note}
                  onChange={(e) => setCopyForm({ ...copyForm, note: e.target.value })}
                  placeholder="أضف ملاحظات..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setCopyModal({ isOpen: false, task: null });
                  setCopyForm({
                    customerID: '',
                    date: '',
                    note: '',
                    channel: 'Phone',
                  });
                }}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-medium"
              >
                إلغاء
              </button>
              <button
                onClick={handleCopySubmit}
                disabled={!copyForm.customerID || !copyForm.date || updatingIds.has(copyModal.task!.InteractionID)}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {updatingIds.has(copyModal.task!.InteractionID) ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    نسخ التفاعل
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
