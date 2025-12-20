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
    <div className="flex flex-wrap items-center gap-2 py-3 border-b border-gray-200" dir="rtl">
      <span className="text-sm font-medium text-gray-700">الفلاتر النشطة:</span>
      {filters.map((filter) => (
        <button
          key={filter.key}
          onClick={() => onRemove(filter.key)}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-900 rounded-full text-sm hover:bg-gray-200 transition-colors"
        >
          <span>{filter.label}: {filter.value}</span>
          <X size={14} className="text-gray-600" />
        </button>
      ))}
      {filters.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          مسح الكل
        </button>
      )}
    </div>
  );
}

