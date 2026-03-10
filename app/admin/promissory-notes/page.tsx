'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import {
    getPromissoryNotes,
    updateInstallmentStatus,
    deletePromissoryNote,
    type PromissoryNote,
    type InstallmentStatus
} from '@/lib/api';
import PromissoryNoteModal from './PromissoryNoteModal';
import {
    Search,
    Filter,
    Plus,
    Loader2,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    Clock,
    AlertCircle,
    Trash2,
    Calendar,
    Printer,
    X
} from 'lucide-react';

import { useAdminAuth } from '@/context/AdminAuthContext';

export default function PromissoryNotesPage() {
    const { admin } = useAdminAuth();
    const router = useRouter();
    const [notes, setNotes] = useState<PromissoryNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedNote, setSelectedNote] = useState<PromissoryNote | null>(null);
    const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
    const [updatingInstallment, setUpdatingInstallment] = useState<string | null>(null);

    const [printOverlayNoteId, setPrintOverlayNoteId] = useState<string | null>(null);
    const printIframeRef = useRef<HTMLIFrameElement>(null);
    const isMobilePrint = () => typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    useLayoutEffect(() => {
        document.title = 'الكمبيالات';
    }, []);

    useEffect(() => {
        loadNotes();
    }, [statusFilter]);

    useEffect(() => {
        if (!printOverlayNoteId) return;
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
    }, [printOverlayNoteId]);

    // Permission check
    const hasPermission = admin?.is_super_admin || admin?.permissions?.accessPromissoryNotes;
    const canManage = hasPermission;

    const handleEdit = (note: PromissoryNote) => {
        // Allow editing for everyone as requested? Or restrict?
        // User said: "make editing available to everyone"
        setSelectedNote(note);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        if (!canManage) {
            alert('ليس لديك صلاحية لإنشاء كمبيالة جديدة');
            return;
        }
        setSelectedNote(null);
        setIsModalOpen(true);
    };

    const handlePrintNote = (noteId: string) => {
        if (isMobilePrint()) {
            window.open(`/admin/promissory-notes/print/${noteId}`, '_blank');
            return;
        }
        setPrintOverlayNoteId(noteId);
    };

    const loadNotes = async () => {
        setLoading(true);
        try {
            const data = await getPromissoryNotes({
                status: statusFilter as any,
                search
            });
            setNotes(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        loadNotes();
    };

    const toggleExpand = (id: string) => {
        setExpandedNoteId(prev => prev === id ? null : id);
    };

    const handleInstallmentStatus = async (instId: string, currentStatus: InstallmentStatus) => {
        if (!canManage) {
            alert('ليس لديك صلاحية لتعديل حالة الأقساط');
            return;
        }
        if (updatingInstallment) return;

        // Toggle logic: Pending -> Paid -> Pending
        const newStatus: InstallmentStatus = currentStatus === 'Pending' || currentStatus === 'Late' ? 'Paid' : 'Pending';

        setUpdatingInstallment(instId);
        try {
            await updateInstallmentStatus(instId, newStatus);
            // Refresh data to reflect changes
            await loadNotes();
        } catch (err) {
            console.error(err);
            alert('فشل تحديث حالة القسط');
        } finally {
            setUpdatingInstallment(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!admin?.is_super_admin) {
            alert('فقط المشرف العام يمكنه حذف الكمبيالات');
            return;
        }
        if (!confirm('هل أنت متأكد من حذف هذه الكمبيالة وجميع أقساطها؟')) return;
        try {
            await deletePromissoryNote(id);
            await loadNotes();
        } catch (err) {
            alert('فشل الحذف');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active': return 'bg-blue-100 text-blue-800';
            case 'Completed': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
            case 'Defaulted': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
            default: return 'bg-gray-100 dark:bg-slate-700/50 text-gray-800 dark:text-gray-200';
        }
    };

    const getInstallmentStatusColor = (status: string) => {
        switch (status) {
            case 'Paid': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200';
            case 'Late': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200';
            case 'Pending': return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700';
            default: return 'text-gray-600 dark:text-gray-400';
        }
    };

    if (!hasPermission) {
        return (
            <AdminLayout>
                <div className="p-8 font-cairo" dir="rtl">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-8 text-center flex flex-col items-center max-w-lg mx-auto border border-gray-200 dark:border-slate-700 mt-20">
                        <AlertCircle size={64} className="text-red-500 mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">عذراً، لا تمتلك صلاحية الدخول</h2>
                        <p className="text-gray-600 dark:text-gray-400 font-medium">ليس لديك الإذن للاطلاع على الكمبيالات. يرجى مراجعة مدير النظام.</p>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6 font-cairo" dir="rtl">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">إدارة الكمبيالات</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">متابعة الأقساط والذمم المالية</p>
                    </div>
                    <div className="flex gap-2">
                        {canManage && (
                            <button
                                onClick={handleCreate}
                                className="bg-gray-900 dark:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-800 dark:hover:bg-slate-600 transition-colors"
                            >
                                <Plus size={20} />
                                <span>إضافة كمبيالة جديدة</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">إجمالي الكمبيالات النشطة</div>
                        <div className="text-2xl font-bold text-blue-600">
                            ₪{notes.filter(n => n.status === 'Active').reduce((sum, n) => sum + n.total_amount, 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-blue-400 mt-1">
                            {notes.filter(n => n.status === 'Active').length} كمبيالة
                        </div>
                    </div>
                    {/* Add more stats as needed */}
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="بحث باسم الزبون أو ملاحظات..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 focus:outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400 font-medium"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="text-gray-500 dark:text-gray-400" size={18} />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="border border-gray-300 dark:border-slate-600 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 text-gray-900 dark:text-gray-100 font-medium"
                        >
                            <option value="">كل الحالات</option>
                            <option value="Active">نشط (Active)</option>
                            <option value="Completed">مكتمل (Completed)</option>
                            <option value="Defaulted">متعثر (Defaulted)</option>
                        </select>
                    </div>
                    <button
                        onClick={handleSearch}
                        className="bg-gray-100 dark:bg-slate-700/50 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                    >
                        بحث
                    </button>
                </div>

                {/* List */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                            <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                            جاري التحميل...
                        </div>
                    ) : notes.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                            لا توجد كمبيالات
                        </div>
                    ) : (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400">
                                    <tr>
                                        <th className="px-4 py-3 font-medium whitespace-nowrap hidden md:table-cell w-16"></th>
                                        <th className="px-4 py-3 font-medium whitespace-nowrap">الزبون</th>
                                        <th className="px-4 py-3 font-medium whitespace-nowrap">رقم الكمبيالة</th>
                                        <th className="px-4 py-3 font-medium whitespace-nowrap">المبلغ الإجمالي</th>
                                        <th className="px-4 py-3 font-medium whitespace-nowrap">تاريخ الاصدار</th>
                                        <th className="px-4 py-3 font-medium whitespace-nowrap">عدد الأقساط</th>
                                        <th className="px-4 py-3 font-medium whitespace-nowrap">الحالة</th>
                                        <th className="px-4 py-3 font-medium whitespace-nowrap w-36">الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {notes.map((note) => (
                                        <Fragment key={note.id}>
                                            <tr
                                                className="group transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer bg-white dark:bg-slate-800"
                                                onClick={() => toggleExpand(note.id)}
                                            >
                                                <td className="px-4 py-4 hidden md:table-cell">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${note.status === 'Active' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 dark:bg-slate-700/50 text-gray-500 dark:text-gray-400'}`}>
                                                        <Calendar size={18} />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 min-w-[200px]">
                                                    {note.customer_id ? (
                                                        <Link
                                                            href={`/admin/customers/${note.customer_id}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 hover:underline transition-colors block"
                                                        >
                                                            {note.customers?.name || 'زبون عام'}
                                                        </Link>
                                                    ) : (
                                                        <div className="font-bold text-gray-900 dark:text-gray-100">{note.customers?.name || 'زبون عام'}</div>
                                                    )}
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{note.customers?.phone}</div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="font-bold text-gray-900 dark:text-gray-100">{note.id}</span>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-bold text-gray-900 dark:text-gray-100">₪{note.total_amount.toLocaleString()}</span>
                                                        {note.is_legacy && note.remaining_amount != null && (
                                                            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 w-fit">
                                                                متبقي: ₪{note.remaining_amount.toLocaleString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="font-bold text-gray-900 dark:text-gray-100">{note.issue_date}</span>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="font-bold text-gray-900 dark:text-gray-100">{note.installments?.length || 0}</span>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(note.status)}`}>
                                                        {note.status === 'Active' ? 'نشط' : note.status === 'Completed' ? 'مكتمل' : 'متعثر'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePrintNote(note.id);
                                                            }}
                                                            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                            title="طباعة الكمبيالة"
                                                        >
                                                            <Printer size={18} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEdit(note);
                                                            }}
                                                            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                                            title="تعديل الكمبيالة"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(note.id);
                                                            }}
                                                            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                                            title="حذف"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                        <button className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors p-1.5">
                                                            {expandedNoteId === note.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expanded Installments */}
                                            {expandedNoteId === note.id && (
                                                <tr className="bg-gray-50/50 dark:bg-slate-800/30">
                                                    <td colSpan={8} className="p-0 border-b-0">
                                                        <div className="p-4 border-b border-gray-200 dark:border-slate-700 animate-in slide-in-from-top-2 duration-200">
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                                                {note.installments?.map((inst, idx) => (
                                                                    <div
                                                                        key={inst.id}
                                                                        className={`p-3 rounded-lg border flex items-center justify-between ${inst.status === 'Paid' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30' :
                                                                            inst.status === 'Late' ? 'bg-white dark:bg-slate-800 border-red-300 dark:border-red-800/50 shadow-sm' :
                                                                                'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                                                                            }`}
                                                                    >
                                                                        <div>
                                                                            <div className="text-sm font-bold text-gray-900 dark:text-gray-100">قسط #{idx + 1}</div>
                                                                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                                                                                <Clock size={12} />
                                                                                {inst.due_date}
                                                                            </div>
                                                                            {inst.notes && <div className="text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 mt-1.5 px-1.5 py-0.5 rounded leading-tight line-clamp-2" title={inst.notes}>{inst.notes}</div>}
                                                                        </div>

                                                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                                                            <span className="font-bold text-gray-900 dark:text-gray-100">₪{inst.amount}</span>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleInstallmentStatus(inst.id, inst.status);
                                                                                }}
                                                                                disabled={updatingInstallment === inst.id}
                                                                                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition-colors ${inst.status === 'Paid'
                                                                                    ? 'bg-green-200 dark:bg-green-800/50 text-green-800 dark:text-green-300 hover:bg-green-300 dark:hover:bg-green-800/70'
                                                                                    : 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-500'
                                                                                    }`}
                                                                            >
                                                                                {updatingInstallment === inst.id ? (
                                                                                    <Loader2 size={12} className="animate-spin" />
                                                                                ) : inst.status === 'Paid' ? (
                                                                                    <>
                                                                                        <CheckCircle2 size={12} />
                                                                                        تم الدفع
                                                                                    </>
                                                                                ) : (
                                                                                    'تسجيل دفع'
                                                                                )}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <PromissoryNoteModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    loadNotes();
                }}
                initialData={selectedNote}
            />

            {/* Print Overlay */}
            {printOverlayNoteId && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
                    dir="rtl"
                    onClick={() => setPrintOverlayNoteId(null)}
                >
                    <div
                        className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl flex flex-col max-w-full max-h-full overflow-hidden"
                        style={{ minWidth: '120mm', maxHeight: '95vh' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex-shrink-0">
                            <span className="text-sm font-cairo text-gray-700 dark:text-gray-300">معاينة الطباعة — كمبيالة</span>
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
                                    onClick={() => setPrintOverlayNoteId(null)}
                                    className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600 hover:text-gray-900 transition-colors"
                                    aria-label="إغلاق"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto bg-white dark:bg-slate-800 min-h-0">
                            <iframe
                                ref={printIframeRef}
                                src={`/admin/promissory-notes/print/${printOverlayNoteId}?embed=1`}
                                title="طباعة الكمبيالة"
                                className="w-full border-0 bg-white dark:bg-slate-800"
                                style={{ minHeight: '70vh', height: '70vh' }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout >
    );
}
