'use client';

import { MapPin, Clock, Phone, Navigation } from 'lucide-react';
import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function ShowroomSection() {
    const [workingHours, setWorkingHours] = useState('من الساعة 8:30 صباحاً - 6:00 مساءً');

    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.working_hours) {
                    setWorkingHours(data.working_hours);
                }
            })
            .catch(err => console.error('Failed to fetch settings:', err));
    }, []);

    return (
        <section id="showroom-section" className="py-16 sm:py-24 bg-white overflow-hidden" dir="rtl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="grid lg:grid-cols-2 gap-12 items-center">

                    {/* Content */}
                    <div className="order-2 lg:order-1 space-y-8">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] text-sm font-medium mb-4">
                                <MapPin size={16} />
                                <span>فرعنا الرئيسي</span>
                            </div>
                            <h2 className="text-4xl font-bold text-gray-900 mb-4">
                                تفضل بزيارة معرضنا
                            </h2>
                            <p className="text-gray-600 text-lg leading-relaxed">
                                عاين المنتجات على أرض الواقع وجرب أحدث الأجهزة بنفسك.
                                فريقنا المتخصص في انتظارك للمساعدة في اختيار الأنسب لك.
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100 dark:bg-gray-800/50">
                                <div className="p-3 bg-white rounded-lg shadow-sm text-[#D4AF37]">
                                    <MapPin size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 mb-1">الموقع</h3>
                                    <p className="text-gray-600">جنين - شارع الناصرة</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100 dark:bg-gray-800/50">
                                <div className="p-3 bg-white rounded-lg shadow-sm text-[#D4AF37]">
                                    <Clock size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 mb-1">أوقات الدوام</h3>
                                    <p className="text-gray-600">{workingHours}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100 dark:bg-gray-800/50">
                                <div className="p-3 bg-white rounded-lg shadow-sm text-[#D4AF37]">
                                    <Phone size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 mb-1">إتصل بنا</h3>
                                    <p className="text-gray-600 font-mono" dir="ltr">0599048348</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4">
                            <a
                                href="https://maps.app.goo.gl/S9XQekdNpB9pbJZ39"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-colors shadow-lg shadow-gray-900/20 flex-1 sm:flex-none"
                            >
                                <Navigation size={20} />
                                <span>الموقع (Maps)</span>
                            </a>

                            <a
                                href="https://wa.me/972599048348"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl hover:bg-[#128C7E] transition-colors shadow-lg shadow-green-500/20 flex-1 sm:flex-none"
                            >
                                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="css-i6dzq1"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                <span>واتس اب</span>
                            </a>
                        </div>
                    </div>

                    {/* Visual/Map Placeholder */}
                    <div className="order-1 lg:order-2 relative h-[400px] lg:h-[600px] rounded-3xl overflow-hidden shadow-2xl group">
                        {/* This would ideally be a real image of the showroom */}
                        <div className="absolute inset-0 bg-gray-800">
                            <div className="absolute inset-0 opacity-40 mix-blend-overlay bg-[url('https://images.unsplash.com/photo-1581539250439-c923cd22671a?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        </div>

                        <div className="absolute bottom-8 right-8 text-white">
                            <p className="text-white/80 text-sm mb-2">جولة في المعرض</p>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="font-bold">مفتوح الآن</span>
                            </div>
                        </div>

                        {/* Map Decoration */}
                        <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md p-2 rounded-lg border border-white/20">
                            <MapPin className="text-white" />
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
