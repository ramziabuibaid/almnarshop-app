'use client';

import { useState, useEffect, useLayoutEffect } from 'react';
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
    Calendar
} from 'lucide-react';

export default function PromissoryNotesPage() {
    const [notes, setNotes] = useState<PromissoryNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
    const [updatingInstallment, setUpdatingInstallment] = useState<string | null>(null);

    useLayoutEffect(() => {
        document.title = 'الكمبيالات';
    }, []);

    useEffect(() => {
        loadNotes();
    }, [statusFilter]);

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
            case 'Completed': return 'bg-green-100 text-green-800';
            case 'Defaulted': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getInstallmentStatusColor = (status: string) => {
        switch (status) {
            case 'Paid': return 'text-green-600 bg-green-50 border-green-200';
            case 'Late': return 'text-red-600 bg-red-50 border-red-200';
            case 'Pending': return 'text-gray-600 bg-gray-50 border-gray-200';
            default: return 'text-gray-600';
        }
    };

    return (
        <AdminLayout>
            <div className="space-y-6 font-cairo" dir="rtl">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">إدارة الكمبيالات</h1>
                        <p className="text-gray-500 mt-1">متابعة الأقساط والذمم المالية</p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        <Plus size={20} />
                        إنشاء كمبيالة جديدة
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-sm text-gray-500 mb-1">إجمالي الكمبيالات النشطة</div>
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
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="بحث باسم الزبون أو ملاحظات..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:outline-none text-gray-900 placeholder:text-gray-400 font-medium"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="text-gray-500" size={18} />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 font-medium"
                        >
                            <option value="">كل الحالات</option>
                            <option value="Active">نشط (Active)</option>
                            <option value="Completed">مكتمل (Completed)</option>
                            <option value="Defaulted">متعثر (Defaulted)</option>
                        </select>
                    </div>
                    <button
                        onClick={handleSearch}
                        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        بحث
                    </button>
                </div>

                {/* List */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">
                            <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                            جاري التحميل...
                        </div>
                    ) : notes.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            لا توجد كمبيالات
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {notes.map((note) => (
                                <div key={note.id} className="group transition-colors hover:bg-gray-50">
                                    {/* Main Row */}
                                    <div
                                        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                                        onClick={() => toggleExpand(note.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${note.status === 'Active' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                                <Calendar size={20} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900">{note.customers?.name || 'زبون عام'}</div>
                                                <div className="text-sm text-gray-500">{note.customers?.phone}</div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                                            <div className="flex flex-col">
                                                <span className="text-gray-900 text-xs font-medium">رقم الكمبيالة</span>
                                                <span className="font-bold text-gray-900">{note.id}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-gray-900 text-xs font-medium">المبلغ الإجمالي</span>
                                                <span className="font-bold text-gray-900">₪{note.total_amount.toLocaleString()}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-gray-900 text-xs font-medium">تاريخ الاصدار</span>
                                                <span className="font-bold text-gray-900">{note.issue_date}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-gray-900 text-xs font-medium">عدد الأقساط</span>
                                                <span className="font-bold text-gray-900">{note.installments?.length || 0}</span>
                                            </div>
                                            <div>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(note.status)}`}>
                                                    {note.status === 'Active' ? 'نشط' : note.status === 'Completed' ? 'مكتمل' : 'متعثر'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(note.id);
                                                }}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                                title="حذف"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            <button className="text-gray-400">
                                                {expandedNoteId === note.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Installments */}
                                    {expandedNoteId === note.id && (
                                        <div className="bg-gray-50 p-4 border-t border-gray-200 animate-in slide-in-from-top-2 duration-200">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {note.installments?.map((inst, idx) => (
                                                    <div
                                                        key={inst.id}
                                                        className={`p-3 rounded-lg border flex items-center justify-between ${inst.status === 'Paid' ? 'bg-green-50 border-green-200' :
                                                            inst.status === 'Late' ? 'bg-white border-red-300 shadow-sm' :
                                                                'bg-white border-gray-200'
                                                            }`}
                                                    >
                                                        <div>
                                                            <div className="text-sm font-bold text-gray-900">قسط #{idx + 1}</div>
                                                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                                                <Clock size={12} />
                                                                {inst.due_date}
                                                            </div>
                                                            {inst.notes && <div className="text-xs text-gray-400 mt-1">{inst.notes}</div>}
                                                        </div>

                                                        <div className="flex flex-col items-end gap-2">
                                                            <span className="font-bold text-gray-900">₪{inst.amount}</span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleInstallmentStatus(inst.id, inst.status);
                                                                }}
                                                                disabled={updatingInstallment === inst.id}
                                                                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${inst.status === 'Paid'
                                                                    ? 'bg-green-200 text-green-800 hover:bg-green-300'
                                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
                                    )}
                                </div>
                            ))}
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
            />
        </AdminLayout>
    );
}
