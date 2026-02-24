'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { getLegalCases, deleteLegalCase, type LegalCase } from '@/lib/api';
import {
    Plus, Search, Edit2, Trash2, ShieldAlert,
    Loader2, AlertCircle, FileText, Download,
    Briefcase, AlertTriangle, CheckCircle, RefreshCw, DollarSign
} from 'lucide-react';
import Link from 'next/link';

// Modals
import LegalCaseModal from './LegalCaseModal';
import PaymentsModal from './PaymentsModal';

export default function LegalCasesPage() {
    const { admin, loading: authLoading } = useAdminAuth();

    const [cases, setCases] = useState<LegalCase[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Modals state
    const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
    const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false);
    const [selectedCase, setSelectedCase] = useState<LegalCase | null>(null);
    const [selectedCaseIdForPayments, setSelectedCaseIdForPayments] = useState<string | null>(null);

    // Permission Check
    const hasPermission = admin?.is_super_admin || admin?.permissions?.accessLegalCases;

    useEffect(() => {
        if (!authLoading && hasPermission) {
            fetchCases();
        }
    }, [authLoading, hasPermission]);

    const fetchCases = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getLegalCases();
            setCases(data);
        } catch (err: any) {
            console.error('Failed to load legal cases:', err);
            setError(err?.message || 'فشل تحميل الملفات القضائية');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, caseNumber: string) => {
        if (!confirm(`هل أنت متأكد من حذف الملف القضائي رقم ${caseNumber}؟ لن يمكن التراجع عن هذا الإجراء وسيتم حذف جميع الدفعات المرتبطة به.`)) return;

        try {
            await deleteLegalCase(id);
            fetchCases();
        } catch (err: any) {
            console.error('Failed to delete case:', err);
            alert('فشل الحذف: ' + (err.message || 'خطأ غير معروف'));
        }
    };

    const handleEdit = (legalCase: LegalCase) => {
        setSelectedCase(legalCase);
        setIsCaseModalOpen(true);
    };

    const handleOpenPayments = (caseId: string) => {
        setSelectedCaseIdForPayments(caseId);
        setIsPaymentsModalOpen(true);
    };

    const handleCreateNew = () => {
        setSelectedCase(null);
        setIsCaseModalOpen(true);
    };

    // Derived states
    const filteredCases = cases.filter(c => {
        const matchSearch =
            c.case_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.customers?.name.toLowerCase().includes(searchQuery.toLowerCase());

        const matchStatus = statusFilter === 'all' || c.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const totalActiveAmount = filteredCases
        .filter(c => c.status === 'Active')
        .reduce((sum, c) => sum + (c.remaining_amount || 0), 0);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Active':
                return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1"><AlertTriangle size={12} />نشط</span>;
            case 'Closed':
                return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1"><CheckCircle size={12} />مغلق</span>;
            case 'On Hold':
                return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1"><Briefcase size={12} />معلق</span>;
            default:
                return <span>{status}</span>;
        }
    };

    if (authLoading) return <AdminLayout><div className="p-8 text-center text-gray-500 flex justify-center"><Loader2 className="animate-spin" size={32} /></div></AdminLayout>;

    if (!hasPermission) {
        return (
            <AdminLayout>
                <div className="p-8">
                    <div className="bg-white rounded-xl shadow p-8 text-center flex flex-col items-center max-w-lg mx-auto border border-gray-200 mt-20">
                        <ShieldAlert size={64} className="text-red-500 mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">عذراً، لا تمتلك صلاحية الدخول</h2>
                        <p className="text-gray-600 font-medium">ليس لديك الإذن للاطلاع على الملفات القضائية. يرجى مراجعة مدير النظام.</p>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="p-6 max-w-7xl mx-auto font-cairo" dir="rtl">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Briefcase className="text-blue-600" size={28} />
                            الملفات القضائية ({filteredCases.length})
                        </h1>
                        <p className="text-gray-500 mt-1">إدارة القضايا والمطالبات المالية للعملاء والمتابعة القانونية.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg text-blue-900 flex flex-col items-center min-w-[150px]">
                            <span className="text-xs font-bold text-blue-600">المطالبات النشطة (متبقي)</span>
                            <span className="font-bold text-lg">₪{totalActiveAmount.toLocaleString()}</span>
                        </div>
                        <button
                            onClick={fetchCases}
                            className="p-2.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
                            title="تحديث البيانات"
                        >
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={handleCreateNew}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-sm transition-colors"
                        >
                            <Plus size={20} />
                            ملف جديد
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="ابحث برقم القضية أو اسم العميل..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-w-[200px]"
                    >
                        <option value="all">جميع الحالات</option>
                        <option value="Active">نشط</option>
                        <option value="On Hold">معلق</option>
                        <option value="Closed">مغلق</option>
                    </select>
                </div>

                {/* Data Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-6 py-4 font-bold text-gray-600 text-sm">رقم القضية</th>
                                    <th className="px-6 py-4 font-bold text-gray-600 text-sm">العميل</th>
                                    <th className="px-6 py-4 font-bold text-gray-600 text-sm">الإجمالي</th>
                                    <th className="px-6 py-4 font-bold text-gray-600 text-sm">المدفوع</th>
                                    <th className="px-6 py-4 font-bold text-gray-600 text-sm">المتبقي</th>
                                    <th className="px-6 py-4 font-bold text-gray-600 text-sm">الحالة</th>
                                    <th className="px-6 py-4 font-bold text-gray-600 text-sm text-center">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500"><Loader2 size={24} className="animate-spin mx-auto" /></td></tr>
                                ) : filteredCases.length === 0 ? (
                                    <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">لا توجد ملفات قضائية مطابقة للبحث</td></tr>
                                ) : (
                                    filteredCases.map(c => (
                                        <tr key={c.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4 font-bold text-gray-900">
                                                {c.case_number}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{c.customers?.name}</div>
                                                <div className="text-xs text-blue-600 truncate max-w-[200px]" title={c.notes || ''}>{c.notes}</div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-gray-500">
                                                ₪{Number(c.total_amount).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-green-600 font-bold">
                                                ₪{Number(c.paid_amount || 0).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-red-600 font-bold text-lg">
                                                ₪{Number(c.remaining_amount || 0).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(c.status)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleOpenPayments(c.id)}
                                                        className="text-green-600 hover:bg-green-50 p-2 rounded-lg transition-colors border border-green-200 bg-white"
                                                        title="الدفعات"
                                                    >
                                                        <DollarSign size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEdit(c)}
                                                        className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors border border-blue-200 bg-white"
                                                        title="تعديل"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <Link
                                                        href={`/admin/legal-cases/print/${c.id}`}
                                                        className="text-slate-600 hover:bg-slate-50 p-2 rounded-lg transition-colors border border-slate-200 bg-white"
                                                        title="طباعة طلب قضائي"
                                                    >
                                                        <Download size={18} />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(c.id, c.case_number)}
                                                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors border border-red-200 bg-white"
                                                        title="حذف"
                                                    >
                                                        <Trash2 size={18} />
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
            </div>

            {/* Modals */}
            <LegalCaseModal
                isOpen={isCaseModalOpen}
                onClose={() => setIsCaseModalOpen(false)}
                onSuccess={fetchCases}
                initialData={selectedCase}
            />

            <PaymentsModal
                isOpen={isPaymentsModalOpen}
                onClose={() => setIsPaymentsModalOpen(false)}
                caseId={selectedCaseIdForPayments}
            />

        </AdminLayout>
    );
}
