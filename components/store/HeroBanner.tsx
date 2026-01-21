'use client';

import { ChevronDown, ShoppingBag } from 'lucide-react';
import Image from 'next/image';

export default function HeroBanner() {
  const scrollToProducts = () => {
    const productsSection = document.getElementById('products-section');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="relative w-full h-[400px] sm:h-[500px] md:h-[600px] overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37] opacity-5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D4AF37] opacity-5 rounded-full blur-3xl"></div>

      {/* Content */}
      <div className="relative h-full flex items-center justify-center">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 text-center text-white" dir="rtl">
          <div className="mb-4 sm:mb-6 md:mb-8">
            {/* Full Logo */}
            <div className="mb-3 sm:mb-4 md:mb-6 flex justify-center">
              <Image
                src="/logo.png"
                alt="ALMNAR Logo"
                width={200}
                height={200}
                className="h-20 sm:h-24 md:h-32 lg:h-40 w-auto object-contain"
                priority
              />
            </div>
            <p className="text-base sm:text-lg md:text-2xl lg:text-3xl font-semibold mb-1.5 sm:mb-2 text-gray-100 px-2">
              متجر الإلكترونيات والأجهزة المنزلية
            </p>
            <p className="text-xs sm:text-sm md:text-lg lg:text-xl text-gray-300 max-w-2xl mx-auto px-3 sm:px-4">
              اكتشف أحدث الأجهزة الإلكترونية والأجهزة المنزلية بأسعار تنافسية وجودة عالية
            </p>
          </div>

          {/* CTA Button */}
          <button
            onClick={scrollToProducts}
            className="inline-flex items-center gap-1.5 sm:gap-2 md:gap-3 px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 bg-gradient-to-r from-[#D4AF37] to-[#B8941F] text-white rounded-lg hover:from-[#B8941F] hover:to-[#9A7D1A] transition-all duration-300 font-semibold text-sm sm:text-base md:text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <ShoppingBag size={18} className="sm:w-5 sm:h-5 md:w-6 md:h-6" />
            <span>تسوق الآن</span>
            <ChevronDown size={16} className="animate-bounce sm:w-4 sm:h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-6 md:bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce hidden md:block">
        <ChevronDown size={32} className="text-white opacity-50" />
      </div>
    </section>
  );
}
