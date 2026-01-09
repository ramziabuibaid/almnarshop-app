'use client';

import { ArrowUpDown } from 'lucide-react';
import { SortOption } from './FilterSidebar';

interface ProductGridHeaderProps {
  totalResults: number;
  showingFrom: number;
  showingTo: number;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
}

export default function ProductGridHeader({
  totalResults,
  showingFrom,
  showingTo,
  sortOption,
  onSortChange,
}: ProductGridHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4" dir="rtl">
      {/* Results Count */}
      <p className="text-sm text-gray-600">
        عرض {showingFrom}-{showingTo} من {totalResults} منتج
      </p>

      {/* Sort Dropdown */}
      <div className="relative">
        <select
          value={sortOption}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="appearance-none pr-4 pl-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-sm font-medium cursor-pointer text-right min-w-[200px] text-gray-900"
          dir="rtl"
        >
          <option value="date-desc">الأحدث أولاً</option>
          <option value="name-asc">الاسم: أ-ي</option>
          <option value="name-desc">الاسم: ي-أ</option>
          <option value="price-asc">السعر: من الأقل للأعلى</option>
          <option value="price-desc">السعر: من الأعلى للأقل</option>
        </select>
        <ArrowUpDown size={16} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

