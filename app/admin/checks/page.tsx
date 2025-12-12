'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
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

  const filteredChecks = useMemo(() => {
    if (!search.trim()) return checks;
    const words = search
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    return checks.filter((chk) => {
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
  }, [checks, search]);

  const filteredCustomers = useMemo(() => {
    if (!customerQuery.trim()) return customers;
    const words = customerQuery
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    return customers.filter((c) => {
      const hay = `${c.Name || c.name || ''} ${c.Phone || c.phone || ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [customers, customerQuery]);

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
    loadCustomers();
  }, []);

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

  const openEditModal = (chk: CheckRecord) => {
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

  return (
    <AdminLayout>
      <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الشيكات الراجعة</h1>
          <p className="text-sm text-gray-600">
            إدارة ومتابعة الشيكات (تصفية، تحديث الحالة، إضافة جديدة)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-1"
          >
            <RefreshCw size={16} />
            تحديث
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-2"
          >
            <Plus size={16} />
            إضافة شيك
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="flex-1 relative">
            <Search
              size={18}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full border border-gray-300 rounded-lg py-2 pr-10 pl-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right font-semibold text-gray-900"
              placeholder="بحث برقم الشيك أو الملاحظات"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-600" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right font-semibold text-gray-900"
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
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            بحث
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-gray-900" dir="rtl">
            <thead className="bg-gray-100 text-gray-700 text-right">
              <tr>
                <th className="px-4 py-3 text-right">رقم الشيك</th>
                <th className="px-4 py-3 text-right min-w-[200px]">الزبون</th>
                <th className="px-4 py-3 text-right">المبلغ</th>
                <th className="px-4 py-3 text-right min-w-[140px]">تاريخ الإرجاع</th>
                <th className="px-4 py-3 text-right">الحالة</th>
                <th className="px-4 py-3 text-right">ملاحظات</th>
                <th className="px-4 py-3 text-right">صور</th>
                <th className="px-4 py-3 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={18} />
                      جاري التحميل...
                    </div>
                  </td>
                </tr>
              ) : filteredChecks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">
                    لا توجد بيانات
                  </td>
                </tr>
              ) : (
                filteredChecks.map((chk) => (
                  <tr key={chk.check_id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-semibold">{chk.check_id}</td>
                    <td className="px-4 py-3 min-w-[200px]">
                      <div className="text-sm font-semibold">
                        {chk.customers?.name || '—'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {chk.customers?.phone || chk.customer_id}
                      </div>
                    </td>
                    <td className="px-4 py-3">₪{(chk.amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 min-w-[140px]">{chk.return_date || '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={chk.status}
                        onChange={(e) =>
                          handleStatusChange(chk.check_id, e.target.value as CheckStatus)
                        }
                        className="border border-gray-300 rounded-lg py-1 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      >
                        {CHECK_STATUS_VALUES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">{chk.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-blue-600 text-xs">
                        {chk.image_front && (
                          <a
                            href={chk.image_front}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 hover:underline"
                          >
                            <ImageIcon size={14} />
                            الوجه
                          </a>
                        )}
                        {chk.image_back && (
                          <a
                            href={chk.image_back}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 hover:underline"
                          >
                            <FileText size={14} />
                            الخلف
                          </a>
                        )}
                        {!chk.image_front && !chk.image_back && <span>—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(chk)}
                          className="px-2 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 flex items-center gap-1"
                        >
                          <Edit size={14} />
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDelete(chk.check_id)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"
                        >
                          <Trash2 size={14} />
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Check Modal */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {editingCheck ? 'تعديل شيك راجع' : 'إضافة شيك راجع'}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingCheck(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الزبون
                </label>
                <input
                  type="text"
                  value={customerQuery}
                  onChange={(e) => {
                    setCustomerQuery(e.target.value);
                  }}
                  placeholder="ابحث باسم الزبون أو الهاتف"
                  className="w-full border border-gray-400 text-gray-900 font-semibold rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
                />
                <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredCustomers.slice(0, 50).map((c) => (
                    <button
                      key={c.CustomerID || c.customer_id}
                      type="button"
                      onClick={() => {
                        setCheckForm({ ...checkForm, customerId: c.CustomerID || c.customer_id });
                        setCustomerQuery(`${c.Name || c.name || ''} - ${c.Phone || c.phone || ''}`);
                      }}
                      className="w-full text-right px-3 py-2 hover:bg-gray-100 text-sm text-gray-900"
                    >
                      <div className="font-semibold">{c.Name || c.name}</div>
                      <div className="text-xs text-gray-600">{c.Phone || c.phone}</div>
                      {c.Balance !== undefined && (
                        <div className="text-xs text-gray-500">الرصيد: {c.Balance}</div>
                      )}
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-500">لا نتائج</div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  المبلغ
                </label>
                <input
                  type="number"
                  value={checkForm.amount}
                  onChange={(e) => setCheckForm({ ...checkForm, amount: e.target.value })}
                  className="w-full border border-gray-400 text-gray-900 font-semibold rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    صورة الوجه (رفع أو رابط)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setCheckForm({ ...checkForm, imageFrontFile: e.target.files?.[0] || null })
                    }
                  className="w-full border border-gray-400 text-gray-900 font-semibold rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
                  />
                  <input
                    type="text"
                    value={checkForm.imageFront}
                    onChange={(e) => setCheckForm({ ...checkForm, imageFront: e.target.value })}
                  className="mt-2 w-full border border-gray-400 text-gray-900 font-semibold rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
                    placeholder="أو الصق رابط الصورة"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    صورة الخلف (رفع أو رابط)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setCheckForm({ ...checkForm, imageBackFile: e.target.files?.[0] || null })
                    }
                  className="w-full border border-gray-400 text-gray-900 font-semibold rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
                  />
                  <input
                    type="text"
                    value={checkForm.imageBack}
                    onChange={(e) => setCheckForm({ ...checkForm, imageBack: e.target.value })}
                  className="mt-2 w-full border border-gray-400 text-gray-900 font-semibold rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
                    placeholder="أو الصق رابط الصورة"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    تاريخ الإرجاع
                  </label>
                  <input
                    type="date"
                    value={checkForm.returnDate}
                    onChange={(e) => setCheckForm({ ...checkForm, returnDate: e.target.value })}
                  className="w-full border border-gray-400 text-gray-900 font-semibold rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الحالة
                  </label>
                  <select
                    value={checkForm.status}
                    onChange={(e) => setCheckForm({ ...checkForm, status: e.target.value as CheckStatus })}
                  className="w-full border border-gray-400 text-gray-900 font-semibold rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ملاحظات
                </label>
                <textarea
                  value={checkForm.notes}
                  onChange={(e) => setCheckForm({ ...checkForm, notes: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-400 text-gray-900 font-semibold rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingCheck(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={checkSaving}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveCheck}
                  disabled={checkSaving}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {checkSaving ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      جاري الحفظ...
                    </>
                  ) : (
                    editingCheck ? 'تحديث الشيك' : 'حفظ الشيك'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}

