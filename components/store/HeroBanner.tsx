'use client';

import { ChevronDown, ShoppingBag, ArrowLeft, Star, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useShop } from '@/context/ShopContext';

// Local interface to match ShopContext's Product or handle its properties
interface ShopProduct {
  id: string;
  name: string;
  image?: string;
  image2?: string;
  image3?: string;
  price: number;
  type?: string;
  Type?: string;
  is_visible?: boolean;
  [key: string]: any;
}

interface HeroSettings {
  title: string;
  description: string;
  buttonText: string;
  badgeText: string;
  selectedCategories: string[];
}

const DEFAULT_SETTINGS: HeroSettings = {
  title: 'رؤية جديدة وحصرية في عالم الأجهزة',
  description: 'اكتشف مستوى جديد من الرفاهية والتكنولوجيا لمنزلك مع أحدث الأجهزة المنزلية بأسعار منافسة وجودة لا مثيل لها',
  buttonText: 'تسوق الآن',
  badgeText: 'مجموعة 2026: تميز بلا حدود',
  selectedCategories: [],
};

export default function HeroBanner() {
  const router = useRouter();
  const { products } = useShop(); // Use context instead of direct fetch
  const [isVisible, setIsVisible] = useState(false);
  const [settings, setSettings] = useState<HeroSettings>(DEFAULT_SETTINGS);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const autoRotateRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number>(0);

  // Fetch settings from API with cache-busting
  useEffect(() => {
    // Small delay to ensure animations trigger reliably after mount
    const timer = setTimeout(() => setIsVisible(true), 150);

    fetch(`/api/settings?v=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        console.log('HeroBanner raw settings from API:', data);
        const newSettings: HeroSettings = { ...DEFAULT_SETTINGS };
        
        if (data.hero_title) newSettings.title = data.hero_title;
        if (data.hero_description) newSettings.description = data.hero_description;
        if (data.hero_button_text) newSettings.buttonText = data.hero_button_text;
        if (data.hero_badge_text) newSettings.badgeText = data.hero_badge_text;
        
        // Handle hero_selected_categories (can be array or string)
        if (data.hero_selected_categories) {
          let cats = data.hero_selected_categories;
          if (typeof cats === 'string') {
            try { 
                cats = JSON.parse(cats); 
            } catch { 
                cats = []; 
            }
          }
          if (Array.isArray(cats)) {
            newSettings.selectedCategories = cats;
          }
        }
        
        console.log('HeroBanner processed settings:', newSettings);
        setSettings(newSettings);
      })
      .catch(err => console.error('Failed to fetch hero settings in Banner:', err));

      return () => clearTimeout(timer);
  }, []);

  // Use useMemo to filter and group products from context
  const categoryProductsMaps = useMemo(() => {
    const result: Record<string, ShopProduct[]> = {};
    if (settings.selectedCategories.length === 0 || (products as any[]).length === 0) return result;

    settings.selectedCategories.forEach(category => {
      const filtered = (products as any[]).filter(p => 
        (p.type === category || p.Type === category) && p.is_visible !== false
      ).slice(0, 6);
      
      if (filtered.length > 0) {
        result[category] = filtered;
      }
    });
    
    console.log(`HeroBanner: Found products for ${Object.keys(result).length} categories`);
    return result;
  }, [products, settings.selectedCategories]);

  const categories = useMemo(() => Object.keys(categoryProductsMaps), [categoryProductsMaps]);

  // Handle active index when categories change
  useEffect(() => {
    setActiveCategoryIndex(0);
  }, [categories.length]);

  const goToCategory = useCallback((index: number) => {
    if (isTransitioning || categories.length <= 1) return;
    setIsTransitioning(true);
    setActiveCategoryIndex(index);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning, categories.length]);

  const nextCategory = useCallback(() => {
    if (categories.length <= 1) return;
    goToCategory((activeCategoryIndex + 1) % categories.length);
  }, [activeCategoryIndex, categories.length, goToCategory]);

  const prevCategory = useCallback(() => {
    if (categories.length <= 1) return;
    goToCategory((activeCategoryIndex - 1 + categories.length) % categories.length);
  }, [activeCategoryIndex, categories.length, goToCategory]);

  // Auto-rotate categories
  useEffect(() => {
    if (categories.length <= 1) {
        if (autoRotateRef.current) clearInterval(autoRotateRef.current);
        return;
    }
    
    autoRotateRef.current = setInterval(() => {
      setActiveCategoryIndex(prev => (prev + 1) % categories.length);
    }, 6000);
    
    return () => {
      if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    };
  }, [categories.length]);

  // Reset auto-rotate on manual navigation
  const handleManualNav = useCallback((fn: () => void) => {
    if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    fn();
    if (categories.length > 1) {
        autoRotateRef.current = setInterval(() => {
          setActiveCategoryIndex(prev => (prev + 1) % categories.length);
        }, 6000);
    }
  }, [categories.length]);

  const navigateToShop = () => router.push('/shop');
  const navigateToCategory = (category: string) => router.push(`/shop?type=${encodeURIComponent(category)}`);

  const activeCategory = categories[activeCategoryIndex] || '';
  const activeProducts = categoryProductsMaps[activeCategory] || [];

  const getProductImage = (product: ShopProduct) => {
    return product.image || product.image2 || product.image3 || '/logo.png';
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      handleManualNav(diff > 0 ? nextCategory : prevCategory);
    }
  };

  return (
    <section className="relative w-full overflow-hidden bg-[#0a0a0a]" id="hero-banner" data-banner-v="1.2">

      {/* ── Background Effects ── */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-[#111] to-black" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#D4AF37] opacity-[0.08] rounded-full blur-[180px] translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-900 opacity-[0.05] rounded-full blur-[120px] -translate-x-1/4 translate-y-1/4" />

        {/* Dynamic stars/points */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-center">

          {/* ══════════════════════════════════════ */}
          {/* ──── Text Content (Right in RTL) ──── */}
          {/* ══════════════════════════════════════ */}
          <div
            className={`text-right space-y-6 transition-all duration-1000 ease-out ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
            dir="rtl"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5 backdrop-blur-md">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75 animate-hero-pulse-ring" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#D4AF37]" />
              </span>
              <span className="text-[#D4AF37] text-xs sm:text-sm font-black tracking-wider uppercase">
                {settings.badgeText}
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-[1.05] tracking-tight">
              {settings.title.split(' ').map((word, i, arr) => (
                <span key={i}>
                  {i === Math.floor(arr.length / 2) ? (
                    <span className="text-transparent bg-clip-text bg-gradient-to-l from-[#D4AF37] to-[#F0D060] drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]">
                      {word}
                    </span>
                  ) : word}
                  {' '}
                </span>
              ))}
            </h1>

            {/* Description */}
            <p className="text-gray-400 text-base sm:text-lg lg:text-xl max-w-xl leading-relaxed font-medium">
              {settings.description}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={navigateToShop}
                className="group relative px-8 py-4 bg-[#D4AF37] text-black font-black text-lg rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.03] active:scale-95 shadow-[0_15px_35px_-10px_rgba(212,175,55,0.4)]"
              >
                <div className="absolute inset-0 bg-white/30 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                <span className="relative flex items-center gap-3">
                  {settings.buttonText} <ShoppingBag size={22} strokeWidth={2.5} />
                </span>
              </button>

              <button
                className="px-8 py-4 bg-white/[0.03] border border-white/10 text-white font-bold text-lg rounded-2xl backdrop-blur-xl hover:bg-white/10 hover:border-white/20 transition-all duration-300 flex items-center gap-2 group"
                onClick={() => {
                  const footerSection = document.getElementById('site-footer');
                  if (footerSection) {
                    footerSection.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                  }
                }}
              >
                زيارة المعرض <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Social Proof */}
            <div className="pt-8 flex items-center gap-5 text-sm text-gray-400 border-t border-white/10 w-fit">
              <div className="flex -space-x-2.5 space-x-reverse">
                {[
                  'from-amber-500 to-orange-700',
                  'from-blue-500 to-indigo-700',
                  'from-emerald-500 to-teal-700',
                  'from-purple-500 to-pink-700',
                ].map((gradient, i) => (
                  <div key={i} className="w-9 h-9 rounded-full border-2 border-[#0a0a0a] overflow-hidden bg-gray-800 shadow-inner">
                    <div className={`w-full h-full bg-gradient-to-br ${gradient} opacity-80`} />
                  </div>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-0.5 text-[#D4AF37]">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <span className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-tighter">موثوق من قبل +5000 عميل</span>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════ */}
          {/* ── Category Product Showcase (Left) ── */}
          {/* ══════════════════════════════════════ */}
          <div
            className={`relative transition-all duration-1000 delay-300 ease-out ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-20 opacity-0'}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {categories.length > 0 ? (
              <div className="relative">
                {/* Category Selection Tabs */}
                <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide scroll-smooth no-scrollbar" dir="rtl">
                  {categories.map((cat, idx) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleManualNav(() => goToCategory(idx))}
                      className={`px-5 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all duration-500 border-2 ${
                        idx === activeCategoryIndex
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-[0_10px_20px_-5px_rgba(212,175,55,0.4)] scale-105'
                          : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white hover:border-white/10'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Products Grid */}
                <div className="relative min-h-[420px]">
                  {/* Category Content */}
                  <div
                    key={`${activeCategory}-${activeCategoryIndex}`}
                    className="animate-hero-slideCategory"
                  >
                    <div
                      className="relative bg-gradient-to-b from-white/[0.08] to-transparent backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-3xl p-6 sm:p-8 overflow-hidden group"
                    >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 animate-hero-shimmer pointer-events-none opacity-20" />

                        {/* Category Info Sidebar/Header */}
                        <div className="flex justify-between items-center mb-8" dir="rtl">
                          <div className="flex flex-col">
                            <span className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em] mb-1">تسوق الآن</span>
                            <h3 className="text-2xl font-black text-white">{activeCategory}</h3>
                          </div>
                          <button 
                            onClick={() => navigateToCategory(activeCategory)}
                            className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-all duration-300"
                          >
                            <ArrowLeft size={20} />
                          </button>
                        </div>

                        {/* Top Products Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
                          {activeProducts.slice(0, 3).map((product, pIdx) => (
                            <div
                              key={product.id}
                              className={`relative flex flex-col items-center ${pIdx === 0 ? 'animate-hero-float' : pIdx === 1 ? 'animate-hero-float-delayed' : ''}`}
                            >
                              <div 
                                className="relative aspect-square w-full bg-white/[0.03] rounded-3xl overflow-hidden border border-white/5 hover:bg-white/[0.08] transition-all duration-500 cursor-pointer p-3 sm:p-5"
                                onClick={() => router.push(`/product/${product.id}`)}
                              >
                                <Image
                                  src={getProductImage(product)}
                                  alt={product.name}
                                  fill
                                  className="object-contain p-2 hover:scale-110 transition-transform duration-700 drop-shadow-2xl"
                                  sizes="(max-width: 768px) 40vw, 15vw"
                                />
                              </div>
                              <div className="text-center mt-3" dir="rtl">
                                <p className="text-[11px] sm:text-xs text-gray-400 font-bold truncate max-w-[100px] mb-1">{product.name}</p>
                                <p className="text-sm font-black text-[#D4AF37]">₪{product.price?.toLocaleString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Lower previews if available */}
                        {activeProducts.length > 3 && (
                          <div className="flex justify-center gap-3 opacity-30 hover:opacity-60 transition-opacity duration-500">
                             {activeProducts.slice(3, 6).map((product) => (
                                <div key={product.id} className="w-10 h-10 relative bg-white/5 rounded-lg overflow-hidden p-1">
                                    <Image src={getProductImage(product)} fill alt="Small thumb" className="object-contain" />
                                </div>
                             ))}
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Slider Control Arrows */}
                  {categories.length > 1 && (
                    <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-6">
                      <button
                        onClick={() => handleManualNav(prevCategory)}
                        className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-90"
                      >
                        <ChevronRight size={20} />
                      </button>

                      {/* Dot indicators */}
                      <div className="flex gap-2">
                        {categories.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleManualNav(() => goToCategory(idx))}
                            className={`h-1.5 rounded-full transition-all duration-500 ${
                              idx === activeCategoryIndex
                                ? 'w-8 bg-[#D4AF37]'
                                : 'w-2 bg-white/20 hover:bg-white/40'
                            }`}
                          />
                        ))}
                      </div>

                      <button
                        onClick={() => handleManualNav(nextCategory)}
                        className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-90"
                      >
                        <ChevronLeft size={20} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── High-Premium Fallback: decorative cards when no categories ── */
              <div className="relative hidden lg:block min-h-[480px]">
                {/* Visual anchor card */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[480px] bg-gradient-to-b from-white/[0.08] to-transparent backdrop-blur-2xl rounded-[3rem] border border-white/10 shadow-3xl p-8 flex flex-col items-center justify-between group overflow-hidden">
                  <div className="absolute inset-0 animate-hero-shimmer opacity-10" />
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
                  
                  <div className="w-full flex justify-between items-start" dir="rtl">
                    <span className="px-4 py-1.5 bg-black/40 rounded-full text-[10px] font-black text-white border border-white/10 tracking-widest uppercase">Premium Selected</span>
                    <TrendingUp className="text-[#D4AF37]" size={20} />
                  </div>
                  
                  <div className="relative w-64 h-64 my-6">
                    <div className="absolute inset-0 bg-[#D4AF37] rounded-full opacity-[0.15] blur-3xl animate-pulse" />
                    <Image
                      src="/logo.png"
                      alt="Hero Logo"
                      fill
                      className="object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-700"
                      sizes="400px"
                    />
                  </div>
                  
                  <div className="text-center w-full" dir="rtl">
                    <h3 className="text-2xl font-black text-white mb-2">تجهيزات عالمية</h3>
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">أفضل صفقات الأسبوع</p>
                    <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent my-5" />
                    <button 
                        onClick={navigateToShop}
                        className="text-[#D4AF37] font-bold text-sm tracking-widest hover:tracking-[0.2em] transition-all flex items-center justify-center gap-2 mx-auto"
                    >
                        تصفح الكتالوج <ArrowLeft size={16} />
                    </button>
                  </div>
                </div>

                {/* Floating tags */}
                <div className="absolute top-12 right-0 bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl animate-hero-float">
                  <div className="flex items-center gap-3" dir="rtl">
                    <div className="p-2 bg-[#D4AF37] rounded-xl text-black">
                      <Star size={20} fill="currentColor" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">عروض حصرية</p>
                      <p className="text-lg font-black text-white">40% خصم</p>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-12 left-0 bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl animate-hero-float-delayed">
                  <div className="flex items-center gap-3" dir="rtl">
                    <div className="p-2 bg-green-500 rounded-xl text-white">
                      <ShoppingBag size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">شحن مجاني</p>
                      <p className="text-sm font-black text-white">لكافة الطلبات</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div 
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer opacity-30 hover:opacity-100 hover:translate-y-1 transition-all duration-300"
        onClick={navigateToShop}
      >
        <span className="text-[9px] font-black text-white tracking-[0.4em] uppercase">Scroll Down</span>
        <ChevronDown className="text-[#D4AF37] animate-bounce" size={24} />
      </div>
    </section>
  );
}
