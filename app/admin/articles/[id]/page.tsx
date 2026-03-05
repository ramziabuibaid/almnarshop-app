'use client';
import { useEffect, useState, use } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import ArticleForm from '@/components/admin/ArticleForm';
import { getArticleById } from '@/lib/api';
import { Article } from '@/types';
import { useRouter } from 'next/navigation';

export default function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = use(params);
    const router = useRouter();
    const [article, setArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (unwrappedParams.id) {
            loadArticle(unwrappedParams.id);
        }
    }, [unwrappedParams.id]);

    const loadArticle = async (id: string) => {
        try {
            const data = await getArticleById(id);
            if (data) {
                setArticle(data);
            } else {
                router.push('/admin/articles');
            }
        } catch (error) {
            console.error('Error loading article:', error);
            router.push('/admin/articles');
        } finally {
            setLoading(false);
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
            <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">تعديل المقالة</h1>
                {article && <ArticleForm initialData={article} />}
            </div>
        </AdminLayout>
    );
}
