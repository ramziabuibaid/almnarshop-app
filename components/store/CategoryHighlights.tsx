'use client';

import { useMemo } from 'react';
import { useShop } from '@/context/ShopContext';
import { Refrigerator, WashingMachine, Tv, Smartphone, Laptop, Home } from 'lucide-react';

interface CategoryHighlightsProps {
  onCategoryClick?: (category: string) => void;
}

// Icon mapping for common categories
const categoryIcons: Record<string, any> = {
  'ثلاجة': Refrigerator,
  'غسالة': WashingMachine,
  'تلفزيون': Tv,
  'هاتف': Smartphone,
  'لابتوب': Laptop,
  'default': Home,
};

// Popular categories to show (can be customized)
const popularCategories = [
  'ثلاجة',
  'غسالة',
  'تلفزيون',
  'هاتف',
  'لابتوب',
];

export default function CategoryHighlights({ onCategoryClick }: CategoryHighlightsProps) {
  const { products } = useShop();

  // Get distinct product types with counts
  const categories = useMemo(() => {
    const typeMap = new Map<string, number>();
    
    products.forEach((product) => {
      const type = product.type || product.Type || '';
      if (type && type.trim() !== '') {
        const currentCount = typeMap.get(type) || 0;
        typeMap.set(type, currentCount + 1);
      }
    });

    // Sort by count (most products first), then alphabetically
    const sorted = Array.from(typeMap.entries())
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]; // Sort by count
        return a[0].localeCompare(b[0], 'ar'); // Then alphabetically
      })
      .slice(0, 8) // Limit to top 8 categories
      .map(([type, count]) => ({ type, count }));

    // Prioritize popular categories if they exist
    const prioritized: Array<{ type: string; count: number }> = [];
    const added = new Set<string>();

    // Add popular categories first if they exist
    popularCategories.forEach((popularType) => {
      const found = sorted.find((c) => c.type === popularType);
      if (found) {
        prioritized.push(found);
        added.add(found.type);
      }
    });

    // Add remaining categories
    sorted.forEach((cat) => {
      if (!added.has(cat.type)) {
        prioritized.push(cat);
      }
    });

    return prioritized.slice(0, 8);
  }, [products]);

  const handleCategoryClick = (category: string) => {
    if (onCategoryClick) {
      onCategoryClick(category);
    } else {
      // Default behavior: scroll to products and filter by category
      const productsSection = document.getElementById('products-section');
      if (productsSection) {
        productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="py-8 sm:py-12 md:py-16 bg-white border-b border-gray-200" dir="rtl">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 text-center">
          تصفح حسب الفئة
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5 sm:gap-3 md:gap-4">
          {categories.map(({ type, count }) => {
            const IconComponent = categoryIcons[type] || categoryIcons['default'];
            return (
              <button
                key={type}
                onClick={() => handleCategoryClick(type)}
                className="group flex flex-col items-center justify-center p-3 sm:p-4 md:p-6 bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 rounded-lg sm:rounded-xl transition-all duration-300 hover:shadow-xl hover:scale-105 border border-gray-200 hover:border-[#D4AF37]"
              >
                <div className="mb-2 sm:mb-3 p-2 sm:p-3 md:p-4 bg-white rounded-full group-hover:bg-[#D4AF37] transition-all duration-300 shadow-sm group-hover:shadow-md">
                  <IconComponent 
                    size={24} 
                    className="text-gray-700 group-hover:text-white transition-colors duration-300 sm:w-7 sm:h-7 md:w-8 md:h-8" 
                  />
                </div>
                <span className="font-semibold text-gray-900 text-[10px] sm:text-xs md:text-sm text-center mb-0.5 sm:mb-1 line-clamp-2 group-hover:text-[#D4AF37] transition-colors">
                  {type}
                </span>
                <span className="text-[10px] sm:text-xs text-gray-500 group-hover:text-gray-700">
                  {count} منتج
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
