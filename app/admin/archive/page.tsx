'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import CustomerSelect from '@/components/admin/CustomerSelect';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  ArchiveDocumentType,
  buildArchiveFileName,
  createArchiveDocument,
  getAllCustomers,
  searchArchiveDocuments,
  trackArchiveOpen,
  uploadArchiveFileToGoogleDrive,
} from '@/lib/api';
import { FileArchive, Loader2, Search, Upload, ExternalLink } from 'lucide-react';

const DOC_TYPES: { value: ArchiveDocumentType; label: string }[] = [
  { value: 'purchase_invoice', label: 'فواتير المشتريات' },
  { value: 'sales_invoice', label: 'فواتير المبيعات' },
  { value: 'receipt', label: 'سندات القبض' },
  { value: 'payment', label: 'سندات الصرف' },
  { value: 'bank_statement', label: 'كشوفات البنك' },
  { value: 'journal_voucher', label: 'سندات القيد' },
  { value: 'company_document', label: 'وثائق الشركة المهمة' },
];

type ArchiveRow = {
  id: string;
  document_type: ArchiveDocumentType;
  title: string;
  document_date: string;
  reference_no?: string;
  supplier_name?: string;
  customer_id?: string;
  linked_table?: string;
  linked_record_id?: string;
  drive_web_view_link: string;
  document_status: 'original' | 'copy' | 'cancelled';
  created_at: string;
};

export default function ArchivePage() {
  const { admin } = useAdminAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<ArchiveDocumentType | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<ArchiveDocumentType>('purchase_invoice');
  const [title, setTitle] = useState('');
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [linkedTable, setLinkedTable] = useState('');
  const [linkedRecordId, setLinkedRecordId] = useState('');
  const [documentStatus, setDocumentStatus] = useState<'original' | 'copy' | 'cancelled'>('original');
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');

  const typeMap = useMemo(() => {
    return new Map(DOC_TYPES.map((d) => [d.value, d.label]));
  }, []);

  const isSupplierCustomer = (c: any) => {
    const customerType = String(c?.Type || c?.type || '').trim().toLowerCase();
    return customerType === 'مورد' || customerType === 'supplier';
  };

  const supplierCustomers = useMemo(() => customers.filter(isSupplierCustomer), [customers]);
  const selectedSupplier = useMemo(
    () => supplierCustomers.find((c) => (c.customer_id || c.CustomerID || c.id) === supplierId),
    [supplierCustomers, supplierId]
  );
  const selectedFilterSupplier = useMemo(
    () => supplierCustomers.find((c) => (c.customer_id || c.CustomerID || c.id) === filterSupplierId),
    [supplierCustomers, filterSupplierId]
  );

  const loadRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchArchiveDocuments({
        query,
        documentType: filterType,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        customerId: filterCustomerId || undefined,
        supplierName: selectedFilterSupplier?.name || selectedFilterSupplier?.Name || undefined,
      });
      setRows(data as ArchiveRow[]);
    } catch (e: any) {
      setError(e?.message || 'فشل تحميل الأرشيف');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setDocumentType('purchase_invoice');
    setTitle('');
    setDocumentDate(new Date().toISOString().slice(0, 10));
    setReferenceNo('');
    setSupplierId('');
    setCustomerId('');
    setLinkedTable('');
    setLinkedRecordId('');
    setDocumentStatus('original');
    setTagsInput('');
    setNotes('');
  };

  useEffect(() => {
    document.title = 'الأرشيف';
    loadRows();
    getAllCustomers().then(setCustomers).catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError('يرجى اختيار ملف للأرشفة');
      return;
    }
    if (!title.trim()) {
      setError('العنوان مطلوب');
      return;
    }
    if (!documentDate) {
      setError('تاريخ المستند مطلوب');
      return;
    }
    if (documentType === 'purchase_invoice' && !selectedSupplier) {
      setError('يجب اختيار المورد من قائمة الموردين');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('حجم الملف يجب أن لا يتجاوز 15MB');
      return;
    }

    setSaving(true);
    try {
      const generatedFileName = buildArchiveFileName({
        documentType,
        referenceNo,
        entityName:
          selectedSupplier?.name ||
          selectedSupplier?.Name ||
          customers.find((c) => c.customer_id === customerId || c.CustomerID === customerId)?.name ||
          'General',
        documentDate,
        originalFileName: file.name,
      });

      const uploaded = await uploadArchiveFileToGoogleDrive({
        file,
        folderKey: documentType,
        fileName: generatedFileName,
      });

      const tags = tagsInput
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

      await createArchiveDocument({
        documentType,
        title,
        documentDate,
        referenceNo: referenceNo || undefined,
        supplierName: selectedSupplier?.name || selectedSupplier?.Name || undefined,
        customerId: customerId || undefined,
        linkedTable: linkedTable || undefined,
        linkedRecordId: linkedRecordId || undefined,
        documentStatus,
        tags,
        notes: notes || undefined,
        createdBy: admin?.id,
        driveFileId: uploaded.driveFileId,
        driveWebViewLink: uploaded.driveWebViewLink,
        driveDownloadLink: uploaded.driveDownloadLink,
        mimeType: uploaded.mimeType,
        fileSize: uploaded.fileSize,
      });

      resetForm();
      await loadRows();
    } catch (e: any) {
      setError(e?.message || 'فشل حفظ المستند');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 font-cairo" dir="rtl">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileArchive className="w-8 h-8 text-blue-600" />
            أرشيف الشركة
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">رفع وفهرسة والبحث في مستندات الشركة المحفوظة على Google Drive</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-4">
            <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">إضافة مستند جديد</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select value={documentType} onChange={(e) => setDocumentType(e.target.value as ArchiveDocumentType)} className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800">
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" />
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المستند" className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 md:col-span-2" />
              <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="رقم مرجعي (اختياري)" className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" />
              <div className="md:col-span-2">
                <CustomerSelect
                  value={supplierId}
                  onChange={setSupplierId}
                  customers={supplierCustomers}
                  label="المورد"
                  placeholder="اختر المورد"
                  required={documentType === 'purchase_invoice'}
                />
              </div>
              <div className="md:col-span-2">
                <CustomerSelect
                  value={customerId}
                  onChange={setCustomerId}
                  customers={customers}
                  label="العميل"
                  placeholder="العميل (اختياري)"
                />
              </div>
              <select value={documentStatus} onChange={(e) => setDocumentStatus(e.target.value as any)} className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800">
                <option value="original">أصل</option>
                <option value="copy">نسخة</option>
                <option value="cancelled">ملغي</option>
              </select>
              <input value={linkedTable} onChange={(e) => setLinkedTable(e.target.value)} placeholder="اسم الجدول المرتبط (مثال: shop_receipts)" className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" />
              <input value={linkedRecordId} onChange={(e) => setLinkedRecordId(e.target.value)} placeholder="المعرف المرتبط (مثال: REC-0001)" className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" />
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="وسوم مفصولة بفاصلة" className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 md:col-span-2" />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات" rows={2} className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 md:col-span-2" />
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files?.[0] || null)} className="md:col-span-2" />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              حفظ في الأرشيف
            </button>
          </form>

          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">بحث واسترجاع</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث نصي" className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 md:col-span-2" />
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800">
                <option value="">كل الأنواع</option>
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <div className="md:col-span-2 space-y-2">
                <CustomerSelect
                  value={filterSupplierId}
                  onChange={setFilterSupplierId}
                  customers={supplierCustomers}
                  label="فلترة بالمورد"
                  placeholder="كل الموردين"
                />
                {filterSupplierId && (
                  <button
                    type="button"
                    onClick={() => setFilterSupplierId('')}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    مسح فلتر المورد
                  </button>
                )}
              </div>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" />
              <div className="md:col-span-2 space-y-2">
                <CustomerSelect
                  value={filterCustomerId}
                  onChange={setFilterCustomerId}
                  customers={customers}
                  label="فلترة بالعميل"
                  placeholder="فلترة حسب العميل"
                />
                {filterCustomerId && (
                  <button
                    type="button"
                    onClick={() => setFilterCustomerId('')}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    مسح فلتر العميل
                  </button>
                )}
              </div>
            </div>
            <button onClick={loadRows} disabled={loading} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-60">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              بحث
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  {['العنوان', 'النوع', 'التاريخ', 'المرجع', 'المورد', 'الحالة', 'فتح'].map((h) => (
                    <th key={h} className="px-3 py-2 text-right text-xs text-gray-600 dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-gray-500">لا توجد نتائج</td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 dark:border-slate-700/50">
                      <td className="px-3 py-2 font-medium">{r.title}</td>
                      <td className="px-3 py-2">{typeMap.get(r.document_type) || r.document_type}</td>
                      <td className="px-3 py-2">{r.document_date}</td>
                      <td className="px-3 py-2">{r.reference_no || '—'}</td>
                      <td className="px-3 py-2">{r.supplier_name || '—'}</td>
                      <td className="px-3 py-2">{r.document_status}</td>
                      <td className="px-3 py-2">
                        <a
                          href={r.drive_web_view_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => trackArchiveOpen(r.id, admin?.id).catch(() => {})}
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <ExternalLink className="w-4 h-4" />
                          فتح
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
