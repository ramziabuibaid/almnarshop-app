import StoreHeader from '@/components/store/StoreHeader';
import StoreFooter from '@/components/store/StoreFooter';
import { getArticles } from '@/lib/api';
import Link from 'next/link';
import { getDirectImageUrl } from '@/lib/utils';
import { Calendar, Eye } from 'lucide-react';

export const revalidate = 60; // SSR with ISR every 60s

export default async function ArticlesPage({ searchParams }: { searchParams: { type?: string } }) {
    const type = searchParams?.type;
    const articles = await getArticles({ is_published: true, type });

    const ARTICLE_TYPES = ['الكل', 'أخبار تقنية', 'نصائح', 'شروحات', 'معلومات عامة'];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
            <StoreHeader />

            <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 md:py-16">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">المدونة والمقالات</h1>
                    <p className="text-lg text-gray-600">اكتشف أحدث الأخبار التقنية، النصائح، والشروحات لأجهزتك المنزلية.</p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap justify-center gap-3 mb-12">
                    {ARTICLE_TYPES.map(t => {
                        const isActive = t === 'الكل' ? !type : type === t;
                        const href = t === 'الكل' ? '/articles' : `/articles?type=${encodeURIComponent(t)}`;
                        return (
                            <Link
                                key={t}
                                href={href}
                                className={`px-6 py-2.5 rounded-full text-sm font-bold transition-colors ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                    }`}
                            >
                                {t}
                            </Link>
                        );
                    })}
                </div>

                {/* Grid */}
                {articles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {articles.map((article: any) => (
                            <Link key={article.id} href={`/articles/${article.slug}`} className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col">
                                <div className="relative aspect-[16/9] bg-gray-100 overflow-hidden">
                                    {article.cover_image ? (
                                        <img
                                            src={getDirectImageUrl(article.cover_image)}
                                            alt={article.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">بدون صورة</div>
                                    )}
                                    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs font-bold text-indigo-700 shadow-sm">
                                        {article.type}
                                    </div>
                                </div>

                                <div className="p-6 md:p-8 flex flex-col flex-1">
                                    <h2 className="text-xl font-bold text-gray-900 mb-4 line-clamp-2 group-hover:text-indigo-600 transition-colors leading-relaxed">
                                        {article.title}
                                    </h2>
                                    <p className="text-gray-600 text-sm mb-6 line-clamp-3 flex-1 leading-relaxed">
                                        {article.summary || extractText(article.content)}
                                    </p>

                                    <div className="flex items-center justify-between text-xs font-medium text-gray-500 pt-5 border-t border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-gray-50 rounded-full"><Calendar size={14} className="text-gray-400" /></div>
                                            {article.published_at ? new Date(article.published_at).toLocaleDateString('ar-JO') : 'حديث'}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-gray-50 rounded-full"><Eye size={14} className="text-gray-400" /></div>
                                            {article.view_count || 0} قراءة
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <h3 className="text-xl font-bold text-gray-800 mb-3">عذراً، لا يوجد مقالات لعرضها حالياً</h3>
                        <p className="text-gray-500">جرب تصنيفاً آخر أو عد لاحقاً.</p>
                    </div>
                )}
            </main>

            <StoreFooter />
        </div>
    );
}

function extractText(content: any[]): string {
    if (!Array.isArray(content)) return '';
    const textBlocks = content.filter((b: any) => b.type === 'text');
    if (textBlocks.length === 0) return '';
    return typeof textBlocks[0].content === 'string' ? textBlocks[0].content.substring(0, 150) + '...' : '';
}
