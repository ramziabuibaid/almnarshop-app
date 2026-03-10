'use client';

import { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  getGroomOffers,
  deleteGroomOffer,
  updateGroomOfferStatus,
  createQuoteFromOffer,
} from '@/lib/api';
import {
  Loader2,
  FileText,
  Search,
  Edit,
  Trash2,
  X,
  UserPlus,
} from 'lucide-react';

interface Quotation {
  QuotationID: string;
  Date: string;
  CustomerID: string | null;
  customer?: { name?: string; phone?: string; address?: string; shamelNo?: string };
  Notes?: string;
  Status: string;
  totalAmount?: number;
  CreatedAt?: string;
  CreatedBy?: string;
  created_by?: string;
  createdBy?: string;
  user_id?: string;
  is_groom_offer?: boolean;
  groom_offer_title?: string;
}

const STATUS_OPTIONS = [
  'فعال',
  'غير فعال',
  'مسودة',
];

export default function GroomOffersPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const canAccountant = admin?.is_super_admin || admin?.permissions?.accountant === true;

  const [offers, setOffers] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('الكل');

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());

  useLayoutEffect(() => {
    document.title = 'إدارة عروض العرسان';
  }, []);

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getGroomOffers();
      setOffers(result);
    } catch (err: any) {
      console.error('[GroomOffers] Failed to load offers:', err);
      setError(err?.message || 'فشل تحميل عروض العرسان');
      setOffers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (quotationId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
    setDeletingId(quotationId);
    try {
      await deleteGroomOffer(quotationId);
      setOffers(prev => prev.filter(q => q.QuotationID !== quotationId));
    } catch (err: any) {
      console.error('Failed to delete offer:', err);
      alert(err?.message || 'فشل حذف العرض');
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusChange = async (quotationId: string, newStatus: string) => {
    setUpdatingStatusId(quotationId);
    try {
      await updateGroomOfferStatus(quotationId, newStatus);
      setOffers(prev => prev.map(q => q.QuotationID === quotationId ? { ...q, Status: newStatus } : q));
    } catch (err: any) {
      console.error('Failed to update status:', err);
      alert(err?.message || 'فشل تحديث حالة العرض');
      await loadOffers(); // Reload
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleCreateQuoteForCustomer = async (offerId: string) => {
    if (!confirm('سيتم إنشاء عرض سعر عادي جديد مبني على هذا العرض لتحصيصه لزبون معين. هل تريد المتابعة؟')) return;
    setCreatingId(offerId);
    try {
      const newQuote = await createQuoteFromOffer(offerId, admin?.id || undefined);
      // Navigate to the newly created standard quote
      router.push(`/admin/quotations/${newQuote.QuotationID}`);
    } catch (err: any) {
      console.error('Failed to create quote:', err);
      alert(err?.message || 'فشل إنشاء عرض السعر');
    } finally {
      setCreatingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return '—';
    }
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (!amount || amount === 0) return '₪0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const filteredOffers = useMemo(() => {
    let filtered = offers;

    if (searchQuery.trim()) {
      const searchWords = searchQuery.toLowerCase().trim().split(/\s+/).filter(word => word.length > 0);
      filtered = filtered.filter((offer) => {
        const id = String(offer.QuotationID || '').toLowerCase();
        const title = String(offer.groom_offer_title || '').toLowerCase();
        const notes = String(offer.Notes || '').toLowerCase();
        const searchableText = `${id} ${title} ${notes}`;
        return searchWords.every(word => searchableText.includes(word));
      });
    }

    if (statusFilter && statusFilter !== 'الكل') {
      filtered = filtered.filter((offer) => offer.Status === statusFilter);
    }

    return filtered;
  }, [offers, searchQuery, statusFilter]);

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

  return (
    <AdminLayout>
      <div className="space-y-6 font-cairo" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 font-cairo">إدارة عروض العرسان</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base font-cairo">
              إدارة الباقات والعروض العامة المخصصة للعرسان
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
              <input
                type="text"
                placeholder="بحث..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100 font-cairo"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 font-cairo whitespace-nowrap">الحالة:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 sm:flex-none px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100 font-cairo"
              >
                <option value="الكل">الكل</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Offers List */}
        {filteredOffers.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-8 sm:p-12 text-center">
            <FileText size={48} className="text-purple-300 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg font-cairo">
              لا توجد عروض عرسان حالياً. استخدم علامة (استنساخ كعرض عرسان) من قائمة العروض السعرية العادية لإنشاء عرض.
            </p>
          </div>
        ) : (
          <div className="hidden md:block bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider font-cairo">
                      العنوان
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider font-cairo">
                      التاريخ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider font-cairo">
                      الحالة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider font-cairo">
                      السعر
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider font-cairo">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200">
                  {filteredOffers.map((offer) => (
                    <tr key={offer.QuotationID} className="hover:bg-purple-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100 font-cairo mb-1">
                          {offer.groom_offer_title || 'عرض بدون عنوان'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-cairo">
                          #{offer.QuotationID}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-cairo">
                        {formatDate(offer.Date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {canAccountant ? (
                          <select
                            value={offer.Status}
                            onChange={(e) => handleStatusChange(offer.QuotationID, e.target.value)}
                            disabled={updatingStatusId === offer.QuotationID}
                            className={`px-2 py-1 text-xs font-semibold rounded-lg border border-gray-300 dark:border-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer font-cairo ${updatingStatusId === offer.QuotationID ? 'opacity-50' : ''
                              }`}
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-slate-700/50 text-gray-800 dark:text-gray-200 font-cairo">
                            {offer.Status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100 font-cairo">
                        {formatCurrency(offer.totalAmount || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleCreateQuoteForCustomer(offer.QuotationID)}
                            disabled={creatingId === offer.QuotationID}
                            className="text-white bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded-lg flex items-center gap-1 font-cairo disabled:opacity-50"
                            title="إنشاء عرض سعر جديد مبني على هذه الباقة"
                          >
                            {creatingId === offer.QuotationID ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                            إنشاء لزبون
                          </button>
                          <button
                            onClick={() => router.push(`/admin/groom-offers/${offer.QuotationID}`)}
                            className="text-blue-600 hover:text-blue-900 flex items-center gap-1 font-cairo"
                          >
                            <Edit size={16} />
                            تعديل القالب
                          </button>
                          {canAccountant && (
                            <button
                              onClick={() => handleDelete(offer.QuotationID)}
                              disabled={deletingId === offer.QuotationID}
                              className="text-red-600 dark:text-red-400 hover:text-red-900 flex items-center gap-1 font-cairo disabled:opacity-50"
                            >
                              {deletingId === offer.QuotationID ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                              حذف
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
