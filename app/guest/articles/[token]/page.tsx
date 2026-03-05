'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { verifyGuestToken, guestGetArticles } from '@/lib/api';
import { Plus, Edit, Type, Clock, X } from 'lucide-react';
import Link from 'next/link';

export default function GuestDashboard({ params }: { params: Promise<{ token: string }> }) {
    const resolvedParams = use(params);
    const token = resolvedParams.token;
    const router = useRouter();

    const [guestLink, setGuestLink] = useState<any>(null);
    const [articles, setArticles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadGuestData();
    }, [token]);

    const loadGuestData = async () => {
        try {
            setLoading(true);
            const linkData = await verifyGuestToken(token);
            setGuestLink(linkData);

            const articlesData = await guestGetArticles(linkData.id);
            setArticles(articlesData || []);
        } catch (err: any) {
            setError(err.message || 'حدث خطأ في تحميل البيانات.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 font-cairo" dir="rtl">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center max-w-md">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <X size={32} />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">عذراً! لا يمكن الوصول</h1>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 font-cairo" dir="rtl">
            {/* Minimalist Header for Guests */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-xl">
                            {guestLink?.author_name?.charAt(0) || 'ك'}
                        </div>
                        <div>
                            <h1 className="font-bold text-gray-900 leading-tight">مرحباً، {guestLink?.author_name}</h1>
                            <p className="text-xs text-gray-500">لوحة الكتابة (وصول مؤقت)</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">مقالاتي</h2>
                    <Link
                        href={`/guest/articles/${token}/new`}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg transition-colors font-medium shadow-sm"
                    >
                        <Plus size={20} />
                        كتابة مقالة جديدة
                    </Link>
                </div>

                {articles.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Type size={28} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">لم تكتب أي مقالة بعد</h3>
                        <p className="text-gray-500 max-w-sm mx-auto mb-6">ابنِ محتواك الأول الآن. مسوداتك ستحفظ تلقائياً هنا لتتم مراجعتها من قبل الإدارة.</p>
                        <Link
                            href={`/guest/articles/${token}/new`}
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors font-medium"
                        >
                            البدء بالكتابة
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {articles.map((article) => (
                            <div key={article.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-bold text-gray-900 line-clamp-2 leading-snug">{article.title}</h3>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 shrink-0 mr-2">
                                        {article.type}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 line-clamp-2 mb-4 h-10">
                                    {article.summary || 'بدون ملخص'}
                                </p>
                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                        <Clock size={14} /> مسودة قيد المراجعة
                                    </div>
                                    <Link
                                        href={`/guest/articles/${token}/${article.id}`}
                                        className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        <Edit size={16} /> تعديل
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
