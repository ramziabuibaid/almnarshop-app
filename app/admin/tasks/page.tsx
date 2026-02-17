'use client';

import { useState, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import CustomerSelect from '@/components/admin/CustomerSelect';
import PhoneActions from '@/components/admin/PhoneActions';
import { getDashboardData, logActivity, updatePTPStatus, getAllCustomers, deleteActivity, updateActivity } from '@/lib/api';
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
} from 'lucide-react';



// Backend returns PascalCase keys from CRM_Activity table
interface Task {
  InteractionID: string; // Maps to ActivityID in CRM_Activity
  CustomerID: string;
  CustomerName: string;
  Notes: string;
  PromiseAmount?: number;
  NextDate: string; // PromiseDate from CRM_Activity (ISO format or DD-MM-YYYY)
  Type: 'Overdue' | 'Today' | 'Upcoming';
  [key: string]: any;
}

export default function TasksPage() {
  const router = useRouter();
  const { admin } = useAdminAuth();
  const currentAdminId = admin?.id || undefined;
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

  // Handle Resolved/Paid button
  const handleResolved = async (task: Task) => {
    if (!task.InteractionID) {
      showToast('معرف المهمة غير متوفر', 'error');
      return;
    }

    setUpdatingIds((prev) => new Set(prev).add(task.InteractionID));
    try {
      console.log('[TasksPage] Marking task as resolved:', task.InteractionID);
      await updatePTPStatus(task.InteractionID, 'Fulfilled', currentAdminId);

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
      if (task.InteractionID) {
        try {
          await updatePTPStatus(task.InteractionID, 'Archived', currentAdminId);
          console.log('[TasksPage] Old appointment archived successfully');
        } catch (archiveError) {
          console.warn('[TasksPage] Could not archive old appointment:', archiveError);
          // Continue anyway - create new appointment
        }
      }

      // Create new appointment for 2 days later with original amount
      await logActivity({
        CustomerID: task.CustomerID,
        ActionType: 'Call',
        Outcome: 'No Answer',
        Notes: 'لم يجب',
        PromiseDate: twoDaysLaterStr, // Schedule for 2 days later
        PromiseAmount: originalAmount, // الحفاظ على المبلغ الأصلي
        created_by: currentAdminId,
      });

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
      if (rescheduleModal.task.InteractionID) {
        try {
          await updatePTPStatus(rescheduleModal.task.InteractionID, 'Archived', currentAdminId);
          console.log('[TasksPage] Old appointment archived successfully');
        } catch (archiveError) {
          console.warn('[TasksPage] Could not archive old appointment:', archiveError);
          // Continue anyway - create new appointment
        }
      }

      // إنشاء الموعد الجديد
      await logActivity({
        CustomerID: rescheduleModal.task.CustomerID,
        ActionType: 'Call',
        Outcome: 'Promised',
        Notes: rescheduleNote || 'تم إعادة الجدولة',
        PromiseDate: formattedDate,
        PromiseAmount: originalAmount, // استخدام المبلغ الأصلي
        created_by: currentAdminId,
      });

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

  // Calculate statistics
  const statistics = {
    brokenPromises: tasks.overdue.length,
    expectedToday: tasks.today.reduce((sum, t) => sum + (t.PromiseAmount || 0), 0),
    totalDebt: 0, // This would need to come from a separate API call
  };

  // Check permissions
  if (!canViewTasks) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Lock size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2 font-cairo">ليس لديك صلاحية لعرض المهام اليومية</p>
            <p className="text-gray-500 text-sm font-cairo">يرجى التواصل مع المشرف للحصول على الصلاحية</p>
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
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-cairo">جاري التحميل...</p>
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
            <p className="text-red-600 text-lg mb-4 font-cairo">{error}</p>
            <button
              onClick={loadTasks}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo"
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
            <h1 className="text-3xl font-bold text-gray-900">المهام والمتابعات</h1>
            <p className="text-gray-600 mt-1">إدارة متابعة الذمم والتحصيل من العملاء</p>
          </div>
          <button
            onClick={loadTasks}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium flex items-center gap-2"
          >
            <Clock size={20} />
            تحديث
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Broken Promises */}
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600 mb-1">وعود مكسورة</p>
                <p className="text-3xl font-bold text-red-700">{statistics.brokenPromises}</p>
              </div>
              <AlertCircle size={40} className="text-red-400" />
            </div>
          </div>

          {/* Expected Today */}
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 mb-1">المتوقع تحصيله اليوم</p>
                <p className="text-3xl font-bold text-blue-700">{formatCurrency(statistics.expectedToday)}</p>
              </div>
              <DollarSign size={40} className="text-blue-400" />
            </div>
          </div>

          {/* Total Tasks */}
          <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">إجمالي المهام</p>
                <p className="text-3xl font-bold text-gray-700">
                  {tasks.overdue.length + tasks.today.length + tasks.upcoming.length}
                </p>
              </div>
              <TrendingDown size={40} className="text-gray-400" />
            </div>
          </div>
        </div>

        {/* Kanban Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Overdue */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle size={24} className="text-red-600" />
              <h2 className="text-xl font-bold text-gray-900">وعود فائتة/متأخرة</h2>
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                {tasks.overdue.length}
              </span>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {tasks.overdue.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                  <CheckCircle2 size={48} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">لا توجد وعود فائتة</p>
                </div>
              ) : (
                tasks.overdue.map((task) => {
                  const customerPhone = task.CustomerPhone || task.Customerphone || allCustomers.find((c) => (c.CustomerID || c.id) === task.CustomerID)?.Phone || allCustomers.find((c) => (c.CustomerID || c.id) === task.CustomerID)?.phone || '';
                  return (
                    <div
                      key={task.InteractionID}
                      className="bg-white rounded-lg border-2 border-red-400 p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <a
                        href={`/admin/customers/${task.CustomerID}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-bold text-gray-900 mb-1 hover:text-blue-600 hover:underline transition-colors text-right w-full block"
                      >
                        {task.CustomerName}
                      </a>
                      {customerPhone && (
                        <div className="mb-2">
                          <PhoneActions phone={customerPhone} />
                        </div>
                      )}
                      {task.PromiseAmount && (
                        <p className="text-sm font-semibold text-red-600 mb-1">
                          المبلغ: {formatCurrency(task.PromiseAmount)}
                        </p>
                      )}
                      <p className="text-xs text-red-500 mb-2">تاريخ فائت: {formatDate(task.NextDate)}</p>
                      {task.Notes && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.Notes}</p>
                      )}
                      {(task.CreatedByUsername || task.UpdatedByUsername) && (
                        <p className="text-xs text-gray-500 mb-2">
                          {task.CreatedByUsername && <span>أنشأه: {task.CreatedByUsername}</span>}
                          {task.CreatedByUsername && task.UpdatedByUsername && ' · '}
                          {task.UpdatedByUsername && <span>آخر تحديث: {task.UpdatedByUsername}</span>}
                        </p>
                      )}
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <button
                          onClick={() => handleResolved(task)}
                          disabled={updatingIds.has(task.InteractionID)}
                          className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1 min-w-[100px]"
                        >
                          {updatingIds.has(task.InteractionID) ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          تم الدفع
                        </button>
                        <button
                          onClick={() => handleNoAnswer(task)}
                          disabled={updatingIds.has(task.InteractionID)}
                          className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1 min-w-[100px]"
                        >
                          {updatingIds.has(task.InteractionID) ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Phone size={14} />
                          )}
                          لم يجب
                        </button>
                        <button
                          onClick={() => handleRescheduleClick(task)}
                          disabled={updatingIds.has(task.InteractionID)}
                          className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1 min-w-[100px]"
                        >
                          <Calendar size={14} />
                          إعادة جدولة
                        </button>
                        <button
                          onClick={() => handleCopyClick(task)}
                          disabled={updatingIds.has(task.InteractionID)}
                          className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1 min-w-[100px]"
                        >
                          <Copy size={14} />
                          نسخ تفاعل
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Today */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={24} className="text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">وعود اليوم</h2>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                {tasks.today.length}
              </span>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {tasks.today.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                  <CheckCircle2 size={48} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">لا توجد مهام اليوم</p>
                </div>
              ) : (
                tasks.today.map((task) => {
                  const customerPhone = task.CustomerPhone || task.Customerphone || allCustomers.find((c) => (c.CustomerID || c.id) === task.CustomerID)?.Phone || allCustomers.find((c) => (c.CustomerID || c.id) === task.CustomerID)?.phone || '';
                  return (
                    <div
                      key={task.InteractionID}
                      className="bg-white rounded-lg border-2 border-blue-200 p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <a
                        href={`/admin/customers/${task.CustomerID}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-bold text-gray-900 mb-1 hover:text-blue-600 hover:underline transition-colors text-right w-full block"
                      >
                        {task.CustomerName}
                      </a>
                      {customerPhone && (
                        <div className="mb-2">
                          <PhoneActions phone={customerPhone} />
                        </div>
                      )}
                      {task.PromiseAmount && (
                        <p className="text-sm font-semibold text-blue-600 mb-1">
                          المبلغ: {formatCurrency(task.PromiseAmount)}
                        </p>
                      )}
                      <p className="text-xs text-blue-500 mb-2">تاريخ: {formatDate(task.NextDate)}</p>
                      {task.Notes && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.Notes}</p>
                      )}
                      {(task.CreatedByUsername || task.UpdatedByUsername) && (
                        <p className="text-xs text-gray-500 mb-2">
                          {task.CreatedByUsername && <span>أنشأه: {task.CreatedByUsername}</span>}
                          {task.CreatedByUsername && task.UpdatedByUsername && ' · '}
                          {task.UpdatedByUsername && <span>آخر تحديث: {task.UpdatedByUsername}</span>}
                        </p>
                      )}
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <button
                          onClick={() => handleResolved(task)}
                          disabled={updatingIds.has(task.InteractionID)}
                          className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1 min-w-[100px]"
                        >
                          {updatingIds.has(task.InteractionID) ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          تم الدفع
                        </button>
                        <button
                          onClick={() => handleNoAnswer(task)}
                          disabled={updatingIds.has(task.InteractionID)}
                          className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1 min-w-[100px]"
                        >
                          {updatingIds.has(task.InteractionID) ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Phone size={14} />
                          )}
                          لم يجب
                        </button>
                        <button
                          onClick={() => handleRescheduleClick(task)}
                          disabled={updatingIds.has(task.InteractionID)}
                          className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1 min-w-[100px]"
                        >
                          <Calendar size={14} />
                          إعادة جدولة
                        </button>
                        <button
                          onClick={() => handleCopyClick(task)}
                          disabled={updatingIds.has(task.InteractionID)}
                          className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1 min-w-[100px]"
                        >
                          <Copy size={14} />
                          نسخ تفاعل
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 3: Upcoming */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={24} className="text-green-600" />
              <h2 className="text-xl font-bold text-gray-900">وعود قادمة</h2>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                {tasks.upcoming.length}
              </span>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {tasks.upcoming.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                  <CheckCircle2 size={48} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">لا توجد وعود قادمة</p>
                </div>
              ) : (
                tasks.upcoming.map((task) => {
                  const customerPhone = task.CustomerPhone || task.Customerphone || allCustomers.find((c) => (c.CustomerID || c.id) === task.CustomerID)?.Phone || allCustomers.find((c) => (c.CustomerID || c.id) === task.CustomerID)?.phone || '';
                  return (
                    <div
                      key={task.InteractionID}
                      className="bg-white rounded-lg border-2 border-green-200 p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <a
                        href={`/admin/customers/${task.CustomerID}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-bold text-gray-900 mb-1 hover:text-blue-600 hover:underline transition-colors text-right w-full block"
                      >
                        {task.CustomerName}
                      </a>
                      {customerPhone && (
                        <div className="mb-2">
                          <PhoneActions phone={customerPhone} />
                        </div>
                      )}
                      {task.PromiseAmount && (
                        <p className="text-sm font-semibold text-green-600 mb-1">
                          المبلغ: {formatCurrency(task.PromiseAmount)}
                        </p>
                      )}
                      <p className="text-xs text-green-500 mb-2">تاريخ: {formatDate(task.NextDate)}</p>
                      {task.Notes && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.Notes}</p>
                      )}
                      {(task.CreatedByUsername || task.UpdatedByUsername) && (
                        <p className="text-xs text-gray-500 mb-2">
                          {task.CreatedByUsername && <span>أنشأه: {task.CreatedByUsername}</span>}
                          {task.CreatedByUsername && task.UpdatedByUsername && ' · '}
                          {task.UpdatedByUsername && <span>آخر تحديث: {task.UpdatedByUsername}</span>}
                        </p>
                      )}
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <button
                          onClick={() => handleResolved(task)}
                          disabled={updatingIds.has(task.InteractionID)}
                          className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1 min-w-[100px]"
                        >
                          {updatingIds.has(task.InteractionID) ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          تم الدفع
                        </button>
                        <button
                          onClick={() => handleNoAnswer(task)}
                          disabled={updatingIds.has(task.InteractionID)}
                          className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1 min-w-[100px]"
                        >
                          {updatingIds.has(task.InteractionID) ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Phone size={14} />
                          )}
                          لم يجب
                        </button>
                        <button
                          onClick={() => handleRescheduleClick(task)}
                          disabled={updatingIds.has(task.InteractionID)}
                          className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1 min-w-[100px]"
                        >
                          <Calendar size={14} />
                          إعادة جدولة
                        </button>
                        <button
                          onClick={() => handleCopyClick(task)}
                          disabled={updatingIds.has(task.InteractionID)}
                          className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1 min-w-[100px]"
                        >
                          <Copy size={14} />
                          نسخ تفاعل
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
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
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
            style={{ fontFamily: 'Cairo, Arial, sans-serif' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">إعادة جدولة</h3>
              <button
                onClick={() => {
                  setRescheduleModal({ isOpen: false, task: null });
                  setRescheduleDate('');
                  setRescheduleNote('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تاريخ السداد الجديد <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ملاحظات
                </label>
                <textarea
                  value={rescheduleNote}
                  onChange={(e) => setRescheduleNote(e.target.value)}
                  placeholder="أضف ملاحظات حول إعادة الجدولة..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-400"
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
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                إلغاء
              </button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={!rescheduleDate || updatingIds.has(rescheduleModal.task.InteractionID)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {updatingIds.has(rescheduleModal.task.InteractionID) ? (
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
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto"
            style={{ fontFamily: 'Cairo, Arial, sans-serif' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">نسخ تفاعل</h3>
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
                className="text-gray-400 hover:text-gray-600 transition-colors"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                          ? 'border-gray-900 bg-gray-50 text-gray-900'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تاريخ الموعد <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={copyForm.date}
                  onChange={(e) => setCopyForm({ ...copyForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ملاحظات
                </label>
                <textarea
                  value={copyForm.note}
                  onChange={(e) => setCopyForm({ ...copyForm, note: e.target.value })}
                  placeholder="أضف ملاحظات..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-400"
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
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                إلغاء
              </button>
              <button
                onClick={handleCopySubmit}
                disabled={!copyForm.customerID || !copyForm.date || updatingIds.has(copyModal.task.InteractionID)}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {updatingIds.has(copyModal.task.InteractionID) ? (
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
