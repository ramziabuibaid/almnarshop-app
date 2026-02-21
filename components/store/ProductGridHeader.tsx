'use client';

import { ArrowUpDown } from 'lucide-react';
import { SortOption } from './types';

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
    <div className="flex flex-row items-center justify-between gap-3 mb-4 bg-white p-3 rounded-lg border border-gray-200 shadow-sm" dir="rtl">
      {/* Results Count */}
      <p className="text-xs sm:text-sm text-gray-600 font-medium">
        {totalResults} منتج
      </p>

      {/* Sort Dropdown */}
      <div className="relative">
        <select
          value={sortOption}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="appearance-none pr-8 pl-3 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 bg-gray-50 text-xs font-medium cursor-pointer text-gray-800"
          dir="rtl"
        >
          <option value="date-desc">الترتيب: الأحدث</option>
          <option value="name-asc">الاسم (أ-ي)</option>
          <option value="name-desc">الاسم (ي-أ)</option>
          <option value="price-asc">الأقل سعراً</option>
          <option value="price-desc">الأعلى سعراً</option>
        </select>
        <ArrowUpDown size={12} className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );
}

