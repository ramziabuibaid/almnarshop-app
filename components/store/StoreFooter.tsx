'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Phone, MapPin, Clock } from 'lucide-react';
import { FaWhatsapp, FaFacebookF, FaInstagram } from 'react-icons/fa';
import { useState, useEffect } from 'react';

export default function StoreFooter() {
    const currentYear = new Date().getFullYear();
    const [workingHours, setWorkingHours] = useState<string>('جاري التحميل...');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/settings');
                if (res.ok) {
                    const data = await res.json();
                    if (data.working_hours) {
                        setWorkingHours(data.working_hours);
                    } else {
                        setWorkingHours('غير متوفر حالياً');
                    }
                } else {
                    setWorkingHours('غير متوفر حالياً');
                }
            } catch (error) {
                console.error('Failed to fetch working hours:', error);
                setWorkingHours('غير متوفر حالياً');
            }
        };
        fetchSettings();
    }, []);

    return (
        <footer className="bg-white border-t border-gray-100 pt-16 pb-8 mt-12" dir="rtl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">

                    {/* Brand & About */}
                    <div className="space-y-6 text-right">
                        <Link href="/" className="inline-block">
                            <Image
                                src="/logo.png"
                                alt="ALMNAR"
                                width={180}
                                height={180}
                                className="w-auto h-24 lg:h-32 object-contain"
                            />
                        </Link>
                        <p className="text-gray-600 leading-relaxed text-sm lg:text-base pr-2">
                            وجهتكم الأولى لأفضل الأجهزة المنزلية والكهربائية. نوفر لكم جودة عالية، خدمة ممتازة، وأسعار تنافسية تلبي كافة احتياجاتكم من أرقى العلامات التجارية.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div className="text-right">
                        <h3 className="text-lg font-bold text-gray-900 mb-6">روابط سريعة</h3>
                        <ul className="space-y-4">
                            <li>
                                <Link href="/" className="text-gray-600 hover:text-[#D4AF37] transition-colors text-sm lg:text-base">الرئيسية</Link>
                            </li>
                            <li>
                                <Link href="/shop" className="text-gray-600 hover:text-[#D4AF37] transition-colors text-sm lg:text-base">الكتالوج</Link>
                            </li>
                            <li>
                                <Link href="/shop?type=ثلاجة" className="text-gray-600 hover:text-[#D4AF37] transition-colors text-sm lg:text-base">الثلاجات</Link>
                            </li>
                            <li>
                                <Link href="/shop?type=غسالة" className="text-gray-600 hover:text-[#D4AF37] transition-colors text-sm lg:text-base">الغسالات</Link>
                            </li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="text-right">
                        <h3 className="text-lg font-bold text-gray-900 mb-6">معلومات التواصل</h3>
                        <ul className="space-y-4">
                            <li>
                                <a href="tel:0599048348" className="flex items-center gap-3 text-gray-600 hover:text-[#D4AF37] transition-colors group">
                                    <div className="bg-gray-50 p-2 rounded-lg group-hover:bg-[#D4AF37]/10 transition-colors">
                                        <Phone size={18} className="text-gray-500 group-hover:text-[#D4AF37]" />
                                    </div>
                                    <span className="text-sm lg:text-base" dir="ltr">0599048348</span>
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://wa.me/972599048348"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 text-gray-600 hover:text-[#25D366] transition-colors group"
                                >
                                    <div className="bg-gray-50 p-2 rounded-lg group-hover:bg-[#25D366]/10 transition-colors">
                                        <FaWhatsapp size={20} className="text-[#25D366] drop-shadow-sm" />
                                    </div>
                                    <span className="text-sm lg:text-base font-semibold" dir="ltr">+972 59-904-8348</span>
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://maps.app.goo.gl/xRKnZ52zPQp6Em4m6"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start gap-3 text-gray-600 hover:text-[#D4AF37] transition-colors group"
                                >
                                    <div className="bg-gray-50 p-2 rounded-lg group-hover:bg-[#D4AF37]/10 transition-colors shrink-0">
                                        <MapPin size={18} className="text-gray-500 group-hover:text-[#D4AF37]" />
                                    </div>
                                    <span className="text-sm lg:text-base mt-1 leading-relaxed">جنين - شارع الناصرة</span>
                                </a>
                            </li>
                        </ul>

                    </div>

                    {/* Social Media */}
                    <div className="text-right">
                        <h3 className="text-lg font-bold text-gray-900 mb-6">تابعنا على</h3>
                        <div className="flex items-center gap-4">
                            <a
                                href="https://www.facebook.com/AlmnarHomeAppliances"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-gray-50 hover:bg-[#1877F2] hover:text-white text-[#1877F2] p-3 rounded-xl transition-all duration-300 shadow-sm"
                                aria-label="Facebook"
                            >
                                <FaFacebookF size={22} />
                            </a>
                            <a
                                href="https://www.instagram.com/almnarhomeappliances?igsh=eTNuZmszNnVunTd4"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-gray-50 hover:bg-gradient-to-tr hover:from-[#F56040] hover:to-[#C13584] hover:text-white text-[#C13584] p-3 rounded-xl transition-all duration-300 shadow-sm"
                                aria-label="Instagram"
                            >
                                <FaInstagram size={22} />
                            </a>
                            {/* TikTok Placeholder - Using a stylized textual icon until proper SVG is needed or link provided */}
                            <button
                                className="bg-gray-50 hover:bg-black hover:text-white text-gray-600 p-3 rounded-xl transition-all duration-300 flex items-center justify-center font-bold font-sans text-xl w-[46px] h-[46px]"
                                aria-label="TikTok coming soon"
                                title="قريباً على تيك توك"
                            >
                                <svg viewBox="0 0 448 512" width="20" height="20" fill="currentColor">
                                    <path d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z" />
                                </svg>
                            </button>
                        </div>

                        <h3 className="text-lg font-bold text-gray-900 mt-8 mb-4">أوقات العمل</h3>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3 text-gray-600">
                                <div className="bg-gray-50 p-2 rounded-lg shrink-0">
                                    <Clock size={18} className="text-gray-500" />
                                </div>
                                <div className="flex flex-col text-sm lg:text-base mt-0.5 w-full">
                                    <span className="text-gray-700 font-medium leading-relaxed">{workingHours}</span>
                                </div>
                            </li>
                        </ul>
                    </div>

                </div>

                {/* Copyright */}
                <div className="border-t border-gray-100 pt-8 flex flex-col items-center justify-center pb-8">
                    <p className="text-gray-500 text-sm text-center">
                        &copy; {currentYear} شركة المنار للأجهزة الكهربائية. جميع الحقوق محفوظة.
                    </p>
                </div>
            </div>
        </footer>
    );
}
