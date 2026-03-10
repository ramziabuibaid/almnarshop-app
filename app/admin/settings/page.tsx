'use client';

import { useState, useEffect } from 'react';
import { Save, Clock, AlertCircle, CheckCircle, Megaphone, LayoutDashboard, Search, X } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';

export default function SettingsPage() {
    // State for all settings
    const [settings, setSettings] = useState({
        working_hours: '',
        announcement_text: '',
        announcement_active: false,
        hero_title: '',
        hero_description: '',
        hero_button_text: 'تسوق الآن',
        hero_selected_products: '[]', // JSON string of product IDs
    });

    const [products, setProducts] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProducts, setSelectedProducts] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            if (!res.ok) throw new Error('Failed to fetch settings');
            const data = await res.json();
            setSettings(prev => ({ ...prev, ...data }));
        } catch (error) {
            console.error('Error:', error);
            setStatus({ type: 'error', message: 'فشل تحميل الإعدادات' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Fetch products to be able to select them
        const fetchProducts = async () => {
            try {
                // Fetch products using supabase directly to avoid caching issues in admin
                const supabaseClient = (await import('@supabase/supabase-js')).createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );
                
                const { data } = await supabaseClient
                    .from('products')
                    .select('product_id, name, image_url, image_url_2, image_url_3, sale_price')
                    .eq('is_visible', true)
                    .order('created_at', { ascending: false });
                
                if (data) {
                    setProducts(data);
                }
            } catch (error) {
                console.error('Error fetching products:', error);
            }
        };
        fetchProducts();
    }, []);

    // Effect to map selected product IDs to full product objects once both are loaded
    useEffect(() => {
        if (products.length > 0 && settings.hero_selected_products) {
            try {
                const selectedIds = JSON.parse(settings.hero_selected_products);
                if (Array.isArray(selectedIds)) {
                    const matched = selectedIds.map(id => products.find(p => p.product_id === id)).filter(Boolean);
                    setSelectedProducts(matched);
                }
            } catch (e) {
                console.error('Error parsing hero_selected_products', e);
            }
        }
    }, [products, settings.hero_selected_products]);

    const handleSave = async () => {
        setSaving(true);
        setStatus(null);

        try {
            // Save all settings in parallel
            const promises = Object.entries(settings).map(([key, value]) =>
                fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key, value }),
                })
            );

            await Promise.all(promises);
            setStatus({ type: 'success', message: 'تم حفظ الإعدادات بنجاح' });
        } catch (error) {
            console.error('Error:', error);
            setStatus({ type: 'error', message: 'فشل حفظ الإعدادات' });
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key: string, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6">إعدادات المتجر</h1>

                {/* Status Message */}
                {status && (
                    <div className={`p-4 rounded-lg flex items-center gap-2 ${status.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                        }`}>
                        {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        <span>{status.message}</span>
                    </div>
                )}

                {/* Announcement Bar Settings */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/50 flex items-center gap-2">
                        <Megaphone className="text-gray-500 dark:text-gray-400" size={20} />
                        <h2 className="font-semibold text-gray-900 dark:text-gray-100">شريط الإعلانات (أعلى الصفحة)</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex items-center gap-3 mb-4">
                            <input
                                type="checkbox"
                                id="announcement_active"
                                checked={settings.announcement_active}
                                onChange={(e) => handleChange('announcement_active', e.target.checked)}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="announcement_active" className="text-gray-700 dark:text-gray-300 font-medium cursor-pointer">
                                تفعيل شريط الإعلانات
                            </label>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نص الإعلان</label>
                            <input
                                type="text"
                                value={settings.announcement_text}
                                onChange={(e) => handleChange('announcement_text', e.target.value)}
                                placeholder="مثال: خصم 20% على جميع المنتجات لفترة محدودة!"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900 dark:text-gray-100"
                                dir="rtl"
                            />
                        </div>
                    </div>
                </div>

                {/* Hero Section Settings */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/50 flex items-center gap-2">
                        <LayoutDashboard className="text-gray-500 dark:text-gray-400" size={20} />
                        <h2 className="font-semibold text-gray-900 dark:text-gray-100">واجهة المتجر (Hero Section)</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">العنوان الرئيسي</label>
                            <input
                                type="text"
                                value={settings.hero_title}
                                onChange={(e) => handleChange('hero_title', e.target.value)}
                                placeholder="مثال: اكتشف تشكيلة الخريف الجديدة"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900 dark:text-gray-100"
                                dir="rtl"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الوصف الفرعي</label>
                            <textarea
                                value={settings.hero_description}
                                onChange={(e) => handleChange('hero_description', e.target.value)}
                                placeholder="مثال: تسوق أحدث المنتجات بأسعار منافسة..."
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900 dark:text-gray-100"
                                dir="rtl"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نص الزر</label>
                            <input
                                type="text"
                                value={settings.hero_button_text}
                                onChange={(e) => handleChange('hero_button_text', e.target.value)}
                                placeholder="مثال: تسوق الآن"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900 dark:text-gray-100"
                                dir="rtl"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المنتجات المميزة في البانر (الجهة اليسرى)</label>
                            
                            {/* Selected Products List */}
                            {selectedProducts.length > 0 && (
                                <div className="mb-4 grid gap-2">
                                    {selectedProducts.map((product) => (
                                        <div key={product.product_id} className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded overflow-hidden flex items-center justify-center">
                                                    {(product.image_url || product.image_url_2 || product.image_url_3) ? (
                                                        <img src={product.image_url || product.image_url_2 || product.image_url_3} alt={product.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-xs text-gray-400">لا توجد</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{product.name}</p>
                                                    <p className="text-xs text-blue-600 dark:text-blue-400">₪{product.sale_price}</p>
                                                </div>
                                            </div>
                                            <button
                                                className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded-md transition-colors"
                                                onClick={() => {
                                                    const newSelected = selectedProducts.filter(p => p.product_id !== product.product_id);
                                                    setSelectedProducts(newSelected);
                                                    handleChange('hero_selected_products', JSON.stringify(newSelected.map(p => p.product_id)));
                                                }}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Product Search */}
                            <div className="relative">
                                <div className="relative">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        placeholder="ابحث عن منتج لإضافته للبانر..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-4 pr-10 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900 dark:text-gray-100"
                                    />
                                </div>
                                
                                {searchQuery && (
                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {products
                                            .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) && !selectedProducts.find(sp => sp.product_id === p.product_id))
                                            .slice(0, 10)
                                            .map((product) => (
                                                <button
                                                    key={product.product_id}
                                                    onClick={() => {
                                                        const newSelected = [...selectedProducts, product];
                                                        setSelectedProducts(newSelected);
                                                        handleChange('hero_selected_products', JSON.stringify(newSelected.map(p => p.product_id)));
                                                        setSearchQuery('');
                                                    }}
                                                    className="w-full text-right px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 flex items-center justify-between border-b border-gray-100 dark:border-slate-700/50 last:border-0"
                                                >
                                                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{product.name}</span>
                                                    <span className="text-xs text-blue-600 dark:text-blue-400">₪{product.sale_price}</span>
                                                </button>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">عوضاً عن صورة ثابتة، سيتم عرض هذه المنتجات بطريقة احترافية (3D Floating) في يسار البانر.</p>
                        </div>
                    </div>
                </div>

                {/* Working Hours Card */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/50 flex items-center gap-2">
                        <Clock className="text-gray-500 dark:text-gray-400" size={20} />
                        <h2 className="font-semibold text-gray-900 dark:text-gray-100">أوقات الدوام</h2>
                    </div>

                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                نص أوقات الدوام (يظهر في الصفحة الرئيسية)
                            </label>
                            <input
                                type="text"
                                value={settings.working_hours}
                                onChange={(e) => handleChange('working_hours', e.target.value)}
                                placeholder="مثال: من الساعة 8:30 صباحاً - 6:00 مساءً"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900 dark:text-gray-100"
                                dir="rtl"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                يمكنك تغيير هذا النص في أي وقت (مثلاً: التوقيت الشتوي/الصيفي).
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-700/50 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {saving ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save size={18} />
                        )}
                        <span>حفظ التغييرات</span>
                    </button>
                </div>
            </div>
        </AdminLayout>
    );
}
