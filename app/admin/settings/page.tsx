'use client';

import { useState, useEffect, useMemo } from 'react';
import { Save, Clock, AlertCircle, CheckCircle, Megaphone, LayoutDashboard, Check } from 'lucide-react';
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
        hero_badge_text: 'وصل حديثاً: تشكيلة 2026',
        hero_selected_categories: [] as string[], // Store as array directly
    });

    const [products, setProducts] = useState<any[]>([]);
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
            
            // Robustly handle JSONB data which might be auto-parsed by Supabase
            // but might still be a string if it was saved as JSON.stringify previously
            Object.keys(data).forEach(key => {
                if (key === 'hero_selected_categories' && typeof data[key] === 'string') {
                    try {
                        data[key] = JSON.parse(data[key]);
                    } catch {
                        data[key] = [];
                    }
                }
                // Ensure it's an array for state consistency
                if (key === 'hero_selected_categories' && !Array.isArray(data[key])) {
                    data[key] = [];
                }
            });

            console.log('Admin settings loaded:', data);
            setSettings(prev => ({ ...prev, ...data }));
        } catch (error) {
            console.error('Error fetching settings:', error);
            setStatus({ type: 'error', message: 'فشل تحميل الإعدادات' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Fetch products to extract unique categories
        const fetchProducts = async () => {
            try {
                const supabaseClient = (await import('@supabase/supabase-js')).createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );

                const { data, error } = await supabaseClient
                    .from('products')
                    .select('product_id, name, type, sale_price')
                    .eq('is_visible', true);

                if (error) throw error;
                if (data) {
                    console.log(`Admin categories: Found ${data.length} products`);
                    setProducts(data);
                }
            } catch (error) {
                console.error('Error fetching products for categories:', error);
            }
        };
        fetchProducts();
    }, []);

    // Extract unique categories from products
    const availableCategories = useMemo(() => {
        const categoryMap = new Map<string, number>();
        products.forEach((product) => {
            const type = product.type || product.Type || '';
            if (type && type.trim() !== '') {
                categoryMap.set(type, (categoryMap.get(type) || 0) + 1);
            }
        });
        const extracted = Array.from(categoryMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }));
        
        console.log('Extracted available categories:', extracted);
        return extracted;
    }, [products]);

    // Current selected categories from state
    const selectedCategories: string[] = useMemo(() => {
        return Array.isArray(settings.hero_selected_categories) ? settings.hero_selected_categories : [];
    }, [settings.hero_selected_categories]);

    const toggleCategory = (categoryName: string) => {
        const isSelected = selectedCategories.includes(categoryName);
        const newSelected = isSelected
            ? selectedCategories.filter(c => c !== categoryName)
            : [...selectedCategories, categoryName];
        
        console.log('Toggling category:', categoryName, 'New selection:', newSelected);
        handleChange('hero_selected_categories', newSelected);
    };

    const handleSave = async () => {
        setSaving(true);
        setStatus(null);
        console.log('Submitting settings save:', settings);

        try {
            // Save settings sequentially for better reliability and detailed error reporting
            for (const [key, value] of Object.entries(settings)) {
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key, value }),
                });
                
                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(`فشل في حفظ ${key}: ${errData.error || res.statusText}`);
                }
            }

            setStatus({ type: 'success', message: 'تم حفظ جميع الإعدادات بنجاح' });
            console.log('All settings saved successfully');
        } catch (error: any) {
            console.error('Error saving settings:', error);
            setStatus({ type: 'error', message: error.message || 'فشل حفظ الإعدادات' });
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
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">إعدادات المتجر</h1>
                    {status?.type === 'success' && (
                        <div className="flex items-center gap-2 text-green-600 font-medium animate-pulse">
                            <CheckCircle size={18} />
                            <span>تم الحفظ</span>
                        </div>
                    )}
                </div>

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
                        <div className="flex items-center gap-3 mb-2">
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
                                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-700"
                                dir="rtl"
                            />
                        </div>
                    </div>
                </div>

                {/* Hero Section Settings */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/50 flex items-center gap-2">
                        <LayoutDashboard className="text-gray-500 dark:text-gray-400" size={20} />
                        <h2 className="font-semibold text-gray-900 dark:text-gray-100">واجهة المتجر (Hero Banner)</h2>
                    </div>
                    <div className="p-6 space-y-5">
                        {/* Badge Text */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نص الشارة (Badge)</label>
                            <input
                                type="text"
                                value={settings.hero_badge_text}
                                onChange={(e) => handleChange('hero_badge_text', e.target.value)}
                                placeholder="مثال: وصل حديثاً: تشكيلة 2026"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-700"
                                dir="rtl"
                            />
                        </div>

                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">العنوان الرئيسي</label>
                            <input
                                type="text"
                                value={settings.hero_title}
                                onChange={(e) => handleChange('hero_title', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-700"
                                dir="rtl"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الوصف</label>
                            <textarea
                                value={settings.hero_description}
                                onChange={(e) => handleChange('hero_description', e.target.value)}
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-700"
                                dir="rtl"
                            />
                        </div>

                        {/* Button Text */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نص الزر</label>
                            <input
                                type="text"
                                value={settings.hero_button_text}
                                onChange={(e) => handleChange('hero_button_text', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-700"
                                dir="rtl"
                            />
                        </div>

                        {/* Category Selection */}
                        <div className="pt-2 border-t border-gray-100 dark:border-slate-700">
                            <label className="block text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">الأصناف التي سيتم عرضها في البانر</label>
                            
                            {products.length === 0 && !loading ? (
                                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center text-sm text-orange-600 dark:text-orange-400">
                                    لم يتم العثور على أي منتجات في المتجر لاستخراج الأصناف.
                                </div>
                            ) : availableCategories.length === 0 ? (
                                <div className="p-4 bg-gray-50 dark:bg-slate-700/30 rounded-lg text-center text-sm text-gray-500 dark:text-gray-400">
                                    {loading ? 'جاري تحميل الأصناف المنتجات...' : 'لم يتم العثور على أصناف.'}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                    {availableCategories.map(({ name, count }) => {
                                        const isSelected = selectedCategories.includes(name);
                                        return (
                                            <button
                                                key={name}
                                                type="button"
                                                onClick={() => toggleCategory(name)}
                                                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 text-right ${
                                                    isSelected
                                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 dark:border-blue-400'
                                                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-200 dark:hover:border-slate-500'
                                                }`}
                                            >
                                                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                                                    isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600'
                                                }`}>
                                                    {isSelected && <Check size={14} strokeWidth={4} />}
                                                </div>
                                                <div className="flex flex-col min-w-0 overflow-hidden">
                                                    <span className={`text-sm font-bold truncate ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`}>{name}</span>
                                                    <span className="text-[10px] text-gray-500">{count} منتجات</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {selectedCategories.length > 0 && (
                                <div className="mt-4 p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-100/50 dark:border-blue-800/50">
                                    <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                        الأصناف المحددة حالياً ({selectedCategories.length}): {selectedCategories.join('، ')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Working Hours Settings */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/50 flex items-center gap-2">
                        <Clock className="text-gray-500 dark:text-gray-400" size={20} />
                        <h2 className="font-semibold text-gray-900 dark:text-gray-100">أوقات الدوام</h2>
                    </div>
                    <div className="p-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نص أوقات الدوام</label>
                        <input
                            type="text"
                            value={settings.working_hours}
                            onChange={(e) => handleChange('working_hours', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900 dark:text-gray-100 bg-white dark:bg-slate-700"
                            dir="rtl"
                        />
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 pb-8">
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="flex items-center gap-2 px-10 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95"
                    >
                        {saving ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save size={20} />
                        )}
                        <span>حفظ جميع الإعدادات</span>
                    </button>
                </div>
            </div>
        </AdminLayout>
    );
}
