'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/context/AdminAuthContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Plus, Edit, Trash, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getArticles, deleteArticle } from '@/lib/api';
import { Article } from '@/types';
import Link from 'next/link';

export default function AdminArticlesPage() {
    const { admin } = useAdminAuth();
    const router = useRouter();
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);

    // Check permissions - optionally limit to specific roles
    // const canManageArticles = admin?.is_super_admin || admin?.permissions?.manageArticles === true;

    useEffect(() => {
        loadArticles();
    }, []);

    const loadArticles = async () => {
        try {
            setLoading(true);
            const data = await getArticles();
            setArticles(data || []);
        } catch (error) {
            console.error('Error loading articles:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('هل أنت متأكد من حذف هذه المقالة؟')) {
            try {
                await deleteArticle(id);
                await loadArticles();
            } catch (error) {
                console.error('Error deleting article:', error);
                alert('حدث خطأ أثناء الحذف');
            }
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h1 className="text-2xl font-bold text-gray-900">المقالات</h1>
                    <Link
                        href="/admin/articles/new"
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        <Plus size={20} />
                        إضافة مقالة جديدة
                    </Link>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="p-4 font-semibold text-gray-900">العنوان</th>
                                    <th className="p-4 font-semibold text-gray-900">النوع</th>
                                    <th className="p-4 font-semibold text-gray-900 text-center">المشاهدات</th>
                                    <th className="p-4 font-semibold text-gray-900 text-center">الحالة</th>
                                    <th className="p-4 font-semibold text-gray-900 text-center">تاريخ النشر</th>
                                    <th className="p-4 font-semibold text-gray-900 text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {articles.map((article) => (
                                    <tr key={article.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                        <td className="p-4 max-w-xs truncate font-medium">{article.title}</td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                {article.type}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">{article.view_count || 0}</td>
                                        <td className="p-4 text-center">
                                            {article.is_published ? (
                                                <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2.5 py-1 rounded-full text-sm">
                                                    <Eye size={16} /> منشور
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full text-sm">
                                                    مسودة
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center text-sm text-gray-600">
                                            {article.published_at ? new Date(article.published_at).toLocaleDateString('ar-JO') : '-'}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <Link
                                                    href={`/admin/articles/${article.id}`}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="تعديل"
                                                >
                                                    <Edit size={18} />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(article.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="حذف"
                                                >
                                                    <Trash size={18} />
                                                </button>
                                                <a
                                                    href={`/articles/${article.slug}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                                    title="معاينة"
                                                >
                                                    <Eye size={18} />
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {articles.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-gray-500 bg-gray-50/50">
                                            لا يوجد مقالات مضافة بعد
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
