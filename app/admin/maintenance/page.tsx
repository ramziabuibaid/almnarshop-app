'use client';

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { getAllMaintenance, updateMaintenance, getMaintenance, convertDriveImageUrl } from '@/lib/api';
import { fixPhoneNumber } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import MaintenanceTimeline from '@/components/admin/MaintenanceTimeline';
import {
  Loader2,
  Wrench,
  Search,
  Plus,
  Edit,
  Eye,
  ChevronDown,
  Printer,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  X,
  DollarSign,
  History,
  ChevronUp,
  ImageIcon,
  ScanLine,
} from 'lucide-react';

interface MaintenanceRecord {
  MaintNo: string;
  CustomerID: string;
  CustomerName: string;
  ItemName: string;
  Location: string;
  Company?: string;
  DateOfPurchase?: string;
  DateOfReceive: string;
  Problem?: string;
  ImageOfItem?: string;
  ImageOfProblem?: string;
  ImageOfWarranty?: string;
  Status: string;
  SerialNo?: string;
  UnderWarranty: string;
  CreatedAt?: string;
  created_by?: string;
  createdBy?: string;
  user_id?: string;
  CostAmount?: number | null;
  CostReason?: string | null;
  IsPaid?: boolean;
}

export default function MaintenancePage() {
  useLayoutEffect(() => {
    document.title = 'الصيانة';
  }, []);
  const router = useRouter();
  const { admin } = useAdminAuth();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const [statusChangeModal, setStatusChangeModal] = useState<{
    isOpen: boolean;
    maintNo: string;
    currentStatus: string;
    newStatus: string;
    actionLabel: string;
  } | null>(null);
  const [statusChangeNote, setStatusChangeNote] = useState('');
  const [statusChangeCostAmount, setStatusChangeCostAmount] = useState('');
  const [statusChangeCostReason, setStatusChangeCostReason] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [viewingRecord, setViewingRecord] = useState<MaintenanceRecord | null>(null);
  const [viewingRecordFull, setViewingRecordFull] = useState<any | null>(null);
  const [loadingViewRecord, setLoadingViewRecord] = useState(false);
  const [viewActiveTab, setViewActiveTab] = useState<'details' | 'history'>('details');
  const [printOverlayMaintNo, setPrintOverlayMaintNo] = useState<string | null>(null);
  const [printQrOverlayMaintNo, setPrintQrOverlayMaintNo] = useState<string | null>(null);
  const printIframeRef = useRef<HTMLIFrameElement>(null);
  const printQrIframeRef = useRef<HTMLIFrameElement>(null);

  // Batch Print
  const [selectedForPrint, setSelectedForPrint] = useState<Set<string>>(new Set());
  const [printBatchA6OverlayMaintNos, setPrintBatchA6OverlayMaintNos] = useState<string[] | null>(null);
  const [printBatchQrOverlayMaintNos, setPrintBatchQrOverlayMaintNos] = useState<string[] | null>(null);
  const printBatchA6IframeRef = useRef<HTMLIFrameElement>(null);
  const printBatchQrIframeRef = useRef<HTMLIFrameElement>(null);

  const itemsPerPage = 20;

  const isMobilePrint = () => typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  useEffect(() => {
    document.title = 'الصيانة - Maintenance';
  }, []);

  useEffect(() => {
    loadRecords();
    loadUsers();
  }, []);

  useEffect(() => {
    if (!printOverlayMaintNo) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'print-ready' && printIframeRef.current?.contentWindow) {
        const prevTitle = document.title;
        if (e.data?.title) document.title = e.data.title;
        try {
          printIframeRef.current.contentWindow.print();
        } catch (_) { }
        setTimeout(() => { document.title = prevTitle; }, 500);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [printOverlayMaintNo]);

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

  useEffect(() => {
    if (!printBatchA6OverlayMaintNos || printBatchA6OverlayMaintNos.length === 0) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'batch-print-ready' && printBatchA6IframeRef.current?.contentWindow) {
        const prevTitle = document.title;
        if (e.data?.title) document.title = e.data.title;
        try {
          printBatchA6IframeRef.current.contentWindow.print();
        } catch (_) { }
        setTimeout(() => { document.title = prevTitle; }, 500);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [printBatchA6OverlayMaintNos]);

  useEffect(() => {
    if (!printBatchQrOverlayMaintNos || printBatchQrOverlayMaintNos.length === 0) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'batch-print-ready' && printBatchQrIframeRef.current?.contentWindow) {
        const prevTitle = document.title;
        if (e.data?.title) document.title = e.data.title;
        try {
          printBatchQrIframeRef.current.contentWindow.print();
        } catch (_) { }
        setTimeout(() => { document.title = prevTitle; }, 500);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [printBatchQrOverlayMaintNos]);

  const loadUsers = async () => {
    try {
      const { data: users, error } = await supabase
        .from('admin_users')
        .select('id, username')
        .order('username');

      if (error) {
        console.error('[MaintenancePage] Failed to load users:', error);
        return;
      }

      const map = new Map<string, string>();
      if (users && Array.isArray(users)) {
        users.forEach((user: any) => {
          const userId = user.id || '';
          const username = user.username || '';
          if (userId && username) {
            map.set(userId, username);
          }
        });
      }
      setUserMap(map);
    } catch (err: any) {
      console.error('[MaintenancePage] Failed to load users:', err);
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllMaintenance(1000);
      setRecords(data);
    } catch (err: any) {
      console.error('[MaintenancePage] Failed to load records:', err);
      setError(err?.message || 'فشل تحميل سجلات الصيانة');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRecord = (record: MaintenanceRecord) => {
    router.push(`/admin/maintenance/edit/${record.MaintNo}`);
  };

  const handleViewRecord = async (record: MaintenanceRecord) => {
    setViewingRecord(record);
    setViewActiveTab('details');
    setLoadingViewRecord(true);
    try {
      const fullRecord = await getMaintenance(record.MaintNo);
      setViewingRecordFull(fullRecord);
    } catch (err: any) {
      console.error('[MaintenancePage] Failed to load full record:', err);
      alert('فشل تحميل تفاصيل السجل: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setLoadingViewRecord(false);
    }
  };

  const closeViewModal = () => {
    setViewingRecord(null);
    setViewingRecordFull(null);
    setViewActiveTab('details');
  };

  const getImageUrl = (imagePath: string | undefined) => {
    if (!imagePath) return null;
    return convertDriveImageUrl(imagePath);
  };

  const handleWhatsAppFromModal = async (countryCode: '970' | '972') => {
    if (!viewingRecordFull) return;

    try {
      // Fetch customer data directly from Supabase
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('phone, name')
        .eq('customer_id', viewingRecordFull.CustomerID)
        .single();

      if (customerError || !customer) {
        console.error('[MaintenancePage] Error fetching customer:', customerError);
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
      if (viewingRecordFull.Status === 'جاهزة للتسليم للزبون من المحل') {
        pickupLocation = 'المعرض في جنين - شارع الناصرة';
      } else if (viewingRecordFull.Status === 'جاهزة للتسليم للزبون من المخزن') {
        pickupLocation = 'المعرض في جنين - مقر المخزن في المنطقة الصناعية';
      }

      // Create WhatsApp message
      const message = `السلام عليكم ورحمة الله وبركاته

نود إعلامكم أن القطعة "${viewingRecordFull.ItemName}" جاهزة للاستلام
يمكنكم استلامها من ${pickupLocation}

رقم الصيانة: ${viewingRecordFull.MaintNo}
${viewingRecordFull.SerialNo ? `الرقم التسلسلي: ${viewingRecordFull.SerialNo}\n` : ''}
نتمنى لكم يوم سعيد`;

      // Open WhatsApp
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      console.error('[MaintenancePage] Error sending WhatsApp:', error);
      alert(`فشل إرسال رسالة واتساب: ${error?.message || 'خطأ غير معروف'}`);
    }
  };

  const handlePrintRecord = (record: MaintenanceRecord) => {
    if (isMobilePrint()) {
      window.open(`/admin/maintenance/print/${record.MaintNo}`, `print-maintenance-${record.MaintNo}`, 'noopener,noreferrer');
      return;
    }
    setPrintOverlayMaintNo(record.MaintNo);
  };

  const handlePrintQrRecord = (record: MaintenanceRecord) => {
    if (isMobilePrint()) {
      window.open(`/admin/maintenance/print-qr/${record.MaintNo}`, `print-qr-${record.MaintNo}`, 'noopener,noreferrer');
      return;
    }
    setPrintQrOverlayMaintNo(record.MaintNo);
  };

  const toggleSelectForPrint = (maintNo: string) => {
    setSelectedForPrint((prev) => {
      const next = new Set(prev);
      if (next.has(maintNo)) next.delete(maintNo);
      else next.add(maintNo);
      return next;
    });
  };

  const selectAllOnPage = () => {
    setSelectedForPrint((prev) => {
      const next = new Set(prev);
      paginatedRecords.forEach((r) => next.add(r.MaintNo));
      return next;
    });
  };

  const clearPrintSelection = () => setSelectedForPrint(new Set());

  const openBatchPrintA6 = () => {
    const orderedIds = filteredAndSortedRecords
      .map((r) => r.MaintNo)
      .filter((id) => selectedForPrint.has(id));
    if (orderedIds.length === 0) return;

    if (isMobilePrint()) {
      window.open(`/admin/maintenance/print-batch?ids=${encodeURIComponent(orderedIds.join(','))}`, 'print-batch', 'noopener,noreferrer');
      return;
    }
    setPrintBatchA6OverlayMaintNos(orderedIds);
  };

  const openBatchPrintQr = () => {
    const orderedIds = filteredAndSortedRecords
      .map((r) => r.MaintNo)
      .filter((id) => selectedForPrint.has(id));
    if (orderedIds.length === 0) return;

    if (isMobilePrint()) {
      window.open(`/admin/maintenance/print-qr-batch?ids=${encodeURIComponent(orderedIds.join(','))}`, 'print-qr-batch', 'noopener,noreferrer');
      return;
    }
    setPrintBatchQrOverlayMaintNos(orderedIds);
  };

  const getActionButtons = (currentStatus: string, maintNo: string) => {
    const actions: Array<{ label: string; newStatus: string }> = [];

    switch (currentStatus) {
      case 'موجودة في المحل وجاهزة للتسليم':
        actions.push(
          { label: 'تسليمها للشركة', newStatus: 'موجودة في الشركة' },
          { label: 'إرسالها إلى المخزن', newStatus: 'موجودة في المخزن وجاهزة للتسليم' }
        );
        break;
      case 'موجودة في المخزن وجاهزة للتسليم':
        actions.push(
          { label: 'تسليمها للشركة', newStatus: 'موجودة في الشركة' },
          { label: 'إرسالها إلى المحل', newStatus: 'موجودة في المحل وجاهزة للتسليم' }
        );
        break;
      case 'موجودة في الشركة':
        actions.push(
          { label: 'استلام في المحل', newStatus: 'جاهزة للتسليم للزبون من المحل' },
          { label: 'استلام في المخزن', newStatus: 'جاهزة للتسليم للزبون من المخزن' },
          { label: 'إرجاع وخصم', newStatus: 'تم ارجاعها للشركة وخصمها للزبون' }
        );
        break;
      case 'جاهزة للتسليم للزبون من المخزن':
        actions.push(
          { label: 'تسليم للزبون', newStatus: 'سلمت للزبون' },
          { label: 'إرسال إلى المحل', newStatus: 'جاهزة للتسليم للزبون من المحل' }
        );
        break;
      case 'جاهزة للتسليم للزبون من المحل':
        actions.push(
          { label: 'تسليم للزبون', newStatus: 'سلمت للزبون' },
          { label: 'إرسال للمخزن', newStatus: 'جاهزة للتسليم للزبون من المخزن' }
        );
        break;
      default:
        // للحالات الأخرى (مثل "سلمت للزبون" و "تم ارجاعها للشركة وخصمها للزبون")
        // لا توجد إجراءات متاحة
        break;
    }

    return actions;
  };

  const handleStatusChangeClick = (maintNo: string, newStatus: string, actionLabel: string) => {
    const record = records.find((r) => r.MaintNo === maintNo);
    if (!record) return;

    setStatusChangeModal({
      isOpen: true,
      maintNo,
      currentStatus: record.Status,
      newStatus,
      actionLabel,
    });
    setStatusChangeNote('');
    setStatusChangeCostAmount('');
    setStatusChangeCostReason('');
  };

  const handleStatusChangeConfirm = async () => {
    if (!statusChangeModal) return;

    setUpdatingStatus(statusChangeModal.maintNo);
    try {
      const payload: any = {
        status: statusChangeModal.newStatus as any,
        historyNote: statusChangeNote.trim() || undefined,
        changedBy: admin?.id || undefined,
      };

      // If status is changing from "موجودة في الشركة" to "جاهزة للتسليم" (receiving from company),
      // allow adding cost information
      if (
        statusChangeModal.currentStatus === 'موجودة في الشركة' &&
        (statusChangeModal.newStatus === 'جاهزة للتسليم للزبون من المحل' ||
          statusChangeModal.newStatus === 'جاهزة للتسليم للزبون من المخزن')
      ) {
        // Always send costAmount (even if empty, to allow deletion)
        if (statusChangeCostAmount && statusChangeCostAmount.trim() !== '') {
          payload.costAmount = parseFloat(statusChangeCostAmount);
        } else {
          payload.costAmount = null; // Explicitly set to null to delete
        }
        // Always send costReason (even if empty, to allow deletion)
        payload.costReason = statusChangeCostReason.trim() || null;
      }

      await updateMaintenance(statusChangeModal.maintNo, payload);

      // Update the record locally without full reload
      setRecords((prevRecords) =>
        prevRecords.map((record) =>
          record.MaintNo === statusChangeModal.maintNo
            ? {
              ...record,
              Status: statusChangeModal.newStatus,
              CostAmount: payload.costAmount !== undefined ? payload.costAmount : record.CostAmount,
              CostReason: payload.costReason !== undefined ? payload.costReason : record.CostReason,
            }
            : record
        )
      );

      // Close modal
      setStatusChangeModal(null);
      setStatusChangeNote('');
      setStatusChangeCostAmount('');
      setStatusChangeCostReason('');
    } catch (err: any) {
      console.error('[MaintenancePage] Failed to update status:', err);
      setError(err?.message || 'فشل تحديث الحالة');
      // Reload records on error to ensure consistency
      await loadRecords();
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleStatusChangeCancel = () => {
    setStatusChangeModal(null);
    setStatusChangeNote('');
    setStatusChangeCostAmount('');
    setStatusChangeCostReason('');
  };

  const toggleRowExpansion = (maintNo: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(maintNo)) {
        newSet.delete(maintNo);
      } else {
        newSet.add(maintNo);
      }
      return newSet;
    });
  };

  const handleWhatsApp = async (record: MaintenanceRecord, countryCode: '970' | '972') => {
    try {
      // Fetch customer data directly from Supabase
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('phone, name')
        .eq('customer_id', record.CustomerID)
        .single();

      if (customerError || !customer) {
        console.error('[MaintenancePage] Error fetching customer:', customerError);
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
      console.error('[MaintenancePage] Error sending WhatsApp:', error);
      alert(`فشل إرسال رسالة واتساب: ${error?.message || 'خطأ غير معروف'}`);
    }
  };

  // Check if WhatsApp button should be shown for this status
  const shouldShowWhatsApp = (status: string) => {
    return status === 'جاهزة للتسليم للزبون من المحل' ||
      status === 'جاهزة للتسليم للزبون من المخزن';
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

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      // Use Asia/Jerusalem timezone for Palestine (UTC+2 or UTC+3)
      return date.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return '';
    }
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'موجودة في المحل وجاهزة للتسليم': 'bg-blue-100 text-blue-800',
      'موجودة في المخزن وجاهزة للتسليم': 'bg-purple-100 text-purple-800',
      'موجودة في الشركة': 'bg-yellow-100 text-yellow-800',
      'جاهزة للتسليم للزبون من المحل': 'bg-green-100 text-green-800',
      'جاهزة للتسليم للزبون من المخزن': 'bg-green-100 text-green-800',
      'سلمت للزبون': 'bg-gray-100 text-gray-800',
      'تم ارجاعها للشركة وخصمها للزبون': 'bg-red-100 text-red-800',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  // Get row background color based on status and date
  const getRowBackgroundColor = (record: MaintenanceRecord) => {
    // If delivered to customer, green background
    if (record.Status === 'سلمت للزبون') {
      return 'bg-green-50 hover:bg-green-100';
    }

    // If not delivered and more than 2 weeks have passed since receive date
    if (record.Status !== 'سلمت للزبون' && record.DateOfReceive) {
      try {
        const receiveDate = new Date(record.DateOfReceive);
        if (!isNaN(receiveDate.getTime())) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          receiveDate.setHours(0, 0, 0, 0);

          const daysDifference = Math.floor((today.getTime() - receiveDate.getTime()) / (1000 * 60 * 60 * 24));

          // More than 14 days (2 weeks)
          if (daysDifference > 14) {
            return 'bg-red-50 hover:bg-red-100';
          }
        }
      } catch (error) {
        // If date parsing fails, use default
        console.error('[MaintenancePage] Error parsing date:', error);
      }
    }

    // Default background
    return 'hover:bg-gray-50';
  };

  const filteredAndSortedRecords = useMemo(() => {
    let filtered = records;

    // Search by maintenance number, customer name, item name, or serial number
    if (searchQuery.trim()) {
      const searchWords = searchQuery
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0);

      filtered = filtered.filter((record) => {
        const maintNo = String(record.MaintNo || '').toLowerCase();
        const customerName = String(record.CustomerName || '').toLowerCase();
        const itemName = String(record.ItemName || '').toLowerCase();
        const serialNo = String(record.SerialNo || '').toLowerCase();
        const customerID = String(record.CustomerID || '').toLowerCase();

        const searchableText = `${maintNo} ${customerName} ${itemName} ${serialNo} ${customerID}`;

        return searchWords.every(word => searchableText.includes(word));
      });
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((record) => record.Status === statusFilter);
    }

    // Filter by location
    if (locationFilter !== 'all') {
      filtered = filtered.filter((record) => record.Location === locationFilter);
    }

    // Filter by company
    if (companyFilter !== 'all') {
      filtered = filtered.filter((record) => record.Company === companyFilter);
    }

    // Sort records by date (newest first - desc)
    filtered = [...filtered].sort((a, b) => {
      const dateA = new Date(a.CreatedAt || a.DateOfReceive || 0).getTime();
      const dateB = new Date(b.CreatedAt || b.DateOfReceive || 0).getTime();
      return dateB - dateA; // Descending order (newest first)
    });

    return filtered;
  }, [records, searchQuery, statusFilter, locationFilter, companyFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedRecords.length / itemsPerPage);
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedRecords, currentPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, locationFilter, companyFilter]);

  const statusOptions = [
    'موجودة في المحل وجاهزة للتسليم',
    'موجودة في المخزن وجاهزة للتسليم',
    'موجودة في الشركة',
    'جاهزة للتسليم للزبون من المحل',
    'جاهزة للتسليم للزبون من المخزن',
    'سلمت للزبون',
    'تم ارجاعها للشركة وخصمها للزبون',
  ];

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

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-cairo">جاري تحميل سجلات الصيانة...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6 font-cairo" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 font-cairo">الصيانة</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base font-cairo">
              إدارة سجلات الصيانة ({filteredAndSortedRecords.length} سجل)
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            <button
              onClick={() => router.push('/admin/maintenance/scanner')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium font-cairo text-sm sm:text-base"
            >
              <ScanLine size={20} />
              <span>الماسح السريع</span>
            </button>
            <button
              onClick={() => router.push('/admin/maintenance/new')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium font-cairo text-sm sm:text-base"
            >
              <Plus size={20} />
              <span>إضافة سجل صيانة</span>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
            <p className="text-red-700 text-sm sm:text-base font-cairo">{error}</p>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search
              size={20}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="بحث برقم الصيانة أو اسم العميل أو القطعة أو الرقم التسلسلي..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-500 font-cairo text-sm sm:text-base"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Status Filter */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-1 font-cairo">الحالة</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 appearance-none pr-8 text-sm font-cairo"
              >
                <option value="all">جميع الحالات</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute left-3 bottom-2.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Location Filter */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-1 font-cairo">الموقع</label>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 appearance-none pr-8 text-sm font-cairo"
              >
                <option value="all">جميع المواقع</option>
                <option value="المحل">المحل</option>
                <option value="المخزن">المخزن</option>
              </select>
              <ChevronDown size={16} className="absolute left-3 bottom-2.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Company Filter */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-1 font-cairo">الشركة</label>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 appearance-none pr-8 text-sm font-cairo"
              >
                <option value="all">جميع الشركات</option>
                {companyOptions.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute left-3 bottom-2.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Active Filters */}
          {(statusFilter !== 'all' || locationFilter !== 'all' || companyFilter !== 'all' || searchQuery) && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-600 font-cairo">الفلاتر النشطة:</span>
              {statusFilter !== 'all' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs hover:bg-blue-200 transition-colors font-cairo"
                >
                  {statusFilter}
                  <X size={12} />
                </button>
              )}
              {locationFilter !== 'all' && (
                <button
                  onClick={() => setLocationFilter('all')}
                  className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs hover:bg-purple-200 transition-colors font-cairo"
                >
                  {locationFilter}
                  <X size={12} />
                </button>
              )}
              {companyFilter !== 'all' && (
                <button
                  onClick={() => setCompanyFilter('all')}
                  className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs hover:bg-green-200 transition-colors font-cairo"
                >
                  {companyFilter}
                  <X size={12} />
                </button>
              )}
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs hover:bg-gray-200 transition-colors font-cairo"
                >
                  بحث: {searchQuery.substring(0, 20)}
                  <X size={12} />
                </button>
              )}
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setLocationFilter('all');
                  setCompanyFilter('all');
                  setSearchQuery('');
                }}
                className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors font-cairo"
              >
                إزالة الكل
              </button>
            </div>
          )}
        </div>

        {/* Records List */}
        {filteredAndSortedRecords.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 sm:p-12 text-center">
            <Wrench size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-base sm:text-lg font-cairo">لا توجد سجلات صيانة</p>
            {(statusFilter !== 'all' || locationFilter !== 'all' || companyFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setLocationFilter('all');
                  setCompanyFilter('all');
                  setSearchQuery('');
                }}
                className="mt-4 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-cairo"
              >
                إزالة جميع الفلاتر
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Batch Print Actions */}
            {selectedForPrint.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2 border-l border-blue-200 pl-4 ml-2">
                  <span className="bg-blue-600 text-white w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold font-cairo shadow-sm">
                    {selectedForPrint.size}
                  </span>
                  <span className="text-blue-900 font-bold font-cairo text-sm sm:text-base">
                    قطعة محددة
                  </span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={openBatchPrintA6}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium font-cairo text-sm"
                  >
                    <Printer size={18} />
                    <span>طباعة الفواتير (A6)</span>
                  </button>
                  <button
                    onClick={openBatchPrintQr}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm font-medium font-cairo text-sm"
                  >
                    <ScanLine size={18} />
                    <span>طباعة الباركود (50x25)</span>
                  </button>
                  <button
                    onClick={clearPrintSelection}
                    className="flex items-center justify-center p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors border border-transparent hover:border-red-200"
                    title="إلغاء التحديد"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            )}

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-right">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={paginatedRecords.length > 0 && paginatedRecords.every(r => selectedForPrint.has(r.MaintNo))}
                            onChange={(e) => {
                              if (e.target.checked) selectAllOnPage();
                              else clearPrintSelection();
                            }}
                            className="w-4 h-4 text-gray-900 bg-gray-100 border-gray-300 rounded focus:ring-gray-900 focus:ring-2 cursor-pointer"
                          />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider font-cairo">
                        رقم الصيانة
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider font-cairo">
                        العميل
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider font-cairo">
                        اسم القطعة
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider font-cairo">
                        الموقع
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider font-cairo">
                        تاريخ الاستقبال
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider font-cairo">
                        الحالة
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider font-cairo">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedRecords.map((record) => (
                      <React.Fragment key={record.MaintNo}>
                        <tr className={`${getRowBackgroundColor(record)} transition-colors ${selectedForPrint.has(record.MaintNo) ? 'bg-blue-50/50' : ''}`}>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={selectedForPrint.has(record.MaintNo)}
                                onChange={() => toggleSelectForPrint(record.MaintNo)}
                                className="w-4 h-4 text-gray-900 bg-gray-100 border-gray-300 rounded focus:ring-gray-900 focus:ring-2 cursor-pointer"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="font-medium text-gray-900 font-cairo">{record.MaintNo}</div>
                            {userMap.get(record.created_by || record.createdBy || record.user_id || '') && (
                              <div className="text-xs text-gray-500 mt-1 font-cairo">
                                {userMap.get(record.created_by || record.createdBy || record.user_id || '')}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (e.ctrlKey || e.metaKey) {
                                  window.open(`/admin/customers/${record.CustomerID}`, '_blank', 'noopener,noreferrer');
                                } else {
                                  router.push(`/admin/customers/${record.CustomerID}`);
                                }
                              }}
                              className="text-gray-900 hover:text-gray-900 hover:underline font-medium transition-colors text-right font-cairo"
                              title="عرض بروفايل العميل"
                            >
                              {record.CustomerName || record.CustomerID}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center gap-2">
                              <div className="text-gray-900 font-cairo">{record.ItemName}</div>
                              {record.CostAmount !== null && record.CostAmount !== undefined && record.CostAmount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs font-medium font-cairo" title={`تكلفة الصيانة: ${record.CostAmount} ₪`}>
                                  <DollarSign size={12} />
                                  {record.CostAmount} ₪
                                </span>
                              )}
                            </div>
                            {record.Company && (
                              <div className="text-xs text-gray-500 mt-1 font-cairo">
                                {record.Company}
                              </div>
                            )}
                            {record.CostReason && (
                              <div className="text-xs text-orange-600 mt-1 font-cairo" title={record.CostReason}>
                                {record.CostReason.length > 30 ? `${record.CostReason.substring(0, 30)}...` : record.CostReason}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="text-gray-600 font-cairo">{record.Location}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="text-gray-600 font-cairo">{formatDate(record.DateOfReceive)}</div>
                            {record.CreatedAt && (
                              <div className="text-xs text-gray-500 mt-1 font-cairo">
                                {formatTime(record.CreatedAt)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col gap-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-cairo ${getStatusColor(record.Status)}`}>
                                {record.Status}
                              </span>
                              {getActionButtons(record.Status, record.MaintNo).length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {getActionButtons(record.Status, record.MaintNo).map((action, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => handleStatusChangeClick(record.MaintNo, action.newStatus, action.label)}
                                      disabled={updatingStatus === record.MaintNo}
                                      className={`text-xs px-2.5 py-1 border border-gray-300 rounded-md hover:bg-gray-100 hover:border-gray-400 transition-colors text-gray-900 font-medium font-cairo ${updatingStatus === record.MaintNo ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                        }`}
                                      title={action.newStatus}
                                    >
                                      {action.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {updatingStatus === record.MaintNo && (
                                <div className="flex items-center gap-1 text-xs text-gray-500 font-cairo">
                                  <Loader2 size={12} className="animate-spin" />
                                  <span>جاري التحديث...</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => toggleRowExpansion(record.MaintNo)}
                                className={`p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ${expandedRows.has(record.MaintNo) ? 'bg-gray-100' : ''
                                  }`}
                                title="عرض السجل التاريخي"
                              >
                                {expandedRows.has(record.MaintNo) ? (
                                  <ChevronUp size={18} />
                                ) : (
                                  <History size={18} />
                                )}
                              </button>
                              {shouldShowWhatsApp(record.Status) && (
                                <div className="relative group">
                                  <button
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                    title="إرسال واتساب"
                                  >
                                    <MessageCircle size={18} />
                                  </button>
                                  <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                                    <div className="p-2 space-y-1">
                                      <button
                                        onClick={() => handleWhatsApp(record, '970')}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-right text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-cairo"
                                      >
                                        <MessageCircle size={16} className="text-green-600" />
                                        <span className="flex-1">واتساب: 970</span>
                                      </button>
                                      <button
                                        onClick={() => handleWhatsApp(record, '972')}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-right text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-cairo"
                                      >
                                        <MessageCircle size={16} className="text-green-600" />
                                        <span className="flex-1">واتساب: 972</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <button
                                onClick={() => handlePrintRecord(record)}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="طباعة"
                              >
                                <Printer size={18} />
                              </button>
                              <button
                                onClick={() => handlePrintQrRecord(record)}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="طباعة الباركود"
                              >
                                <ScanLine size={18} />
                              </button>
                              <button
                                onClick={() => handleViewRecord(record)}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="عرض"
                              >
                                <Eye size={18} />
                              </button>
                              <button
                                onClick={() => handleEditRecord(record)}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="تعديل"
                              >
                                <Edit size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedRows.has(record.MaintNo) && (
                          <tr className="bg-gradient-to-b from-gray-50 to-white">
                            <td colSpan={7} className="px-4 sm:px-6 py-4 border-t-2 border-gray-300">
                              <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-top-2 duration-200" dir="rtl">
                                <div className="flex items-center justify-between mb-3 sm:mb-4 pb-3 border-b border-gray-300">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-gray-900 rounded-lg">
                                      <History size={14} className="text-white" />
                                    </div>
                                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 font-cairo">السجل التاريخي</h3>
                                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full font-cairo">#{record.MaintNo}</span>
                                  </div>
                                  <button
                                    onClick={() => toggleRowExpansion(record.MaintNo)}
                                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors font-cairo"
                                  >
                                    إخفاء
                                  </button>
                                </div>
                                <div className="max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                                  <MaintenanceTimeline maintNo={record.MaintNo} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {paginatedRecords.map((record) => (
                <div key={record.MaintNo} className={`bg-white border rounded-lg p-4 shadow-sm ${getRowBackgroundColor(record)}`}>
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedForPrint.has(record.MaintNo)}
                        onChange={() => toggleSelectForPrint(record.MaintNo)}
                        className="w-4 h-4 text-gray-900 bg-gray-100 border-gray-300 rounded focus:ring-gray-900 focus:ring-2 cursor-pointer mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-base font-bold text-gray-900 font-cairo">#{record.MaintNo}</h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-cairo ${getStatusColor(record.Status)}`}>
                            {record.Status}
                          </span>
                        </div>
                        {userMap.get(record.created_by || record.createdBy || record.user_id || '') && (
                          <div className="text-xs text-gray-500 font-cairo">
                            {userMap.get(record.created_by || record.createdBy || record.user_id || '')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="mb-3">
                      <div className="text-xs text-gray-500 font-cairo mb-1">العميل</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/admin/customers/${record.CustomerID}`);
                        }}
                        className="text-sm text-gray-900 hover:text-gray-900 hover:underline font-medium font-cairo"
                      >
                        {record.CustomerName || record.CustomerID}
                      </button>
                    </div>

                    {/* Item Info */}
                    <div className="mb-3">
                      <div className="text-xs text-gray-500 font-cairo mb-1">اسم القطعة</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-semibold text-gray-900 font-cairo">{record.ItemName}</div>
                        {record.CostAmount !== null && record.CostAmount !== undefined && record.CostAmount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs font-medium font-cairo">
                            <DollarSign size={12} />
                            {record.CostAmount} ₪
                          </span>
                        )}
                      </div>
                      {record.Company && (
                        <div className="text-xs text-gray-500 mt-1 font-cairo">{record.Company}</div>
                      )}
                      {record.CostReason && (
                        <div className="text-xs text-orange-600 mt-1 font-cairo">{record.CostReason}</div>
                      )}
                    </div>

                    {/* Location and Date */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <div className="text-xs text-gray-500 font-cairo mb-1">الموقع</div>
                        <div className="text-sm text-gray-900 font-cairo">{record.Location}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 font-cairo mb-1">تاريخ الاستقبال</div>
                        <div className="text-sm text-gray-900 font-cairo">{formatDate(record.DateOfReceive)}</div>
                        {record.CreatedAt && (
                          <div className="text-xs text-gray-500 mt-0.5 font-cairo">{formatTime(record.CreatedAt)}</div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {getActionButtons(record.Status, record.MaintNo).length > 0 && (
                      <div className="mb-3 pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-500 font-cairo mb-2">إجراءات الحالة</div>
                        <div className="flex flex-wrap gap-2">
                          {getActionButtons(record.Status, record.MaintNo).map((action, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleStatusChangeClick(record.MaintNo, action.newStatus, action.label)}
                              disabled={updatingStatus === record.MaintNo}
                              className={`text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-colors text-gray-900 font-medium font-cairo ${updatingStatus === record.MaintNo ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                }`}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                        {updatingStatus === record.MaintNo && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-2 font-cairo">
                            <Loader2 size={12} className="animate-spin" />
                            <span>جاري التحديث...</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => toggleRowExpansion(record.MaintNo)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-cairo ${expandedRows.has(record.MaintNo) ? 'bg-gray-200' : ''
                          }`}
                      >
                        <History size={16} />
                        <span>السجل التاريخي</span>
                      </button>
                      {shouldShowWhatsApp(record.Status) && (
                        <div className="relative">
                          <button
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            onClick={() => {
                              // On mobile, show a simple menu or default to 970
                              handleWhatsApp(record, '970');
                            }}
                            title="إرسال واتساب"
                          >
                            <MessageCircle size={18} />
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => handlePrintRecord(record)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="طباعة"
                      >
                        <Printer size={18} />
                      </button>
                      <button
                        onClick={() => handlePrintQrRecord(record)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="طباعة الباركود"
                      >
                        <ScanLine size={18} />
                      </button>
                      <button
                        onClick={() => handleViewRecord(record)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="عرض"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleEditRecord(record)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="تعديل"
                      >
                        <Edit size={18} />
                      </button>
                    </div>
                  </div>

                    /* Expanded Timeline */
                  {expandedRows.has(record.MaintNo) && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-gray-900 font-cairo">السجل التاريخي</h4>
                        <button
                          onClick={() => toggleRowExpansion(record.MaintNo)}
                          className="text-xs text-gray-500 hover:text-gray-700 transition-colors font-cairo"
                        >
                          إخفاء
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        <MaintenanceTimeline maintNo={record.MaintNo} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs sm:text-sm text-gray-600 font-cairo text-center sm:text-right">
                    عرض {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedRecords.length)} من {filteredAndSortedRecords.length} سجل
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={20} />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors font-cairo ${currentPage === pageNum
                              ? 'bg-gray-900 text-white'
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                              }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={20} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Status Change Modal */}
        {statusChangeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6 space-y-3 sm:space-y-4 max-h-[95vh] overflow-y-auto">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 font-cairo">تغيير الحالة</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 font-cairo">من</label>
                  <p className="text-sm sm:text-base text-gray-900 bg-gray-50 px-3 py-2 rounded-lg font-cairo">{statusChangeModal.currentStatus}</p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 font-cairo">إلى</label>
                  <p className="text-sm sm:text-base text-gray-900 bg-blue-50 px-3 py-2 rounded-lg font-medium font-cairo">{statusChangeModal.newStatus}</p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 font-cairo">
                    ملاحظة (اختياري)
                  </label>
                  <textarea
                    value={statusChangeNote}
                    onChange={(e) => setStatusChangeNote(e.target.value)}
                    placeholder="أضف ملاحظة حول هذا التغيير..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 resize-y font-cairo text-sm sm:text-base"
                  />
                </div>
                {statusChangeModal.currentStatus === 'موجودة في الشركة' &&
                  (statusChangeModal.newStatus === 'جاهزة للتسليم للزبون من المحل' ||
                    statusChangeModal.newStatus === 'جاهزة للتسليم للزبون من المخزن') && (
                    <>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 font-cairo">
                          مبلغ التكلفة (₪)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={statusChangeCostAmount}
                          onChange={(e) => setStatusChangeCostAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-cairo text-sm sm:text-base"
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 font-cairo">
                          سبب التكلفة (اختياري)
                        </label>
                        <textarea
                          value={statusChangeCostReason}
                          onChange={(e) => setStatusChangeCostReason(e.target.value)}
                          placeholder="وصف سبب التكلفة..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 resize-y font-cairo text-sm sm:text-base"
                        />
                      </div>
                    </>
                  )}
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleStatusChangeCancel}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium font-cairo text-sm sm:text-base"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleStatusChangeConfirm}
                  disabled={updatingStatus === statusChangeModal.maintNo}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed font-cairo text-sm sm:text-base"
                >
                  {updatingStatus === statusChangeModal.maintNo ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>جاري التحديث...</span>
                    </>
                  ) : (
                    'تأكيد التغيير'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Record Modal */}
        {viewingRecord && (
          <div
            className="fixed inset-0 md:right-64 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4"
            dir="rtl"
            onClick={closeViewModal}
          >
            <div
              className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 z-10 flex-shrink-0">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 font-cairo">عرض سجل الصيانة</h2>
                  <p className="text-sm text-gray-600 font-cairo">#{viewingRecord.MaintNo}</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {shouldShowWhatsApp(viewingRecord.Status) && viewingRecordFull && (
                    <div className="relative">
                      <button
                        onClick={() => handleWhatsAppFromModal('970')}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-cairo"
                        title="واتساب 970"
                      >
                        <MessageCircle size={16} />
                        <span className="hidden sm:inline">واتساب</span>
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (isMobilePrint()) {
                        window.open(`/admin/maintenance/print/${viewingRecord.MaintNo}`, `print-maintenance-${viewingRecord.MaintNo}`, 'noopener,noreferrer');
                        return;
                      }
                      setPrintOverlayMaintNo(viewingRecord.MaintNo);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-cairo"
                  >
                    <Printer size={16} />
                    <span className="hidden sm:inline">طباعة</span>
                  </button>
                  <button
                    onClick={() => {
                      if (isMobilePrint()) {
                        window.open(`/admin/maintenance/print-qr/${viewingRecord.MaintNo}`, `print-qr-${viewingRecord.MaintNo}`, 'noopener,noreferrer');
                        return;
                      }
                      setPrintQrOverlayMaintNo(viewingRecord.MaintNo);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-cairo"
                    title="طباعة الباركود (50x25)"
                  >
                    <ScanLine size={16} />
                    <span className="hidden sm:inline">الباركود</span>
                  </button>
                  <button
                    onClick={() => router.push(`/admin/maintenance/edit/${viewingRecord.MaintNo}`)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-cairo"
                  >
                    <Edit size={16} />
                    <span className="hidden sm:inline">تعديل</span>
                  </button>
                  <button
                    onClick={closeViewModal}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X size={20} className="text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 flex-shrink-0" dir="rtl">
                <button
                  onClick={() => setViewActiveTab('details')}
                  className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 font-medium transition-colors text-xs sm:text-sm font-cairo ${viewActiveTab === 'details'
                    ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                  <Edit size={16} />
                  <span>التفاصيل</span>
                </button>
                <button
                  onClick={() => setViewActiveTab('history')}
                  className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 font-medium transition-colors text-xs sm:text-sm font-cairo ${viewActiveTab === 'history'
                    ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                  <History size={16} />
                  <span>السجل التاريخي</span>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-6 min-h-0">
                {loadingViewRecord ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={32} className="animate-spin text-gray-400" />
                  </div>
                ) : viewActiveTab === 'details' && viewingRecordFull ? (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Customer Info */}
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3 sm:mb-4 font-cairo">معلومات العميل</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1 font-cairo">اسم العميل</label>
                          <button
                            onClick={() => {
                              if (window.event && (window.event as any).ctrlKey) {
                                window.open(`/admin/customers/${viewingRecordFull.CustomerID}`, '_blank', 'noopener,noreferrer');
                              } else {
                                router.push(`/admin/customers/${viewingRecordFull.CustomerID}`);
                              }
                            }}
                            className="text-sm sm:text-base text-gray-900 font-medium hover:underline font-cairo"
                          >
                            {viewingRecordFull.CustomerName || viewingRecordFull.CustomerID}
                          </button>
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1 font-cairo">رقم العميل</label>
                          <p className="text-sm sm:text-base text-gray-900 font-cairo">{viewingRecordFull.CustomerID}</p>
                        </div>
                      </div>
                    </div>

                    {/* Item Information */}
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3 sm:mb-4 font-cairo">معلومات القطعة</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1 font-cairo">اسم القطعة</label>
                          <p className="text-sm sm:text-base text-gray-900 font-medium font-cairo">{viewingRecordFull.ItemName}</p>
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1 font-cairo">الموقع</label>
                          <p className="text-sm sm:text-base text-gray-900 font-cairo">{viewingRecordFull.Location}</p>
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1 font-cairo">الشركة الكفيلة</label>
                          <p className="text-sm sm:text-base text-gray-900 font-cairo">{viewingRecordFull.Company || '—'}</p>
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1 font-cairo">رقم السيريال</label>
                          <p className="text-sm sm:text-base text-gray-900 font-cairo">{viewingRecordFull.SerialNo || '—'}</p>
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1 font-cairo">تحت الكفالة</label>
                          <p className="text-sm sm:text-base text-gray-900 font-cairo">{viewingRecordFull.UnderWarranty === 'YES' ? 'نعم' : 'لا'}</p>
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1 font-cairo">الحالة</label>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-cairo ${getStatusColor(viewingRecordFull.Status)}`}>
                            {viewingRecordFull.Status}
                          </span>
                        </div>
                        {viewingRecordFull.CostAmount !== null && viewingRecordFull.CostAmount !== undefined && (
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1 font-cairo">مبلغ التكلفة</label>
                            <p className="text-sm sm:text-base text-gray-900 font-medium font-cairo">{viewingRecordFull.CostAmount} ₪</p>
                          </div>
                        )}
                        {viewingRecordFull.CostReason && (
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1 font-cairo">سبب التكلفة</label>
                            <p className="text-sm sm:text-base text-gray-900 font-cairo">{viewingRecordFull.CostReason}</p>
                          </div>
                        )}
                        {viewingRecordFull.IsPaid !== undefined && (
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1 font-cairo">تم الدفع</label>
                            <p className="text-sm sm:text-base text-gray-900 font-cairo">{viewingRecordFull.IsPaid ? 'نعم' : 'لا'}</p>
                          </div>
                        )}
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1 font-cairo">تاريخ الشراء</label>
                          <p className="text-sm sm:text-base text-gray-900 font-cairo">{formatDate(viewingRecordFull.DateOfPurchase)}</p>
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1 font-cairo">تاريخ الاستقبال</label>
                          <p className="text-sm sm:text-base text-gray-900 font-cairo">{formatDate(viewingRecordFull.DateOfReceive)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Problem Description */}
                    {viewingRecordFull.Problem && (
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3 sm:mb-4 font-cairo">وصف المشكلة</h3>
                        <p className="text-sm sm:text-base text-gray-900 whitespace-pre-wrap font-cairo">{viewingRecordFull.Problem}</p>
                      </div>
                    )}

                    {/* Images */}
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3 sm:mb-4 font-cairo">الصور</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                        {viewingRecordFull.ImageOfItem && (
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-2 font-cairo">صورة القطعة</label>
                            <div className="relative w-full h-40 sm:h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                              <img
                                src={getImageUrl(viewingRecordFull.ImageOfItem) || ''}
                                alt="صورة القطعة"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          </div>
                        )}
                        {viewingRecordFull.ImageOfProblem && (
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-2 font-cairo">صورة المشكلة</label>
                            <div className="relative w-full h-40 sm:h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                              <img
                                src={getImageUrl(viewingRecordFull.ImageOfProblem) || ''}
                                alt="صورة المشكلة"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          </div>
                        )}
                        {viewingRecordFull.ImageOfWarranty && (
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-2 font-cairo">صورة الكفالة</label>
                            <div className="relative w-full h-40 sm:h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                              <img
                                src={getImageUrl(viewingRecordFull.ImageOfWarranty) || ''}
                                alt="صورة الكفالة"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          </div>
                        )}
                        {!viewingRecordFull.ImageOfItem && !viewingRecordFull.ImageOfProblem && !viewingRecordFull.ImageOfWarranty && (
                          <div className="col-span-full text-center py-8 text-gray-500 font-cairo">
                            <ImageIcon size={48} className="mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">لا توجد صور</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : viewActiveTab === 'history' && viewingRecord ? (
                  <div>
                    <MaintenanceTimeline maintNo={viewingRecord.MaintNo} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

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
                    <Printer size={16} />
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

        {/* BATCH PRINT OVERLAYS */}
        {printBatchA6OverlayMaintNos && printBatchA6OverlayMaintNos.length > 0 && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            dir="rtl"
            onClick={() => setPrintBatchA6OverlayMaintNos(null)}
          >
            <div
              className="relative bg-white rounded-lg shadow-xl flex flex-col w-full max-w-4xl h-[95vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <div className="flex items-center gap-2 text-gray-700 font-cairo">
                  <Printer size={16} />
                  <span className="text-sm">معاينة طباعة — {printBatchA6OverlayMaintNos.length} تذكرة صيانة محددة (A6)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => printBatchA6IframeRef.current?.contentWindow?.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-cairo bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <Printer size={20} />
                    طباعة مرة أخرى
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintBatchA6OverlayMaintNos(null)}
                    className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors"
                    aria-label="إغلاق"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-gray-100 min-h-0 flex justify-center">
                <iframe
                  ref={printBatchA6IframeRef}
                  src={`/admin/maintenance/print-batch?embed=1&ids=${encodeURIComponent(printBatchA6OverlayMaintNos.join(','))}`}
                  title="طباعة تذاكر صيانة"
                  className="w-full h-full shadow-lg max-w-[105mm] border-x border-gray-300 bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {printBatchQrOverlayMaintNos && printBatchQrOverlayMaintNos.length > 0 && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            dir="rtl"
            onClick={() => setPrintBatchQrOverlayMaintNos(null)}
          >
            <div
              className="relative bg-white rounded-lg shadow-xl flex flex-col max-w-full max-h-full overflow-hidden"
              style={{ minWidth: '120mm', maxHeight: '95vh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <div className="flex items-center gap-2 text-gray-700 font-cairo">
                  <ScanLine size={16} />
                  <span className="text-sm">معاينة طباعة — {printBatchQrOverlayMaintNos.length} ملصق باركود محدد (50x25)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => printBatchQrIframeRef.current?.contentWindow?.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-cairo bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <Printer size={20} />
                    طباعة مرة أخرى
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintBatchQrOverlayMaintNos(null)}
                    className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors"
                    aria-label="إغلاق"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-gray-100 min-h-0 flex justify-center items-center">
                <iframe
                  ref={printBatchQrIframeRef}
                  src={`/admin/maintenance/print-qr-batch?embed=1&ids=${encodeURIComponent(printBatchQrOverlayMaintNos.join(','))}`}
                  title="طباعة ملصقات الباركود"
                  className="shadow-md bg-white border border-gray-300"
                  style={{ width: '50mm', height: '25mm' }}
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout >
  );
}

