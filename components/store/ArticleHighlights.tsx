'use client';

import { useState, useEffect } from 'react';
import { getArticles } from '@/lib/api';
import { getDirectImageUrl } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Eye, ArrowLeft, Newspaper } from 'lucide-react';

interface Article {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  content: any[];
  cover_image?: string;
  type: string;
  published_at?: string;
  view_count?: number;
}

function extractText(content: any[]): string {
  if (!Array.isArray(content)) return '';
  const textBlocks = content.filter((b: any) => b.type === 'text');
  if (textBlocks.length === 0) return '';
  return typeof textBlocks[0].content === 'string' ? textBlocks[0].content.substring(0, 150) + '...' : '';
}

export default function ArticleHighlights() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLatestArticles() {
      try {
        setLoading(true);
        // Fetch published articles, maximum 4
        const fetchedArticles = await getArticles({ is_published: true, limit: 4 });
        setArticles(fetchedArticles);
      } catch (error) {
        console.error('[ArticleHighlights] Error loading articles:', error);
      } finally {
        setLoading(false);
      }
    }

    loadLatestArticles();
  }, []);

  if (loading || articles.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-white" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header Area */}
        <div className="flex justify-between items-end mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Newspaper className="text-indigo-600 w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">أحدث المقالات</h2>
            </div>
            <p className="text-gray-500">نصائح، أخبار تقنية، وشروحات تهمك</p>
          </div>
          <button
            onClick={() => router.push('/articles')}
            className="hidden sm:flex items-center text-indigo-600 font-medium hover:gap-2 transition-all gap-1"
          >
            عرض جميع المقالات <ArrowLeft size={18} />
          </button>
        </div>

        {/* Articles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/articles/${article.slug}`}
              className="group bg-gray-50 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col"
            >
              {/* Image Container */}
              <div className="relative aspect-[16/9] bg-gray-200 overflow-hidden">
                {article.cover_image ? (
                  <img
                    src={getDirectImageUrl(article.cover_image)}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Newspaper size={40} className="opacity-20" />
                  </div>
                )}
                {/* Type Badge */}
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-indigo-700 shadow-sm transition-transform duration-300 group-hover:-translate-y-1">
                  {article.type}
                </div>
              </div>

              {/* Content Container */}
              <div className="p-6 sm:p-8 flex flex-col flex-1 bg-white group-hover:bg-indigo-50/30 transition-colors">
                <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-indigo-600 transition-colors leading-relaxed">
                  {article.title}
                </h3>
                <p className="text-gray-600 text-sm mb-6 line-clamp-3 flex-1 leading-relaxed">
                  {article.summary || extractText(article.content)}
                </p>

                {/* Footer / Meta Info */}
                <div className="flex items-center justify-between text-xs font-medium text-gray-500 pt-5 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gray-100 rounded-full group-hover:bg-white transition-colors">
                      <Calendar size={14} className="text-gray-400" />
                    </div>
                    {article.published_at ? new Date(article.published_at).toLocaleDateString('en-GB') : 'حديث'}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gray-100 rounded-full group-hover:bg-white transition-colors">
                      <Eye size={14} className="text-gray-400" />
                    </div>
                    {article.view_count || 0}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
