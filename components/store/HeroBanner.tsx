'use client';

import { ChevronDown, ShoppingBag, ArrowLeft, Star, TrendingUp, Store } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HeroBanner() {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [settings, setSettings] = useState({
    title: 'التميز في عالم الأجهزة',
    description: 'اكتشف مستوى جديد من الرفاهية والتكنولوجيا لمنزلك...',
    buttonText: 'تسوق الآن'
  });

  useEffect(() => {
    setIsVisible(true);
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.hero_title) {
          setSettings(prev => ({ ...prev, title: data.hero_title }));
        }
        if (data.hero_description) {
          setSettings(prev => ({ ...prev, description: data.hero_description }));
        }
        if (data.hero_button_text) {
          setSettings(prev => ({ ...prev, buttonText: data.hero_button_text }));
        }
      })
      .catch(err => console.error('Failed to fetch hero settings:', err));
  }, []);

  const navigateToShop = () => {
    router.push('/shop');
  };

  return (
    <section className="relative w-full min-h-[500px] lg:min-h-[600px] overflow-hidden bg-[#0a0a0a] flex items-center">

      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-[#111] to-black opacity-90" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#D4AF37] opacity-10 rounded-full blur-[120px] transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-900 opacity-10 rounded-full blur-[100px] transform -translate-x-1/3 translate-y-1/3" />

        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      <div className="container relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full py-12 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center h-full">

          {/* Text Content */}
          <div className={`text-right space-y-6 transform transition-all duration-1000 ease-out ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} dir="rtl">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5 backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
              <span className="text-[#D4AF37] text-xs sm:text-sm font-bold tracking-wide">
                وصل حديثاً: تشكيلة 2026
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-white leading-tight tracking-tight">
              {settings.title}
            </h1>

            <p className="text-gray-400 text-lg sm:text-xl max-w-xl leading-relaxed">
              {settings.description}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 pt-4">
              <button
                onClick={navigateToShop}
                className="group relative px-8 py-4 bg-[#D4AF37] text-black font-bold text-lg rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(212,175,55,0.5)]"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative flex items-center gap-2">
                  {settings.buttonText} <ShoppingBag size={20} />
                </span>
              </button>

              <button
                className="px-8 py-4 bg-white/5 border border-white/10 text-white font-semibold text-lg rounded-xl backdrop-blur-sm hover:bg-white/10 transition-colors flex items-center gap-2"
                onClick={() => {
                  const showroomSection = document.getElementById('showroom-section');
                  if (showroomSection) showroomSection.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                زيارة المعرض <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Social Proof */}
            <div className="pt-8 flex items-center gap-4 text-sm text-gray-500 border-t border-white/5 w-fit">
              <div className="flex -space-x-2 space-x-reverse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-gray-800 border-2 border-black flex items-center justify-center text-xs font-bold text-gray-400">
                    <span className="sr-only">User {i}</span>
                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 rounded-full" />
                  </div>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1 text-[#D4AF37]">
                  <Star size={14} fill="currentColor" />
                  <Star size={14} fill="currentColor" />
                  <Star size={14} fill="currentColor" />
                  <Star size={14} fill="currentColor" />
                  <Star size={14} fill="currentColor" />
                </div>
                <span>موثوق من قبل +5000 عميل</span>
              </div>
            </div>
          </div>

          {/* Graphical Content / Glassmorphism Cards */}
          <div className={`relative hidden lg:block h-full transition-all duration-1000 delay-300 ease-out ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-20 opacity-0'}`}>

            {/* Floating Card 1: Top Product */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[400px] h-[500px] bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-md rounded-3xl border border-white/10 shadow-2xl p-6 flex flex-col items-center justify-between group hover:-translate-y-6 transition-transform duration-500">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-50" />

              <div className="w-full flex justify-between items-start">
                <span className="px-3 py-1 bg-black/40 rounded-full text-xs text-white border border-white/10">الأكثر مبيعاً</span>
                <button className="text-white/60 hover:text-[#D4AF37]"><Star /></button>
              </div>

              {/* Product Image Placeholder */}
              <div className="relative w-64 h-64 my-4">
                <div className="absolute inset-0 bg-[#D4AF37] rounded-full opacity-20 filter blur-3xl animate-pulse" />
                <Image
                  src="/logo.png"
                  alt="Hero Product"
                  fill
                  className="object-contain drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-500"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>

              <div className="text-center w-full">
                <h3 className="text-2xl font-bold text-white mb-2">تجهيزات كاملة</h3>
                <p className="text-gray-400 text-sm mb-4">احدث الغسالات والثلاجات الذكية</p>
                <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent mb-4" />
                <div className="flex justify-between items-center w-full px-4 text-white">
                  <span className="text-sm text-gray-400">ابتداءً من</span>
                  <span className="text-xl font-bold text-[#D4AF37]">₪1,200</span>
                </div>
              </div>
            </div>

            {/* Floating Tag: Discounts */}
            <div className="absolute top-20 right-10 bg-white/10 backdrop-blur-lg p-4 rounded-2xl border border-white/10 shadow-xl animate-float">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#D4AF37] rounded-lg text-black">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-300">خصومات تصل لـ</p>
                  <p className="text-lg font-bold text-white">35% خصم</p>
                </div>
              </div>
            </div>

            {/* Floating Tag: Payment */}
            <div className="absolute bottom-20 left-0 bg-white/10 backdrop-blur-lg p-4 rounded-2xl border border-white/10 shadow-xl animate-float" style={{ animationDelay: '2s' }}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500 rounded-lg text-white">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-300">شحن مجاني</p>
                  <p className="text-sm font-bold text-white">للطلبات فوق 500₪</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Scroll Down Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer opacity-50 hover:opacity-100 transition-opacity" onClick={navigateToShop}>
        <span className="text-xs text-white tracking-widest uppercase">تصفح المنتجات</span>
        <ChevronDown className="text-[#D4AF37] animate-bounce" />
      </div>
    </section>
  );
}
