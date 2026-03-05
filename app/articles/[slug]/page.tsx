import { getArticleBySlug, getProductById } from '@/lib/api';
import { notFound } from 'next/navigation';
import StoreHeader from '@/components/store/StoreHeader';
import StoreFooter from '@/components/store/StoreFooter';
import ViewCounterPing from '@/components/store/ViewCounterPing';
import ProductCard from '@/components/store/ProductCard';
import { getDirectImageUrl } from '@/lib/utils';
import { Calendar, Eye, Share2, ArrowRight, Package } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    try {
        const resolvedParams = await params;
        const decodedSlug = decodeURIComponent(resolvedParams.slug);
        const article = await getArticleBySlug(decodedSlug);
        if (!article || !article.is_published) return {};

        return {
            title: `${article.title} | مدونة المنار`,
            description: article.summary,
            openGraph: {
                images: [getDirectImageUrl(article.cover_image)]
            }
        };
    } catch (e) {
        return {};
    }
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    let article;

    try {
        const resolvedParams = await params;
        const decodedSlug = decodeURIComponent(resolvedParams.slug);
        article = await getArticleBySlug(decodedSlug);
    } catch (e) {
        notFound();
    }

    if (!article || !article.is_published) {
        notFound();
    }

    // Pre-fetch all products mentioned in product blocks to render them Server-Side
    const blocks = article.content || [];
    const productBlocks = blocks.filter((b: any) => b.type === 'products');
    const allProductIds = new Set<string>();
    productBlocks.forEach((pb: any) => {
        if (Array.isArray(pb.content)) {
            pb.content.forEach((id: string) => allProductIds.add(id));
        }
    });

    // Fetch product models
    const productMap = new Map();
    await Promise.all(
        Array.from(allProductIds).map(async (id) => {
            try {
                const prod = await getProductById(id);
                if (prod) productMap.set(id, prod);
            } catch (e) { }
        })
    );

    return (
        <div className="min-h-screen bg-white flex flex-col" dir="rtl">
            <StoreHeader />
            <ViewCounterPing articleId={article.id} />

            <main className="flex-1 w-full pb-16">
                {/* Hero Section */}
                <section className="relative bg-gray-900 text-white min-h-[40vh] md:min-h-[50vh] flex items-end pb-12 pt-32">
                    {article.cover_image && (
                        <div className="absolute inset-0 overflow-hidden">
                            <img
                                src={getDirectImageUrl(article.cover_image)}
                                alt={article.title}
                                className="w-full h-full object-cover opacity-40"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />
                        </div>
                    )}

                    <div className="relative max-w-4xl mx-auto px-4 sm:px-6 w-full z-10">
                        <Link href="/articles" className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-8 bg-white/10 px-4 py-2 rounded-full backdrop-blur-md text-sm font-medium">
                            <ArrowRight size={16} /> العودة للمقالات
                        </Link>

                        <div className="mb-4">
                            <span className="inline-block bg-indigo-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg">
                                {article.type}
                            </span>
                        </div>

                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
                            {article.title}
                        </h1>

                        {article.summary && (
                            <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-3xl leading-relaxed opacity-90">
                                {article.summary}
                            </p>
                        )}

                        <div className="flex flex-wrap items-center gap-6 text-sm text-gray-300 font-medium">
                            <div className="flex items-center gap-2">
                                <Calendar size={18} className="text-indigo-400" />
                                {article.published_at ? new Date(article.published_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'حديث'}
                            </div>
                            <div className="flex items-center gap-2">
                                <Eye size={18} className="text-indigo-400" />
                                {article.view_count || 0} مشاهدة
                            </div>
                        </div>
                    </div>
                </section>

                {/* Content Blocks */}
                <article className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-16 space-y-12">
                    {blocks.map((block: any, idx: number) => {
                        if (block.type === 'text') {
                            return (
                                <div key={block.id || idx} className="prose prose-lg md:prose-xl max-w-none prose-indigo text-gray-800 leading-loose prose-p:my-6 prose-headings:font-bold prose-a:text-indigo-600 hover:prose-a:text-indigo-500 whitespace-pre-wrap font-cairo">
                                    {block.content}
                                </div>
                            );
                        }
                        if (block.type === 'image') {
                            return (
                                <figure key={block.id || idx} className="my-12">
                                    <div className="rounded-2xl overflow-hidden shadow-lg bg-gray-50 border border-gray-100">
                                        <img
                                            src={getDirectImageUrl(block.content)}
                                            alt={`صورة توضيحية ${idx}`}
                                            className="w-full h-auto max-h-[70vh] object-contain"
                                            loading="lazy"
                                        />
                                    </div>
                                </figure>
                            );
                        }
                        if (block.type === 'products') {
                            const productIds = Array.isArray(block.content) ? block.content : [];
                            const validProducts = productIds.map((id: any) => productMap.get(id)).filter(Boolean);

                            if (validProducts.length === 0) return null;

                            return (
                                <div key={block.id || idx} className="my-16 bg-gradient-to-br from-indigo-50 to-blue-50 p-6 md:p-10 rounded-3xl border border-indigo-100/50 shadow-inner">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                            <Package size={24} />
                                        </div>
                                        <h3 className="text-2xl font-bold text-indigo-900 m-0">منتجات مقترحة لك</h3>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {validProducts.map((p: any) => (
                                            <div key={p.id || p.ProductID} className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300">
                                                <ProductCard product={p} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })}
                </article>
            </main>

            <StoreFooter />
        </div >
    );
}
