'use client';

import { useState, useEffect } from 'react';
import { Save, Clock, AlertCircle, CheckCircle, Megaphone, LayoutDashboard } from 'lucide-react';
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
    });

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
                <h1 className="text-2xl font-bold text-gray-800 mb-6">إعدادات المتجر</h1>

                {/* Status Message */}
                {status && (
                    <div className={`p-4 rounded-lg flex items-center gap-2 ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                        {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        <span>{status.message}</span>
                    </div>
                )}

                {/* Announcement Bar Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                        <Megaphone className="text-gray-500" size={20} />
                        <h2 className="font-semibold text-gray-900">شريط الإعلانات (أعلى الصفحة)</h2>
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
                            <label htmlFor="announcement_active" className="text-gray-700 font-medium cursor-pointer">
                                تفعيل شريط الإعلانات
                            </label>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">نص الإعلان</label>
                            <input
                                type="text"
                                value={settings.announcement_text}
                                onChange={(e) => handleChange('announcement_text', e.target.value)}
                                placeholder="مثال: خصم 20% على جميع المنتجات لفترة محدودة!"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900"
                                dir="rtl"
                            />
                        </div>
                    </div>
                </div>

                {/* Hero Section Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                        <LayoutDashboard className="text-gray-500" size={20} />
                        <h2 className="font-semibold text-gray-900">واجهة المتجر (Hero Section)</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">العنوان الرئيسي</label>
                            <input
                                type="text"
                                value={settings.hero_title}
                                onChange={(e) => handleChange('hero_title', e.target.value)}
                                placeholder="مثال: اكتشف تشكيلة الخريف الجديدة"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900"
                                dir="rtl"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">الوصف الفرعي</label>
                            <textarea
                                value={settings.hero_description}
                                onChange={(e) => handleChange('hero_description', e.target.value)}
                                placeholder="مثال: تسوق أحدث المنتجات بأسعار منافسة..."
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900"
                                dir="rtl"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">نص الزر</label>
                            <input
                                type="text"
                                value={settings.hero_button_text}
                                onChange={(e) => handleChange('hero_button_text', e.target.value)}
                                placeholder="مثال: تسوق الآن"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900"
                                dir="rtl"
                            />
                        </div>
                    </div>
                </div>

                {/* Working Hours Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                        <Clock className="text-gray-500" size={20} />
                        <h2 className="font-semibold text-gray-900">أوقات الدوام</h2>
                    </div>

                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                نص أوقات الدوام (يظهر في الصفحة الرئيسية)
                            </label>
                            <input
                                type="text"
                                value={settings.working_hours}
                                onChange={(e) => handleChange('working_hours', e.target.value)}
                                placeholder="مثال: من الساعة 8:30 صباحاً - 6:00 مساءً"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right text-gray-900"
                                dir="rtl"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                يمكنك تغيير هذا النص في أي وقت (مثلاً: التوقيت الشتوي/الصيفي).
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
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
