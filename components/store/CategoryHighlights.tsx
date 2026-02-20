'use client';

import { useMemo } from 'react';
import { useShop } from '@/context/ShopContext';
import { useRouter } from 'next/navigation';
import { Refrigerator, WashingMachine, Tv, Smartphone, Laptop, Home, ArrowLeft } from 'lucide-react';

interface CategoryHighlightsProps {
  onCategoryClick?: (category: string) => void;
}

// Icon mapping and color themes for categories
const categoryConfig: Record<string, { icon: any, gradient: string, image?: string }> = {
  'ثلاجة': {
    icon: Refrigerator,
    gradient: 'from-blue-500 to-cyan-400',
  },
  'غسالة': {
    icon: WashingMachine,
    gradient: 'from-indigo-500 to-purple-500',
  },
  'تلفزيون': {
    icon: Tv,
    gradient: 'from-rose-500 to-pink-500',
  },
  'هاتف': {
    icon: Smartphone,
    gradient: 'from-amber-500 to-orange-500',
  },
  'لابتوب': {
    icon: Laptop,
    gradient: 'from-emerald-500 to-teal-500',
  },
  'default': {
    icon: Home,
    gradient: 'from-gray-600 to-gray-800',
  },
};

// Popular categories to show
const popularCategories = [
  'ثلاجة',
  'غسالة',
  'تلفزيون',
  'هاتف',
  'لابتوب',
];

export default function CategoryHighlights({ onCategoryClick }: CategoryHighlightsProps) {
  const { products } = useShop();
  const router = useRouter();

  const categories = useMemo(() => {
    const typeMap = new Map<string, number>();

    products.forEach((product) => {
      const type = product.type || product.Type || '';
      if (type && type.trim() !== '') {
        const currentCount = typeMap.get(type) || 0;
        typeMap.set(type, currentCount + 1);
      }
    });

    const sorted = Array.from(typeMap.entries())
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0], 'ar');
      })
      .slice(0, 8)
      .map(([type, count]) => ({ type, count }));

    // Prioritize popular categories
    const prioritized: Array<{ type: string; count: number }> = [];
    const added = new Set<string>();

    popularCategories.forEach((popularType) => {
      const found = sorted.find((c) => c.type === popularType);
      if (found) {
        prioritized.push(found);
        added.add(found.type);
      }
    });

    sorted.forEach((cat) => {
      if (!added.has(cat.type)) {
        prioritized.push(cat);
      }
    });

    return prioritized.slice(0, 6); // Limit to top 6 for better layout
  }, [products]);

  const handleCategoryClick = (category: string) => {
    if (onCategoryClick) {
      onCategoryClick(category);
    } else {
      router.push('/shop');
    }
  };

  if (categories.length === 0) return null;

  return (
    <section className="py-16 bg-gray-50" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">تسوق حسب الفئة</h2>
            <p className="text-gray-500">اختر من مجموعتنا الواسعة من الأجهزة</p>
          </div>
          <button
            onClick={() => router.push('/shop')}
            className="hidden sm:flex items-center text-[#D4AF37] font-medium hover:gap-2 transition-all gap-1"
          >
            عرض الكل <ArrowLeft size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map(({ type, count }) => {
            const config = categoryConfig[type] || categoryConfig['default'];
            const Icon = config.icon;

            return (
              <button
                key={type}
                onClick={() => handleCategoryClick(type)}
                className="group relative h-48 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-300"
              >
                {/* Background Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10">
                  <div className="w-16 h-16 rounded-full bg-gray-100 group-hover:bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 transition-colors duration-300">
                    <Icon
                      size={32}
                      className="text-gray-600 group-hover:text-white transition-colors duration-300"
                    />
                  </div>

                  <h3 className="font-bold text-gray-900 group-hover:text-white text-lg mb-1 transition-colors duration-300">
                    {type}
                  </h3>

                  <span className="text-xs text-gray-500 group-hover:text-white/80 transition-colors duration-300">
                    {count} منتجات
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
