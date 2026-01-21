'use client';

import { X } from 'lucide-react';

interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}

interface ActiveFiltersBarProps {
  filters: ActiveFilter[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
}

export default function ActiveFiltersBar({ filters, onRemove, onClearAll }: ActiveFiltersBarProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 py-2 sm:py-3 border-b border-gray-200" dir="rtl">
      <span className="text-xs sm:text-sm font-medium text-gray-700">الفلاتر النشطة:</span>
      {filters.map((filter) => (
        <button
          key={filter.key}
          onClick={() => onRemove(filter.key)}
          className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-100 text-gray-900 rounded-full text-xs sm:text-sm hover:bg-gray-200 transition-colors"
        >
          <span className="line-clamp-1">{filter.label}: {filter.value}</span>
          <X size={12} className="text-gray-600 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
        </button>
      ))}
      {filters.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs sm:text-sm text-gray-600 hover:text-gray-900 underline"
        >
          مسح الكل
        </button>
      )}
    </div>
  );
}

