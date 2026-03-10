'use client';
import { use } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import ArticleForm from '@/components/admin/ArticleForm';

export default function NewArticlePage() {
    return (
        <AdminLayout>
            <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">إضافة مقالة جديدة</h1>
                <ArticleForm />
            </div>
        </AdminLayout>
    );
}
