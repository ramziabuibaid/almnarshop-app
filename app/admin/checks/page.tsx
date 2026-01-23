'use client';

import { useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import CustomerFormModal from '@/components/admin/CustomerFormModal';
import { supabase } from '@/lib/supabase';
import {
  getChecks,
  getAllCustomers,
  saveCheck,
  updateCheckStatus,
  updateCheck,
  deleteCheck,
  uploadCheckImage,
  CHECK_STATUS_VALUES,
  type CheckStatus,
} from '@/lib/api';
import {
  Search,
  Filter,
  Plus,
  RefreshCw,
  Loader2,
  Image as ImageIcon,
  FileText,
  Edit,
  Trash2,
  UserPlus,
  X,
  Calendar,
  DollarSign,
  User,
  FileCheck,
  Eye,
} from 'lucide-react';

interface CheckRecord {
  check_id: string;
  customer_id: string;
  amount: number;
  image_front?: string | null;
  image_back?: string | null;
  return_date?: string | null;
  status: string;
  notes?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  createdBy?: string | null;
  user_id?: string | null;
  customers?: {
    name?: string | null;
    phone?: string | null;
    balance?: number | null;
  } | null;
}

interface CheckFormState {
  customerId: string;
  amount: string;
  imageFront: string;
  imageBack: string;
  imageFrontFile: File | null;
  imageBackFile: File | null;
  returnDate: string;
  status: CheckStatus;
  notes: string;
}

export default function ChecksPage() {
  useLayoutEffect(() => {
    document.title = 'الشيكات الراجعة';
  }, []);
  const { admin } = useAdminAuth();
  
  // Check if user has accountant permission (for delete)
  const canAccountant = admin?.is_super_admin || admin?.permissions?.accountant === true;

  const [checks, setChecks] = useState<CheckRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [checkSaving, setCheckSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [checkForm, setCheckForm] = useState<CheckFormState>({
    customerId: '',
    amount: '',
    imageFront: '',
    imageBack: '',
    imageFrontFile: null as File | null,
    imageBackFile: null as File | null,
    returnDate: '',
    status: CHECK_STATUS_VALUES[0],
    notes: '',
  });
  const [editingCheck, setEditingCheck] = useState<CheckRecord | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const [statusChangeModal, setStatusChangeModal] = useState<{
    isOpen: boolean;
    checkId: string;
    currentStatus: string;
    newStatus: string;
    actionLabel: string;
  } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [viewingCheck, setViewingCheck] = useState<CheckRecord | null>(null);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const [imageFrontPreview, setImageFrontPreview] = useState<string | null>(null);
  const [imageBackPreview, setImageBackPreview] = useState<string | null>(null);

  const filteredChecks = useMemo(() => {
    let filtered = checks;
    
    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter((chk) => chk.status === statusFilter);
    }
    
    // Apply search filter
    if (search.trim()) {
      const words = search
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      filtered = filtered.filter((chk) => {
        const hay = [
          chk.check_id || '',
          chk.notes || '',
          chk.customers?.name || '',
          chk.customers?.phone || '',
        ]
          .join(' ')
          .toLowerCase();
        return words.every((w) => hay.includes(w));
      });
    }
    
    return filtered;
  }, [checks, search, statusFilter]);

  const filteredCustomers = useMemo(() => {
    if (!customerQuery.trim()) return customers.slice(0, 50);
    const words = customerQuery
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    return customers.filter((c) => {
      const hay = `${c.Name || c.name || ''} ${c.Phone || c.phone || ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    }).slice(0, 50);
  }, [customers, customerQuery]);

  // Close customer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getChecks({
        status: statusFilter as CheckStatus,
        search,
      });
      setChecks(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await getAllCustomers();
      setCustomers(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    document.title = 'الشيكات - Checks';
  }, []);

  useEffect(() => {
    loadCustomers();
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data: users, error } = await supabase
        .from('admin_users')
        .select('id, username')
        .order('username');

      if (error) {
        console.error('[ChecksPage] Failed to load users:', error);
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
      console.error('[ChecksPage] Failed to load users:', err);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleSearch = () => {
    loadData();
  };

  const handleSaveCheck = async () => {
    if (!checkForm.customerId) {
      alert('اختر الزبون');
      return;
    }
    if (!checkForm.amount.trim()) {
      alert('المبلغ مطلوب');
      return;
    }
    setCheckSaving(true);
    try {
      let imageFrontUrl = checkForm.imageFront || null;
      let imageBackUrl = checkForm.imageBack || null;

      if (checkForm.imageFrontFile) {
        imageFrontUrl = await uploadCheckImage(checkForm.imageFrontFile);
      }
      if (checkForm.imageBackFile) {
        imageBackUrl = await uploadCheckImage(checkForm.imageBackFile);
      }

      if (editingCheck) {
        await updateCheck(editingCheck.check_id, {
          customerID: checkForm.customerId,
          amount: parseFloat(checkForm.amount) || 0,
          imageFront: imageFrontUrl,
          imageBack: imageBackUrl,
          returnDate: checkForm.returnDate || null,
          status: checkForm.status as CheckStatus,
          notes: checkForm.notes || null,
        });
      } else {
        await saveCheck({
          customerID: checkForm.customerId,
          amount: parseFloat(checkForm.amount) || 0,
          imageFront: imageFrontUrl,
          imageBack: imageBackUrl,
          returnDate: checkForm.returnDate || null,
          status: checkForm.status as CheckStatus,
          notes: checkForm.notes || null,
        });
      }
      await loadData();
      setIsAddModalOpen(false);
      // Clean up object URLs if any
      if (imageFrontPreview) {
        URL.revokeObjectURL(imageFrontPreview);
      }
      if (imageBackPreview) {
        URL.revokeObjectURL(imageBackPreview);
      }
      setCheckForm({
        customerId: '',
        amount: '',
        imageFront: '',
        imageBack: '',
        imageFrontFile: null,
        imageBackFile: null,
        returnDate: '',
        status: CHECK_STATUS_VALUES[0],
        notes: '',
      });
      setEditingCheck(null);
      setCustomerQuery('');
      setImageFrontPreview(null);
      setImageBackPreview(null);
    } catch (err: any) {
      alert(err?.message || 'فشل حفظ الشيك');
    } finally {
      setCheckSaving(false);
    }
  };

  const handleStatusChange = async (checkId: string, status: CheckStatus) => {
    try {
      await updateCheckStatus(checkId, status);
      setChecks((prev) =>
        prev.map((c) => (c.check_id === checkId ? { ...c, status } : c)),
      );
    } catch (err: any) {
      alert(err?.message || 'فشل تحديث الحالة');
    }
  };

  const getActionButtons = (currentStatus: string, checkId: string) => {
    const actions: Array<{ label: string; newStatus: string }> = [];

    switch (currentStatus) {
      case 'مع الشركة':
      case 'في البنك':
        actions.push(
          { label: 'استلام في المحل', newStatus: 'في المحل' },
          { label: 'استلام في المخزن', newStatus: 'في المخزن' }
        );
        break;
      case 'في المحل':
        actions.push(
          { label: 'تسليم للزبون ودفع القيمة', newStatus: 'سلم للزبون وتم تسديد القيمة' },
          { label: 'تسليم للزبون ولم يدفع القيمة', newStatus: 'سلم للزبون ولم يدفع' },
          { label: 'إرساله للمخزن', newStatus: 'في المخزن' }
        );
        break;
      case 'في المخزن':
        actions.push(
          { label: 'تسليم للزبون ودفع القيمة', newStatus: 'سلم للزبون وتم تسديد القيمة' },
          { label: 'تسليم للزبون ولم يدفع القيمة', newStatus: 'سلم للزبون ولم يدفع' },
          { label: 'إرساله للمحل', newStatus: 'في المحل' }
        );
        break;
      case 'سلم للزبون ولم يدفع':
        actions.push(
          { label: 'تم الدفع', newStatus: 'سلم للزبون وتم تسديد القيمة' }
        );
        break;
      default:
        // للحالات الأخرى (مثل "سلم للزبون وتم تسديد القيمة")
        // لا توجد إجراءات متاحة
        break;
    }

    return actions;
  };

  const handleStatusChangeClick = (checkId: string, newStatus: string, actionLabel: string) => {
    const check = checks.find((c) => c.check_id === checkId);
    if (!check) return;
    
    setStatusChangeModal({
      isOpen: true,
      checkId,
      currentStatus: check.status,
      newStatus,
      actionLabel,
    });
  };

  const handleStatusChangeConfirm = async () => {
    if (!statusChangeModal) return;

    setUpdatingStatus(statusChangeModal.checkId);
    try {
      await updateCheckStatus(statusChangeModal.checkId, statusChangeModal.newStatus as CheckStatus);
      
      // Update the check locally without full reload
      setChecks((prevChecks) =>
        prevChecks.map((check) =>
          check.check_id === statusChangeModal.checkId
            ? { ...check, status: statusChangeModal.newStatus }
            : check
        )
      );

      // Close modal
      setStatusChangeModal(null);
    } catch (err: any) {
      console.error('[ChecksPage] Failed to update status:', err);
      alert(err?.message || 'فشل تحديث الحالة');
      // Reload checks on error to ensure consistency
      await loadData();
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleStatusChangeCancel = () => {
    setStatusChangeModal(null);
  };

  const handleViewCheck = (check: CheckRecord) => {
    setViewingCheck(check);
  };

  const closeViewCheck = () => {
    setViewingCheck(null);
  };

  const openEditModal = (chk: CheckRecord) => {
    // Clean up previous previews
    if (imageFrontPreview) {
      URL.revokeObjectURL(imageFrontPreview);
    }
    if (imageBackPreview) {
      URL.revokeObjectURL(imageBackPreview);
    }
    setEditingCheck(chk);
    setIsAddModalOpen(true);
    setCheckForm({
      customerId: chk.customer_id,
      amount: String(chk.amount || ''),
      imageFront: chk.image_front || '',
      imageBack: chk.image_back || '',
      imageFrontFile: null,
      imageBackFile: null,
      returnDate: chk.return_date || '',
      status: (chk.status as CheckStatus) || CHECK_STATUS_VALUES[0],
      notes: chk.notes || '',
    });
    setCustomerQuery(chk.customers?.name || '');
    setImageFrontPreview(null);
    setImageBackPreview(null);
  };

  const handleDelete = async (checkId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الشيك؟')) return;
    try {
      await deleteCheck(checkId);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'فشل حذف الشيك');
    }
  };

  const handleCustomerAdded = async (newCustomerId?: string) => {
    // Reload customers list to get the newly added customer
    const updatedCustomers = await getAllCustomers();
    setCustomers(updatedCustomers);
    
    // If customer ID is provided, select it automatically
    if (newCustomerId) {
      const newCustomer = updatedCustomers.find(
        (c) => (c.customer_id || c.CustomerID || c.id) === newCustomerId
      );
      if (newCustomer) {
        setCheckForm((prev) => ({ ...prev, customerId: newCustomerId }));
        setCustomerQuery(`${newCustomer.Name || newCustomer.name || ''} - ${newCustomer.Phone || newCustomer.phone || ''}`);
      }
    }
    
    setIsCustomerModalOpen(false);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'مع الشركة':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'في البنك':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'في المحل':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'في المخزن':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'سلم للزبون ولم يدفع':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'سلم للزبون وتم تسديد القيمة':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <AdminLayout>
      <div dir="rtl" className="space-y-4 sm:space-y-6 font-cairo">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">الشيكات الراجعة</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              إدارة ومتابعة الشيكات (تصفية، تحديث الحالة، إضافة جديدة)
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={loadData}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">تحديث</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex-1 sm:flex-none px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={18} />
              <span>إضافة شيك</span>
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 relative">
              <Search
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full border border-gray-300 rounded-lg py-2 pr-10 pl-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right font-semibold text-gray-900 text-sm sm:text-base"
                placeholder="بحث برقم الشيك أو الملاحظات أو اسم الزبون..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-600 flex-shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 sm:flex-none border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right font-semibold text-gray-900 text-sm sm:text-base min-w-[140px]"
              >
                <option value="">كل الحالات</option>
                {CHECK_STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm sm:text-base"
            >
              بحث
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        {checks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">في المخزن</div>
              <div className="text-lg sm:text-2xl font-bold text-purple-600">
                ₪{checks
                  .filter((chk) => chk.status === 'في المخزن')
                  .reduce((sum, chk) => sum + (chk.amount || 0), 0)
                  .toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {checks.filter((chk) => chk.status === 'في المخزن').length} شيك
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">في المحل</div>
              <div className="text-lg sm:text-2xl font-bold text-blue-600">
                ₪{checks
                  .filter((chk) => chk.status === 'في المحل')
                  .reduce((sum, chk) => sum + (chk.amount || 0), 0)
                  .toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {checks.filter((chk) => chk.status === 'في المحل').length} شيك
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-gray-600 mb-1">سلم للزبون ولم يدفع</div>
              <div className="text-lg sm:text-2xl font-bold text-red-600">
                ₪{checks
                  .filter((chk) => chk.status === 'سلم للزبون ولم يدفع')
                  .reduce((sum, chk) => sum + (chk.amount || 0), 0)
                  .toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {checks.filter((chk) => chk.status === 'سلم للزبون ولم يدفع').length} شيك
              </div>
            </div>
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-200 rounded-lg p-3 sm:p-4 text-white">
              <div className="text-xs sm:text-sm text-gray-300 mb-1">المجموع</div>
              <div className="text-lg sm:text-2xl font-bold">
                ₪{(() => {
                  const inWarehouse = checks
                    .filter((chk) => chk.status === 'في المخزن')
                    .reduce((sum, chk) => sum + (chk.amount || 0), 0);
                  const inShop = checks
                    .filter((chk) => chk.status === 'في المحل')
                    .reduce((sum, chk) => sum + (chk.amount || 0), 0);
                  const notPaid = checks
                    .filter((chk) => chk.status === 'سلم للزبون ولم يدفع')
                    .reduce((sum, chk) => sum + (chk.amount || 0), 0);
                  return (inWarehouse + inShop + notPaid).toFixed(2);
                })()}
              </div>
              <div className="text-xs text-gray-300 mt-1">
                {checks.filter((chk) => 
                  chk.status === 'في المخزن' || 
                  chk.status === 'في المحل' || 
                  chk.status === 'سلم للزبون ولم يدفع'
                ).length} شيك
              </div>
            </div>
          </div>
        )}

        {/* Desktop Table View */}
        <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-900" dir="rtl">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">رقم الشيك</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">الزبون</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المبلغ</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">تاريخ الإرجاع</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">صور</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجراءات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin" size={20} />
                        <span>جاري التحميل...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredChecks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      لا توجد بيانات
                    </td>
                  </tr>
                ) : (
                  filteredChecks.map((chk) => (
                    <tr key={chk.check_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{chk.check_id}</div>
                        {userMap.get(chk.created_by || chk.createdBy || chk.user_id || '') && (
                          <div className="text-xs text-gray-500 mt-1">
                            {userMap.get(chk.created_by || chk.createdBy || chk.user_id || '')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-gray-400 flex-shrink-0" />
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {chk.customers?.name || '—'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {chk.customers?.phone || chk.customer_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <DollarSign size={16} className="text-gray-400" />
                          <span className="font-bold text-gray-900">₪{(chk.amount || 0).toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <div className="flex items-center gap-1 text-gray-700">
                          <Calendar size={14} className="text-gray-400" />
                          <span>{formatDate(chk.return_date)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(chk.status)}`}>
                            {chk.status}
                          </span>
                          {getActionButtons(chk.status, chk.check_id).length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {getActionButtons(chk.status, chk.check_id).map((action, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleStatusChangeClick(chk.check_id, action.newStatus, action.label)}
                                  disabled={updatingStatus === chk.check_id}
                                  className={`text-xs px-2.5 py-1 border border-gray-300 rounded-md hover:bg-gray-100 hover:border-gray-400 transition-colors text-gray-900 font-medium ${
                                    updatingStatus === chk.check_id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                  }`}
                                  title={action.newStatus}
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          )}
                          {updatingStatus === chk.check_id && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Loader2 size={12} className="animate-spin" />
                              <span>جاري التحديث...</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {chk.image_front && (
                            <a
                              href={chk.image_front}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-xs"
                            >
                              <ImageIcon size={14} />
                              <span>الوجه</span>
                            </a>
                          )}
                          {chk.image_back && (
                            <a
                              href={chk.image_back}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-xs"
                            >
                              <FileText size={14} />
                              <span>الخلف</span>
                            </a>
                          )}
                          {!chk.image_front && !chk.image_back && (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewCheck(chk)}
                              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 transition-colors"
                            >
                              <Eye size={14} />
                              عرض
                            </button>
                            <button
                              onClick={() => openEditModal(chk)}
                              className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-1.5 transition-colors"
                            >
                              <Edit size={14} />
                              تعديل
                            </button>
                            {canAccountant && (
                              <button
                                onClick={() => handleDelete(chk.check_id)}
                                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1.5 transition-colors"
                              >
                                <Trash2 size={14} />
                                حذف
                              </button>
                            )}
                          </div>
                          {chk.notes && (
                            <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                              <span className="font-medium">ملاحظات:</span> {chk.notes}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <Loader2 className="animate-spin" size={20} />
                <span>جاري التحميل...</span>
              </div>
            </div>
          ) : filteredChecks.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              لا توجد بيانات
            </div>
          ) : (
            filteredChecks.map((chk) => (
              <div key={chk.check_id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                {/* Header */}
                <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileCheck size={18} className="text-gray-400" />
                      <span className="font-bold text-gray-900 text-base">{chk.check_id}</span>
                    </div>
                    {userMap.get(chk.created_by || chk.createdBy || chk.user_id || '') && (
                      <div className="text-xs text-gray-500 mb-1">
                        {userMap.get(chk.created_by || chk.createdBy || chk.user_id || '')}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Calendar size={14} className="text-gray-400" />
                      <span>{formatDate(chk.return_date)}</span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(chk.status)}`}>
                    {chk.status}
                  </span>
                </div>
                
                {/* Action Buttons */}
                {getActionButtons(chk.status, chk.check_id).length > 0 && (
                  <div className="mb-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-2">إجراءات الحالة</div>
                    <div className="flex flex-wrap gap-2">
                      {getActionButtons(chk.status, chk.check_id).map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleStatusChangeClick(chk.check_id, action.newStatus, action.label)}
                          disabled={updatingStatus === chk.check_id}
                          className={`text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-colors text-gray-900 font-medium ${
                            updatingStatus === chk.check_id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                    {updatingStatus === chk.check_id && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
                        <Loader2 size={12} className="animate-spin" />
                        <span>جاري التحديث...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Customer Info */}
                <div className="flex items-center gap-2 mb-3">
                  <User size={16} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm truncate">
                      {chk.customers?.name || '—'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {chk.customers?.phone || chk.customer_id}
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign size={16} className="text-gray-400" />
                  <span className="font-bold text-lg text-gray-900">₪{(chk.amount || 0).toFixed(2)}</span>
                </div>

                {/* Notes */}
                {chk.notes && (
                  <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">ملاحظات:</div>
                    <div className="text-sm text-gray-900">{chk.notes}</div>
                  </div>
                )}

                {/* Images */}
                {(chk.image_front || chk.image_back) && (
                  <div className="mb-3 flex items-center gap-2">
                    {chk.image_front && (
                      <a
                        href={chk.image_front}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs"
                      >
                        <ImageIcon size={14} />
                        <span>صورة الوجه</span>
                      </a>
                    )}
                    {chk.image_back && (
                      <a
                        href={chk.image_back}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs"
                      >
                        <FileText size={14} />
                        <span>صورة الخلف</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => handleViewCheck(chk)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors text-sm"
                  >
                    <Eye size={16} />
                    <span>عرض</span>
                  </button>
                  <button
                    onClick={() => openEditModal(chk)}
                    className="flex-1 px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center justify-center gap-2 transition-colors text-sm"
                  >
                    <Edit size={16} />
                    <span>تعديل</span>
                  </button>
                  {canAccountant && (
                    <button
                      onClick={() => handleDelete(chk.check_id)}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 transition-colors text-sm"
                    >
                      <Trash2 size={16} />
                      <span>حذف</span>
                    </button>
                  )}
                </div>
                
                {/* Notes - Mobile only */}
                {chk.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">ملاحظات:</div>
                    <div className="text-sm text-gray-900">{chk.notes}</div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add Check Modal */}
        {isAddModalOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => {
              // Clean up object URLs if any
              if (imageFrontPreview) {
                URL.revokeObjectURL(imageFrontPreview);
              }
              if (imageBackPreview) {
                URL.revokeObjectURL(imageBackPreview);
              }
              setIsAddModalOpen(false);
              setEditingCheck(null);
              setImageFrontPreview(null);
              setImageBackPreview(null);
            }}
          >
            <div
              className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between z-10">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                  {editingCheck ? 'تعديل شيك راجع' : 'إضافة شيك راجع'}
                </h3>
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingCheck(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 p-1"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      الزبون
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      title="إضافة زبون جديد"
                    >
                      <UserPlus size={14} />
                      <span>إضافة زبون</span>
                    </button>
                  </div>
                  <div className="relative" ref={customerDropdownRef}>
                    <input
                      type="text"
                      value={customerQuery}
                      onChange={(e) => {
                        setCustomerQuery(e.target.value);
                        setIsCustomerDropdownOpen(true);
                      }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      placeholder="ابحث باسم الزبون أو الهاتف"
                      className="w-full border border-gray-300 text-gray-900 font-semibold rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
                    />
                    {isCustomerDropdownOpen && filteredCustomers.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredCustomers.map((c) => (
                          <button
                            key={c.CustomerID || c.customer_id}
                            type="button"
                            onClick={() => {
                              setCheckForm({ ...checkForm, customerId: c.CustomerID || c.customer_id });
                              setCustomerQuery(`${c.Name || c.name || ''} - ${c.Phone || c.phone || ''}`);
                              setIsCustomerDropdownOpen(false);
                            }}
                            className="w-full text-right px-4 py-2 hover:bg-gray-100 text-gray-900"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col gap-1">
                                  <span className="text-sm font-medium">{c.Name || c.name}</span>
                                  <span className="text-xs text-gray-600" dir="rtl">
                                    {c.Phone || c.phone || '—'} {c.ShamelNo || c['Shamel No'] || c.shamel_no ? `• (${c.ShamelNo || c['Shamel No'] || c.shamel_no})` : ''}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    المبلغ
                  </label>
                  <input
                    type="number"
                    value={checkForm.amount}
                    onChange={(e) => setCheckForm({ ...checkForm, amount: e.target.value })}
                    className="w-full border border-gray-300 text-gray-900 font-semibold rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      صورة الوجه
                    </label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <label className="flex-1 cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              // Clean up previous preview
                              if (imageFrontPreview) {
                                URL.revokeObjectURL(imageFrontPreview);
                              }
                              if (file) {
                                setImageFrontPreview(URL.createObjectURL(file));
                              } else {
                                setImageFrontPreview(null);
                              }
                              setCheckForm({ ...checkForm, imageFrontFile: file });
                            }}
                            className="hidden"
                            id="image-front-file"
                          />
                          <div className="w-full border border-gray-300 text-gray-900 font-semibold rounded-lg py-2 px-3 focus-within:outline-none focus-within:ring-2 focus-within:ring-gray-900 text-right text-sm bg-white hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                            <ImageIcon size={18} />
                            <span>رفع أو تصوير</span>
                          </div>
                        </label>
                        {checkForm.imageFrontFile && (
                          <button
                            type="button"
                            onClick={() => {
                              if (imageFrontPreview) {
                                URL.revokeObjectURL(imageFrontPreview);
                              }
                              setCheckForm({ ...checkForm, imageFrontFile: null });
                              setImageFrontPreview(null);
                              const input = document.getElementById('image-front-file') as HTMLInputElement;
                              if (input) input.value = '';
                            }}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="إزالة الصورة"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                      {imageFrontPreview && (
                        <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          <img
                            src={imageFrontPreview}
                            alt="معاينة صورة الوجه"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      {checkForm.imageFront && !checkForm.imageFrontFile && (
                        <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          <img
                            src={checkForm.imageFront}
                            alt="صورة الوجه الحالية"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <input
                        type="text"
                        value={checkForm.imageFront}
                        onChange={(e) => setCheckForm({ ...checkForm, imageFront: e.target.value })}
                        className="w-full border border-gray-300 text-gray-900 font-semibold rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right text-sm"
                        placeholder="أو الصق رابط الصورة"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      صورة الخلف
                    </label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <label className="flex-1 cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              // Clean up previous preview
                              if (imageBackPreview) {
                                URL.revokeObjectURL(imageBackPreview);
                              }
                              if (file) {
                                setImageBackPreview(URL.createObjectURL(file));
                              } else {
                                setImageBackPreview(null);
                              }
                              setCheckForm({ ...checkForm, imageBackFile: file });
                            }}
                            className="hidden"
                            id="image-back-file"
                          />
                          <div className="w-full border border-gray-300 text-gray-900 font-semibold rounded-lg py-2 px-3 focus-within:outline-none focus-within:ring-2 focus-within:ring-gray-900 text-right text-sm bg-white hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                            <ImageIcon size={18} />
                            <span>رفع أو تصوير</span>
                          </div>
                        </label>
                        {checkForm.imageBackFile && (
                          <button
                            type="button"
                            onClick={() => {
                              if (imageBackPreview) {
                                URL.revokeObjectURL(imageBackPreview);
                              }
                              setCheckForm({ ...checkForm, imageBackFile: null });
                              setImageBackPreview(null);
                              const input = document.getElementById('image-back-file') as HTMLInputElement;
                              if (input) input.value = '';
                            }}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="إزالة الصورة"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                      {imageBackPreview && (
                        <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          <img
                            src={imageBackPreview}
                            alt="معاينة صورة الخلف"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      {checkForm.imageBack && !checkForm.imageBackFile && (
                        <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          <img
                            src={checkForm.imageBack}
                            alt="صورة الخلف الحالية"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <input
                        type="text"
                        value={checkForm.imageBack}
                        onChange={(e) => setCheckForm({ ...checkForm, imageBack: e.target.value })}
                        className="w-full border border-gray-300 text-gray-900 font-semibold rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right text-sm"
                        placeholder="أو الصق رابط الصورة"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      تاريخ الإرجاع
                    </label>
                    <input
                      type="date"
                      value={checkForm.returnDate}
                      onChange={(e) => setCheckForm({ ...checkForm, returnDate: e.target.value })}
                      className="w-full border border-gray-300 text-gray-900 font-semibold rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      الحالة
                    </label>
                    <select
                      value={checkForm.status}
                      onChange={(e) => setCheckForm({ ...checkForm, status: e.target.value as CheckStatus })}
                      className="w-full border border-gray-300 text-gray-900 font-semibold rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
                    >
                      {CHECK_STATUS_VALUES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ملاحظات
                  </label>
                  <textarea
                    value={checkForm.notes}
                    onChange={(e) => setCheckForm({ ...checkForm, notes: e.target.value })}
                    rows={3}
                    className="w-full border border-gray-300 text-gray-900 font-semibold rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      // Clean up object URLs if any
                      if (imageFrontPreview) {
                        URL.revokeObjectURL(imageFrontPreview);
                      }
                      if (imageBackPreview) {
                        URL.revokeObjectURL(imageBackPreview);
                      }
                      setIsAddModalOpen(false);
                      setEditingCheck(null);
                      setImageFrontPreview(null);
                      setImageBackPreview(null);
                    }}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                    disabled={checkSaving}
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSaveCheck}
                    disabled={checkSaving}
                    className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors font-semibold"
                  >
                    {checkSaving ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <span>{editingCheck ? 'تحديث الشيك' : 'حفظ الشيك'}</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Check Modal */}
        {viewingCheck && (
          <div 
            className="fixed inset-0 md:right-64 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4" 
            dir="rtl"
            onClick={closeViewCheck}
          >
            <div 
              className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 z-10 flex-shrink-0">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">عرض الشيك</h2>
                  <p className="text-sm text-gray-600">#{viewingCheck.check_id}</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => openEditModal(viewingCheck)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <Edit size={16} />
                    <span className="hidden sm:inline">تعديل</span>
                  </button>
                  <button
                    onClick={closeViewCheck}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X size={20} className="text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-6 min-h-0">
                <div className="space-y-4 sm:space-y-6">
                  {/* Customer Info */}
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3 sm:mb-4">معلومات الزبون</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1">اسم الزبون</label>
                        <p className="text-sm sm:text-base text-gray-900 font-medium">{viewingCheck.customers?.name || '—'}</p>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1">رقم الهاتف</label>
                        <p className="text-sm sm:text-base text-gray-900">{viewingCheck.customers?.phone || '—'}</p>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1">رقم الزبون</label>
                        <p className="text-sm sm:text-base text-gray-900">{viewingCheck.customer_id}</p>
                      </div>
                      {viewingCheck.customers?.balance !== undefined && (
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1">الرصيد</label>
                          <p className="text-sm sm:text-base text-gray-900">₪{(viewingCheck.customers.balance || 0).toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Check Info */}
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3 sm:mb-4">معلومات الشيك</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1">رقم الشيك</label>
                        <p className="text-sm sm:text-base text-gray-900 font-bold">{viewingCheck.check_id}</p>
                        {userMap.get(viewingCheck.created_by || viewingCheck.createdBy || viewingCheck.user_id || '') && (
                          <p className="text-xs text-gray-500 mt-1">
                            {userMap.get(viewingCheck.created_by || viewingCheck.createdBy || viewingCheck.user_id || '')}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1">المبلغ</label>
                        <p className="text-sm sm:text-base text-gray-900 font-bold">₪{(viewingCheck.amount || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1">تاريخ الإرجاع</label>
                        <p className="text-sm sm:text-base text-gray-900">{formatDate(viewingCheck.return_date)}</p>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1">الحالة</label>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(viewingCheck.status)}`}>
                          {viewingCheck.status}
                        </span>
                      </div>
                      {viewingCheck.created_at && (
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1">تاريخ الإنشاء</label>
                          <p className="text-sm sm:text-base text-gray-900">{formatDate(viewingCheck.created_at)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {viewingCheck.notes && (
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3 sm:mb-4">ملاحظات</h3>
                      <p className="text-sm sm:text-base text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">{viewingCheck.notes}</p>
                    </div>
                  )}

                  {/* Images */}
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-3 sm:mb-4">صور الشيك</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {viewingCheck.image_front && (
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-2">صورة الوجه</label>
                          <div className="relative w-full h-48 sm:h-64 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                            <img
                              src={viewingCheck.image_front}
                              alt="صورة الوجه"
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <a
                              href={viewingCheck.image_front}
                              target="_blank"
                              rel="noreferrer"
                              className="absolute top-2 left-2 px-2 py-1 bg-white/80 hover:bg-white rounded text-xs flex items-center gap-1"
                            >
                              <ImageIcon size={14} />
                              <span>فتح</span>
                            </a>
                          </div>
                        </div>
                      )}
                      {viewingCheck.image_back && (
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-2">صورة الخلف</label>
                          <div className="relative w-full h-48 sm:h-64 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                            <img
                              src={viewingCheck.image_back}
                              alt="صورة الخلف"
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <a
                              href={viewingCheck.image_back}
                              target="_blank"
                              rel="noreferrer"
                              className="absolute top-2 left-2 px-2 py-1 bg-white/80 hover:bg-white rounded text-xs flex items-center gap-1"
                            >
                              <FileText size={14} />
                              <span>فتح</span>
                            </a>
                          </div>
                        </div>
                      )}
                      {!viewingCheck.image_front && !viewingCheck.image_back && (
                        <div className="col-span-full text-center py-8 text-gray-500">
                          <ImageIcon size={48} className="mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">لا توجد صور</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status Change Modal */}
        {statusChangeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6 space-y-3 sm:space-y-4 max-h-[95vh] overflow-y-auto">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">تغيير الحالة</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">من</label>
                  <p className="text-sm sm:text-base text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{statusChangeModal.currentStatus}</p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">إلى</label>
                  <p className="text-sm sm:text-base text-gray-900 bg-blue-50 px-3 py-2 rounded-lg font-medium">{statusChangeModal.newStatus}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleStatusChangeCancel}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm sm:text-base"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleStatusChangeConfirm}
                  disabled={updatingStatus === statusChangeModal.checkId}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  {updatingStatus === statusChangeModal.checkId ? (
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
