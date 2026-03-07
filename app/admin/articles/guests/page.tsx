'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Plus, Trash, Check, X, Copy, Mail, Link as LinkIcon, AlertCircle, Edit2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getGuestLinks, createGuestLink, toggleGuestLink, deleteGuestLink, updateGuestLinkName } from '@/lib/api';
import { useAdminAuth } from '@/context/AdminAuthContext';

export default function GuestLinksPage() {
    const { admin } = useAdminAuth();
    const router = useRouter();
    const [links, setLinks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newAuthorName, setNewAuthorName] = useState('');

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const canManageArticles = admin?.is_super_admin || admin?.permissions?.manageArticles === true;

    useEffect(() => {
        if (!admin || !canManageArticles) {
            router.push('/admin');
            return;
        }
        loadLinks();
    }, []);

    const loadLinks = async () => {
        try {
            setLoading(true);
            const data = await getGuestLinks();
            setLinks(data || []);
        } catch (error) {
            console.error('Error loading guest links:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAuthorName.trim()) return;

        try {
            setIsCreating(true);
            await createGuestLink(newAuthorName.trim());
            setNewAuthorName('');
            await loadLinks();
        } catch (error) {
            console.error('Error creating guest link:', error);
            alert('حدث خطأ أثناء إنشاء الرابط. حاول مرة أخرى.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleEditStart = (link: any) => {
        setEditingId(link.id);
        setEditName(link.author_name);
    };

    const handleEditCancel = () => {
        setEditingId(null);
        setEditName('');
    };

    const handleUpdateName = async (id: string) => {
        if (!editName.trim()) return;

        try {
            await updateGuestLinkName(id, editName.trim());
            setEditingId(null);
            await loadLinks();
        } catch (error) {
            console.error('Error updating name:', error);
            alert('حدث خطأ أثناء تحديث الاسم.');
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            await toggleGuestLink(id, !currentStatus);
            await loadLinks(); // Refresh list to reflect changes
        } catch (error) {
            console.error('Error toggling link status:', error);
            alert('حدث خطأ أثناء تغيير حالة الرابط.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا الرابط؟ لن يتمكن الكاتب من الدخول بعد الآن، لكن المقالات التي كتبها ستبقى محفوظة.')) return;

        try {
            await deleteGuestLink(id);
            await loadLinks();
        } catch (error) {
            console.error('Error deleting link:', error);
            alert('حدث خطأ أثناء الحذف.');
        }
    };

    const handleCopyLink = (token: string) => {
        const url = `${window.location.origin}/guest/articles/${token}`;
        navigator.clipboard.writeText(url)
            .then(() => alert('تم نسخ الرابط السري بنجاح!\nيمكنك إرساله للكاتب الآن.'))
            .catch(() => alert('فشل نسخ الرابط.'));
    };

    if (loading || !canManageArticles) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center min-h-[50vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </AdminLayout>
        );
    }

    if (!canManageArticles) return null;

    return (
        <AdminLayout>
            <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 font-cairo" dir="rtl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <LinkIcon className="text-blue-600" />
                            إدارة دعوات الكتابة (الكُتاب الضيوف)
                        </h1>
                        <p className="text-sm text-gray-600 mt-1">
                            يمكنك من هنا إنشاء روابط سرية ومؤقتة تتيح لأشخاص من خارج الإدارة كتابة مقالات في الموقع دون إعطائهم أي صلاحيات أخرى.
                        </p>
                    </div>
                </div>

                {/* Create New Link Section */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">إنشاء دعوة جديدة</h2>
                    <form onSubmit={handleCreateLink} className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">اسم الكاتب (سيظهر تحت المقالات التي يكتبها)</label>
                            <input
                                type="text"
                                required
                                value={newAuthorName}
                                onChange={(e) => setNewAuthorName(e.target.value)}
                                placeholder="مثال: أحمد، أو كاتب ضيف 1..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isCreating || !newAuthorName.trim()}
                            className="min-w-[120px] bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 font-medium disabled:opacity-70 h-[42px] w-full sm:w-auto"
                        >
                            {isCreating ? 'جاري الإنشاء...' : (
                                <>
                                    <Plus size={18} />
                                    توليد رابط
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg flex gap-3 text-sm">
                    <AlertCircle className="flex-shrink-0" />
                    <div>
                        <strong>ملاحظة هامة:</strong> أي مقالة يكتبها "الضيف" يتم حفظها كـ <strong>مسودة</strong> تلقائياً. لا يمكن للضيف نشر المقالة نهائياً، يجب عليك أنت مراجعتها من قائمة المقالات ونشرها.
                    </div>
                </div>

                {/* List of Links */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="p-4 font-semibold text-gray-900">اسم الكاتب</th>
                                    <th className="p-4 font-semibold text-gray-900">تاريخ الإنشاء</th>
                                    <th className="p-4 font-semibold text-gray-900 text-center">الحالة</th>
                                    <th className="p-4 font-semibold text-gray-900">الرابط السري</th>
                                    <th className="p-4 font-semibold text-gray-900 text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {links.map((link) => (
                                    <tr key={link.id} className={`${!link.is_active ? 'bg-gray-50/50' : ''} hover:bg-gray-50 transition-colors`}>
                                        <td className="p-4 font-bold text-gray-900 group">
                                            {editingId === link.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="px-2 py-1 text-sm border border-blue-500 font-bold rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-full min-w-[120px]"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleUpdateName(link.id);
                                                            if (e.key === 'Escape') handleEditCancel();
                                                        }}
                                                    />
                                                    <button onClick={() => handleUpdateName(link.id)} className="text-green-600 hover:bg-green-50 p-1 rounded" title="حفظ">
                                                        <Save size={16} />
                                                    </button>
                                                    <button onClick={handleEditCancel} className="text-gray-500 hover:bg-gray-200 p-1 rounded" title="إلغاء">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between gap-2">
                                                    <span>{link.author_name}</span>
                                                    <button
                                                        onClick={() => handleEditStart(link)}
                                                        className="text-gray-400 hover:text-blue-600 p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                        title="تعديل الاسم"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600 font-medium">
                                            {new Date(link.created_at).toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => handleToggleStatus(link.id, link.is_active)}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors border ${link.is_active ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'}`}
                                                title={link.is_active ? "الرابط فعال - انقر للتعطيل" : "الرابط معطل - انقر للتفعيل"}
                                            >
                                                {link.is_active ? (
                                                    <><Check size={14} /> فعّال (يعمل)</>
                                                ) : (
                                                    <><X size={14} /> معطّل (مغلق)</>
                                                )}
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            <button
                                                onClick={() => handleCopyLink(link.token)}
                                                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border border-blue-100"
                                            >
                                                <Copy size={16} />
                                                نسخ الرابط لإرساله
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center">
                                                <button
                                                    onClick={() => handleDelete(link.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="حذف الدعوة نهائياً"
                                                >
                                                    <Trash size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {links.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-10 text-center text-gray-500 bg-gray-50/50">
                                            لا توجد روابط دعوة مضافة حالياً. أنشئ رابطاً جديداً بالاستعانة بالنموذج أعلاه.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div >
        </AdminLayout >
    );
}
