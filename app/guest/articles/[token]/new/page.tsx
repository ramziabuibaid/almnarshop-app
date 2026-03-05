'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import ArticleForm from '@/components/admin/ArticleForm';
import { verifyGuestToken, guestSaveArticle } from '@/lib/api';
import Link from 'next/link';
import { Check, X, ArrowRight } from 'lucide-react';

export default function GuestNewArticlePage({ params }: { params: Promise<{ token: string }> }) {
    const resolvedParams = use(params);
    const token = resolvedParams.token;
    const router = useRouter();

    const [guestLink, setGuestLink] = useState<any>(null);
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
        } catch (err: any) {
            setError(err.message || 'حدث خطأ في تحميل البيانات.');
        } finally {
            setLoading(false);
        }
    };

    const handleCustomSave = async (articleData: any) => {
        if (!guestLink) return;
        await guestSaveArticle(guestLink.id, guestLink.author_name, articleData);
        router.push(`/guest/articles/${token}`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error || !guestLink) {
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
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
                    <Link href={`/guest/articles/${token}`} className="text-gray-500 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-100">
                        <ArrowRight size={24} />
                    </Link>
                    <div className="flex items-center gap-3 border-r pr-4 border-gray-200">
                        <div>
                            <h1 className="font-bold text-gray-900 leading-tight">كتابة مقالة جديدة</h1>
                            <p className="text-xs text-blue-600 font-medium">{guestLink.author_name}</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                <ArticleForm
                    hidePublishOption={true}
                    onSave={handleCustomSave}
                />
            </main>
        </div>
    );
}
