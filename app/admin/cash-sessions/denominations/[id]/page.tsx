'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save, Loader2, Edit, X } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  getCashSession,
  getCashDenominationsBySession,
  saveCashDenomination,
  updateCashDenomination,
  deleteCashDenomination,
} from '@/lib/api';

interface Denomination {
  DenomID?: string;
  Currency: 'شيكل' | 'دينار أردني' | 'دولار' | 'يورو';
  Denomination: number;
  Qty: number;
}

const currencyOptions: ('شيكل' | 'دينار أردني' | 'دولار' | 'يورو')[] = ['شيكل', 'دينار أردني', 'دولار', 'يورو'];

export default function CashDenominationsPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params?.id as string;
  const [session, setSession] = useState<any>(null);
  const [denominations, setDenominations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDenom, setEditingDenom] = useState<Denomination | null>(null);
  const [newDenom, setNewDenom] = useState<Denomination>({
    Currency: 'شيكل',
    Denomination: 0,
    Qty: 0,
  });

  useEffect(() => {
    if (sessionId) {
      loadData();
    }
  }, [sessionId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sessionData, denomsData] = await Promise.all([
        getCashSession(sessionId),
        getCashDenominationsBySession(sessionId),
      ]);
      setSession(sessionData);
      setDenominations(denomsData);
    } catch (error: any) {
      console.error('[CashDenominationsPage] Failed to load data:', error);
      alert(error?.message || 'فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDenom = async () => {
    if (!newDenom.Denomination || newDenom.Qty <= 0) {
      alert('يرجى إدخال الفئة والعدد (يجب أن يكون العدد أكبر من صفر)');
      return;
    }

    try {
      setSaving(true);
      await saveCashDenomination({
        CashSessionID: sessionId,
        Currency: newDenom.Currency,
        Denomination: newDenom.Denomination,
        Qty: newDenom.Qty,
      });
      setNewDenom({ Currency: 'شيكل', Denomination: 0, Qty: 0 });
      await loadData();
    } catch (error: any) {
      console.error('[CashDenominationsPage] Failed to save denomination:', error);
      alert(error?.message || 'فشل حفظ الفئة');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (denom: any) => {
    setEditingId(denom.DenomID);
    setEditingDenom({
      Currency: denom.Currency,
      Denomination: denom.Denomination,
      Qty: denom.Qty,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingDenom(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingDenom || !editingDenom.Denomination || editingDenom.Qty <= 0) {
      alert('يرجى إدخال الفئة والعدد (يجب أن يكون العدد أكبر من صفر)');
      return;
    }

    try {
      setSaving(true);
      await updateCashDenomination(editingId, {
        Currency: editingDenom.Currency,
        Denomination: editingDenom.Denomination,
        Qty: editingDenom.Qty,
      });
      setEditingId(null);
      setEditingDenom(null);
      await loadData();
    } catch (error: any) {
      console.error('[CashDenominationsPage] Failed to update denomination:', error);
      alert(error?.message || 'فشل تحديث الفئة');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (denomId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفئة؟')) {
      return;
    }

    try {
      setDeletingId(denomId);
      await deleteCashDenomination(denomId);
      await loadData();
    } catch (error: any) {
      console.error('[CashDenominationsPage] Failed to delete denomination:', error);
      alert(error?.message || 'فشل حذف الفئة');
    } finally {
      setDeletingId(null);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' ₪';
  };

  const totalByCurrency = denominations.reduce((acc: any, d: any) => {
    const key = d.Currency;
    if (!acc[key]) {
      acc[key] = { total: 0, count: 0 };
    }
    acc[key].total += d.Denomination * d.Qty;
    acc[key].count += d.Qty;
    return acc;
  }, {});

  const grandTotal = denominations.reduce((sum, d) => sum + d.Denomination * d.Qty, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {loading && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <Loader2 size={32} className="inline-block animate-spin text-gray-900 mb-4" />
            <p className="text-gray-900 font-bold">جاري التحميل...</p>
          </div>
        )}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-900"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">عد الفئات النقدية</h1>
            <p className="text-sm font-bold text-gray-900 mt-1">
              الجلسة: {session?.CashSessionID} - التاريخ: {session?.Date}
            </p>
          </div>
        </div>

      {/* Add New Denomination */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4 text-gray-900">إضافة فئة نقدية جديدة</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">العملة *</label>
            <select
              value={newDenom.Currency}
              onChange={(e) => setNewDenom({ ...newDenom, Currency: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
            >
              {currencyOptions.map((curr) => (
                <option key={curr} value={curr}>
                  {curr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">الفئة *</label>
            <input
              type="number"
              step="0.01"
              required
              value={newDenom.Denomination || ''}
              onChange={(e) =>
                setNewDenom({ ...newDenom, Denomination: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
              placeholder="مثال: 100"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">العدد *</label>
            <input
              type="number"
              required
              min="0"
              step="0.001"
              value={newDenom.Qty || ''}
              onChange={(e) => setNewDenom({ ...newDenom, Qty: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
              placeholder="مثال: 5 أو 4.6"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddDenom}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
              <span>إضافة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Denominations List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">الفئات المدخلة</h2>
        </div>
        {denominations.length === 0 ? (
          <div className="p-6 text-center font-bold text-gray-900">
            لا توجد فئات نقدية مدخلة بعد
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-900 uppercase">
                    العملة
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-900 uppercase">
                    الفئة
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-900 uppercase">
                    العدد
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-900 uppercase">
                    المبلغ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-900 uppercase">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {denominations.map((denom) => (
                  <tr key={denom.DenomID} className="hover:bg-gray-50">
                    {editingId === denom.DenomID ? (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={editingDenom?.Currency || 'شيكل'}
                            onChange={(e) =>
                              setEditingDenom({
                                ...editingDenom!,
                                Currency: e.target.value as any,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
                          >
                            {currencyOptions.map((curr) => (
                              <option key={curr} value={curr}>
                                {curr}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            value={editingDenom?.Denomination || ''}
                            onChange={(e) =>
                              setEditingDenom({
                                ...editingDenom!,
                                Denomination: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={editingDenom?.Qty || ''}
                            onChange={(e) =>
                              setEditingDenom({
                                ...editingDenom!,
                                Qty: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-bold"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          {editingDenom
                            ? formatMoney(editingDenom.Denomination * editingDenom.Qty)
                            : ''}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleSaveEdit}
                              disabled={saving}
                              className="text-green-600 hover:text-green-900 p-1 disabled:opacity-50"
                              title="حفظ"
                            >
                              {saving ? (
                                <Loader2 size={18} className="animate-spin" />
                              ) : (
                                <Save size={18} />
                              )}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={saving}
                              className="text-gray-600 hover:text-gray-900 p-1 disabled:opacity-50"
                              title="إلغاء"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          {denom.Currency}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          {denom.Denomination}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          {denom.Qty}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          {formatMoney(denom.Denomination * denom.Qty)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(denom)}
                              className="text-blue-600 hover:text-blue-900 p-1"
                              title="تعديل"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(denom.DenomID)}
                              disabled={deletingId === denom.DenomID}
                              className="text-red-600 hover:text-red-900 p-1 disabled:opacity-50"
                              title="حذف"
                            >
                              {deletingId === denom.DenomID ? (
                                <Loader2 size={18} className="animate-spin" />
                              ) : (
                                <Trash2 size={18} />
                              )}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                    المجموع الكلي
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    {formatMoney(grandTotal)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      </div>
    </AdminLayout>
  );
}

