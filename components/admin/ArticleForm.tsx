'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Article, ArticleBlock, ArticleBlockType, Product } from '@/types';
import { saveArticle, getProducts } from '@/lib/api';
import { Plus, Trash, ArrowUp, ArrowDown, Image as ImageIcon, Type, Package, X, Check, Upload, GripVertical, Table as TableIcon, Columns, Rows } from 'lucide-react';
import { getDirectImageUrl } from '@/lib/utils';
import RichTextEditor from './RichTextEditor';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItemWrapper({ id, children }: { id: string, children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = { transform: CSS.Transform.toString(transform), transition, zIndex: transform ? 50 : 'auto', position: 'relative' as any };
    return (
        <div ref={setNodeRef} style={style} className="relative bg-white border border-gray-200 rounded-lg p-4 shadow-sm group">
            <div {...attributes} {...listeners} className="absolute top-2 left-2 cursor-grab text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 z-10 touch-none">
                <GripVertical size={16} />
            </div>
            {children}
        </div>
    );
}


interface ArticleFormProps {
    initialData?: Article;
    onSave?: (articleData: any) => Promise<void>;
    hidePublishOption?: boolean;
}

const ARTICLE_TYPES = [
    'أخبار تقنية',
    'نصائح',
    'شروحات',
    'معلومات عامة'
];

export default function ArticleForm({ initialData, onSave, hidePublishOption }: ArticleFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [title, setTitle] = useState(initialData?.title || '');
    const [slug, setSlug] = useState(initialData?.slug || '');
    const [type, setType] = useState(initialData?.type || ARTICLE_TYPES[0]);
    const [summary, setSummary] = useState(initialData?.summary || '');
    const [coverImage, setCoverImage] = useState(initialData?.cover_image || '');
    const [isPublished, setIsPublished] = useState(initialData?.is_published || false);

    // Search state for product selection
    const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [blocks, setBlocks] = useState<ArticleBlock[]>(initialData?.content || []);

    // For product selection block
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [productsLoading, setProductsLoading] = useState(false);

    const [uploadingImage, setUploadingImage] = useState<string | null>(null);
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzNsFS3q_wyBqS_tBW1fe9DF1HIrg3mvECey8c9WqgXBO_MGiIN31j-Ew25yYjWOOs/exec";

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, onSuccess: (url: string) => void, contextId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploadingImage(contextId);

            let fileToUpload = file;
            try {
                const imageCompression = (await import('browser-image-compression')).default;
                fileToUpload = await imageCompression(file, {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1200,
                    useWebWorker: true,
                });
            } catch (compErr) {
                console.warn('Image compression failed, using original', compErr);
            }

            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const base64Data = reader.result as string;
                    const base64 = base64Data.split(',')[1];

                    const formData = new FormData();
                    formData.append('fileData', base64);
                    formData.append('mimeType', fileToUpload.type);
                    formData.append('fileName', fileToUpload.name);

                    const res = await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        body: formData
                    });

                    const result = await res.json();

                    if (result.status === 'success') {
                        onSuccess(result.fileId);
                    } else {
                        throw new Error(result.message || 'فشل الرفع');
                    }
                } catch (err: any) {
                    console.error('Upload Error:', err);
                    alert('تعذر الرفع: ' + (err.message || 'خطأ غير معروف'));
                } finally {
                    setUploadingImage(null);
                }
            };
            if (fileToUpload) {
                reader.readAsDataURL(fileToUpload);
            }
        } catch (err: any) {
            alert(err.message || 'حدث خطأ أثناء معالجة الصورة');
            setUploadingImage(null);
        }
    };

    useEffect(() => {
        // Autogenerate slug from title if empty
        if (!initialData && title && !slug) {
            const generated = title.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-').replace(/(^-|-$)/g, '');
            setSlug(generated);
        }
    }, [title]);

    useEffect(() => {
        // Load products for the product selector
        const loadProducts = async () => {
            setProductsLoading(true);
            try {
                const prod = await getProducts();
                setAllProducts(prod || []);
            } catch (err) {
                console.error('Failed to load products', err);
            } finally {
                setProductsLoading(false);
            }
        };
        loadProducts();
    }, []);

    const handleAddBlock = (blockType: ArticleBlockType) => {
        let initialContent: any = '';
        if (blockType === 'products') initialContent = [];
        if (blockType === 'table') initialContent = { rows: [['اسم الخاصية', 'المنتج 1', 'المنتج 2'], ['السعر', '-', '-']] };

        const newBlock: ArticleBlock = {
            id: Math.random().toString(36).substring(2, 9),
            type: blockType,
            content: initialContent
        };
        setBlocks([...blocks, newBlock]);
    };

    const handleRemoveBlock = (index: number) => {
        const newBlocks = [...blocks];
        newBlocks.splice(index, 1);
        setBlocks(newBlocks);
    };

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setBlocks((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === blocks.length - 1) return;

        const newBlocks = [...blocks];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        const temp = newBlocks[index];
        newBlocks[index] = newBlocks[targetIndex];
        newBlocks[targetIndex] = temp;

        setBlocks(newBlocks);
    };

    const handleBlockContentChange = (index: number, content: any) => {
        const newBlocks = [...blocks];
        newBlocks[index].content = content;
        setBlocks(newBlocks);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !slug || !type) {
            setError('يرجى تعبئة الحقول الأساسية (العنوان، الرابط، النوع)');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const articleData = {
                ...(initialData?.id ? { id: initialData.id } : {}),
                title,
                slug,
                type,
                summary,
                cover_image: coverImage,
                content: blocks,
                is_published: isPublished,
                published_at: isPublished && !initialData?.published_at ? new Date().toISOString() : initialData?.published_at
            };

            if (onSave) {
                await onSave(articleData);
            } else {
                await saveArticle(articleData);
                router.push('/admin/articles');
                router.refresh();
            }
        } catch (err: any) {
            setError(err.message || 'حدث خطأ أثناء حفظ المقالة');
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSave} className="space-y-8">
            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg">
                    {error}
                </div>
            )}

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                <h2 className="text-xl font-bold text-gray-900 border-b pb-2">المعلومات الأساسية</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">عنوان المقالة *</label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                            placeholder="مثال: كيف تختار الثلاجة المناسبة"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">الرابط الدائم (Slug) *</label>
                        <input
                            type="text"
                            required
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-left text-gray-900"
                            dir="ltr"
                            placeholder="how-to-choose-fridge"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">نوع المقالة *</label>
                        <select
                            required
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        >
                            {ARTICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    {!hidePublishOption && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">حالة النشر</label>
                            <div className="flex items-center h-[50px] gap-3">
                                <button
                                    type="button"
                                    dir="ltr"
                                    onClick={() => setIsPublished(!isPublished)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isPublished ? 'bg-blue-600' : 'bg-gray-200'
                                        }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isPublished ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                    />
                                </button>
                                <span className="text-sm font-medium text-gray-700">{isPublished ? 'منشور للعامة' : 'مسودة مخفية'}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">ملخص قصير</label>
                    <textarea
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 h-24 text-gray-900"
                        placeholder="ملخص يظهر في بطاقة المقالة في الصفحة الرئيسية"
                    />
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <label className="block text-sm font-bold text-gray-800">صورة الغلاف (رئيسية)</label>
                        <label className={`cursor-pointer text-sm flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border shadow-sm ${uploadingImage === 'cover' ? 'bg-gray-100 text-gray-500 border-gray-300' : 'bg-blue-600 text-white hover:bg-blue-700 border-blue-700'}`}>
                            {uploadingImage === 'cover' ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                                <Upload size={16} />
                            )}
                            <span className="font-medium">{uploadingImage === 'cover' ? 'جاري الرفع...' : 'رفع صورة من جهازك'}</span>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleImageUpload(e, (url) => setCoverImage(url), 'cover')}
                                disabled={uploadingImage === 'cover'}
                            />
                        </label>
                    </div>
                    <div className="flex gap-2 items-center">
                        <span className="text-xs text-gray-500 whitespace-nowrap">الرابط المباشر:</span>
                        <input
                            type="text"
                            value={coverImage}
                            onChange={(e) => setCoverImage(e.target.value)}
                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-left font-mono text-gray-900 text-sm"
                            dir="ltr"
                            placeholder="للتعديل اليدوي إن لزم الأمر (معرف جوجل درايف)"
                        />
                    </div>
                    {coverImage && (
                        <div className="mt-4 text-center border-t border-gray-100 pt-4">
                            <img src={getDirectImageUrl(coverImage)} alt="Preview" className="h-40 object-contain rounded-lg border inline-block shadow-sm" />
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                <div className="flex justify-between items-center border-b pb-2">
                    <h2 className="text-xl font-bold text-gray-900">محتوى المقالة (الكتل)</h2>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => handleAddBlock('text')} className="flex items-center gap-1 text-sm text-gray-900 font-medium bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                            <Type size={16} /> إضافة نص
                        </button>
                        <button type="button" onClick={() => handleAddBlock('image')} className="flex items-center gap-1 text-sm text-gray-900 font-medium bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                            <ImageIcon size={16} /> إضافة صورة
                        </button>
                        <button type="button" onClick={() => handleAddBlock('products')} className="flex items-center gap-1 text-sm text-gray-900 font-medium bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                            <Package size={16} /> ترويج أصناف
                        </button>
                        <button type="button" onClick={() => handleAddBlock('table')} className="flex items-center gap-1 text-sm text-gray-900 font-medium bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                            <TableIcon size={16} /> جدول مقارنة
                        </button>
                    </div>
                </div>

                {blocks.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                        لا يوجد محتوى بعد. استخدم الأزرار أعلاه لإضافة نص أو صور أو منتجات أو جداول.
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-4">
                                {blocks.map((block, index) => (
                                    <SortableItemWrapper key={block.id} id={block.id}>
                                        {/* Block Tools */}
                                        <div className="absolute top-2 left-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                            <button type="button" onClick={() => handleMoveBlock(index, 'up')} disabled={index === 0} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30" title="تحريك لأعلى">
                                                <ArrowUp size={16} />
                                            </button>
                                            <button type="button" onClick={() => handleMoveBlock(index, 'down')} disabled={index === blocks.length - 1} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30" title="تحريك لأسفل">
                                                <ArrowDown size={16} />
                                            </button>
                                            <button type="button" onClick={() => handleRemoveBlock(index)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="حذف الكتلة">
                                                <Trash size={16} />
                                            </button>
                                        </div>

                                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs">{index + 1}</span>
                                            {block.type === 'text' && <><Type size={16} /> كتلة نصية</>}
                                            {block.type === 'image' && <><ImageIcon size={16} /> صورة توضيحية</>}
                                            {block.type === 'table' && <><TableIcon size={16} /> جدول مقارنة</>}
                                        </div>

                                        {/* Block Content Renderers */}
                                        <div className="pr-10">
                                            {block.type === 'text' && (
                                                <RichTextEditor
                                                    value={block.content || ''}
                                                    onChange={(value) => handleBlockContentChange(index, value)}
                                                    placeholder="اكتب محتوى الفقرة هنا..."
                                                />
                                            )}

                                            {block.type === 'image' && (
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                                                        <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                                            <ImageIcon size={18} className="text-gray-400" />
                                                            عرض صورة في هذا القسم
                                                        </div>
                                                        <label className={`cursor-pointer text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors border shadow-sm ${uploadingImage === `block-${block.id}` ? 'bg-gray-100 text-gray-500 border-gray-300' : 'bg-blue-600 text-white hover:bg-blue-700 border-blue-700'}`}>
                                                            {uploadingImage === `block-${block.id}` ? (
                                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                            ) : (
                                                                <Upload size={14} />
                                                            )}
                                                            <span className="font-medium">{uploadingImage === `block-${block.id}` ? 'جاري الرفع...' : 'رفع من الجهاز'}</span>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={(e) => handleImageUpload(e, (url) => handleBlockContentChange(index, url), `block-${block.id}`)}
                                                                disabled={uploadingImage === `block-${block.id}`}
                                                            />
                                                        </label>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-xs text-gray-500 whitespace-nowrap">الرابط المباشر:</div>
                                                        <input
                                                            type="text"
                                                            value={block.content}
                                                            onChange={(e) => handleBlockContentChange(index, e.target.value)}
                                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-left font-mono text-gray-900 text-xs"
                                                            dir="ltr"
                                                            placeholder="رابط مباشر أو معرف جوجل درايف"
                                                        />
                                                    </div>
                                                    {block.content && typeof block.content === 'string' && (
                                                        <div className="mt-3 text-center border-t border-gray-100 pt-3">
                                                            <img src={getDirectImageUrl(block.content)} alt="Block Preview" className="max-h-64 object-contain rounded-lg border mx-auto shadow-sm" />
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {block.type === 'products' && (
                                                <div className="space-y-4">
                                                    {productsLoading ? (
                                                        <div className="text-sm text-gray-500">جاري تحميل قائمة المنتجات...</div>
                                                    ) : (
                                                        <div>
                                                            <label className="block text-sm text-gray-600 mb-2">اختر المنتجات المراد ترويجها:</label>
                                                            <div className="flex flex-wrap gap-2 mb-3">
                                                                {Array.isArray(block.content) && block.content.map(pid => {
                                                                    const p = allProducts.find(x => x.ProductID === pid || x.id === pid);
                                                                    return (
                                                                        <span key={pid} className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 px-2 py-1 rounded text-sm border border-blue-200">
                                                                            {p ? p.Name || p.name : pid}
                                                                            <button type="button" onClick={() => {
                                                                                handleBlockContentChange(index, block.content.filter((id: string) => id !== pid));
                                                                            }} className="text-blue-500 hover:text-blue-800">
                                                                                <X size={14} />
                                                                            </button>
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>

                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={activeSearchIndex === index ? searchQuery : ''}
                                                                    onChange={(e) => {
                                                                        setActiveSearchIndex(index);
                                                                        setSearchQuery(e.target.value);
                                                                    }}
                                                                    onFocus={() => {
                                                                        setActiveSearchIndex(index);
                                                                        if (searchQuery === '') setSearchQuery(''); // trigger render
                                                                    }}
                                                                    placeholder="ابحث عن منتج بالاسم أو الرقم الشامل..."
                                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                                                                />
                                                                {activeSearchIndex === index && (
                                                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                                        {allProducts
                                                                            .filter(p => {
                                                                                const sq = searchQuery.toLowerCase();
                                                                                if (!sq) return true;
                                                                                const name = String(p.Name || p.name || '').toLowerCase();
                                                                                const shamel = String(p['Shamel No'] || '').toLowerCase();
                                                                                return name.includes(sq) || shamel.includes(sq);
                                                                            })
                                                                            .slice(0, 50)
                                                                            .map(p => {
                                                                                const pid = p.ProductID || p.id;
                                                                                if (!pid) return null;
                                                                                const currentIds = Array.isArray(block.content) ? block.content : [];
                                                                                if (currentIds.includes(pid)) return null;

                                                                                return (
                                                                                    <button
                                                                                        key={pid}
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            handleBlockContentChange(index, [...currentIds, pid]);
                                                                                            setActiveSearchIndex(null);
                                                                                            setSearchQuery('');
                                                                                        }}
                                                                                        className="w-full text-right px-4 py-3 hover:bg-gray-100 text-gray-900 border-b last:border-0"
                                                                                    >
                                                                                        <div className="font-semibold text-sm">{p.Name || p.name}</div>
                                                                                        <div className="text-xs text-gray-500 mt-1 flex gap-3">
                                                                                            {p['Shamel No'] && <span>الشامل: {p['Shamel No']}</span>}
                                                                                            <span className="text-blue-600 font-bold">₪{p.SalePrice || p.price}</span>
                                                                                        </div>
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        {searchQuery && allProducts.filter(p => String(p.Name || p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || String(p['Shamel No'] || '').toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                                                            <div className="px-4 py-3 text-sm text-gray-500 text-center">لا توجد نتائج مطابقة</div>
                                                                        )}
                                                                        {!searchQuery && (
                                                                            <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-b">اكتب للبحث عن منتج...</div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {block.type === 'table' && block.content && block.content.rows && (
                                                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                                    <table className="w-full text-right bg-white text-sm">
                                                        <tbody>
                                                            {block.content.rows.map((row: string[], rowIndex: number) => (
                                                                <tr key={rowIndex} className="border-b last:border-0 relative group/row">
                                                                    {row.map((cell: string, colIndex: number) => (
                                                                        <td key={colIndex} className={`border-l last:border-0 p-0 relative group/cell ${rowIndex === 0 ? 'bg-gray-50 font-bold' : ''}`}>
                                                                            <div className="w-full h-full min-h-[60px]">
                                                                                <RichTextEditor
                                                                                    minimal={true}
                                                                                    value={cell}
                                                                                    onChange={(value) => {
                                                                                        const newRows = [...block.content.rows];
                                                                                        newRows[rowIndex] = [...newRows[rowIndex]];
                                                                                        newRows[rowIndex][colIndex] = value;
                                                                                        handleBlockContentChange(index, { rows: newRows });
                                                                                    }}
                                                                                    placeholder="محتوى الخلية..."
                                                                                />
                                                                            </div>
                                                                            {/* Add column button (show on first row cells) */}
                                                                            {rowIndex === 0 && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const newRows = block.content.rows.map((r: string[]) => {
                                                                                            const nr = [...r];
                                                                                            nr.splice(colIndex + 1, 0, ''); // insert empty cell after current
                                                                                            return nr;
                                                                                        });
                                                                                        handleBlockContentChange(index, { rows: newRows });
                                                                                    }}
                                                                                    className="absolute top-1 -left-3 z-10 bg-blue-100 text-blue-600 rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 hover:bg-blue-200 shadow-sm"
                                                                                    title="إضافة عمود هنا"
                                                                                ><Plus size={12} /></button>
                                                                            )}
                                                                            {/* Delete column button (if more than 1 col) */}
                                                                            {rowIndex === 0 && row.length > 1 && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        if (confirm('هل أنت متأكد من حذف هذا العمود بالكامل؟')) {
                                                                                            const newRows = block.content.rows.map((r: string[]) => {
                                                                                                const nr = [...r];
                                                                                                nr.splice(colIndex, 1);
                                                                                                return nr;
                                                                                            });
                                                                                            handleBlockContentChange(index, { rows: newRows });
                                                                                        }
                                                                                    }}
                                                                                    className="absolute top-7 -left-3 z-10 bg-red-100 text-red-600 rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 hover:bg-red-200 shadow-sm"
                                                                                    title="حذف هذا العمود"
                                                                                ><Trash size={12} /></button>
                                                                            )}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    <div className="bg-gray-50 border-t border-gray-200 p-2 flex gap-2">
                                                        <button type="button" onClick={() => {
                                                            const colsCount = block.content.rows[0].length;
                                                            const newRows = [...block.content.rows, Array(colsCount).fill('')];
                                                            handleBlockContentChange(index, { rows: newRows });
                                                        }} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold bg-blue-50 px-3 py-1.5 rounded transition-colors">
                                                            <Rows size={14} /> إضافة صف أسفل
                                                        </button>
                                                        {block.content.rows.length > 1 && (
                                                            <button type="button" onClick={() => {
                                                                const newRows = [...block.content.rows];
                                                                newRows.pop();
                                                                handleBlockContentChange(index, { rows: newRows });
                                                            }} className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 font-semibold bg-red-50 px-3 py-1.5 rounded transition-colors">
                                                                <Trash size={14} /> إزالة آخر صف
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </SortableItemWrapper>
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            <div className="flex justify-end gap-4 border-t pt-6 pb-12">
                <button
                    type="button"
                    onClick={() => router.push('/admin/articles')}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                    إلغاء
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <Check size={20} />
                    )}
                    <span>حفظ المقالة</span>
                </button>
            </div>
        </form>
    );
}
