'use client';

import { useState, useMemo } from 'react';
import { Search, Check } from 'lucide-react';

interface BrandFilterProps {
  brands: string[];
  selectedBrands: string[];
  onToggle: (brand: string) => void;
  productCounts?: Record<string, number>;
}

export default function BrandFilter({ brands, selectedBrands, onToggle, productCounts = {} }: BrandFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const query = searchQuery.toLowerCase();
    return brands.filter(brand => brand.toLowerCase().includes(query));
  }, [brands, searchQuery]);

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="بحث عن علامة تجارية..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm text-gray-900 placeholder:text-gray-500 text-right"
          dir="rtl"
        />
      </div>

      {/* Brand List */}
      <div className="max-h-64 overflow-y-auto space-y-2">
        {filteredBrands.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">لا توجد نتائج</p>
        ) : (
          filteredBrands.map((brand) => {
            const isSelected = selectedBrands.includes(brand);
            const count = productCounts[brand] || 0;

            return (
              <label
                key={brand}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                dir="rtl"
              >
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(brand)}
                    className="sr-only"
                  />
                  <div
                    className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-gray-900 border-gray-900'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check size={14} className="text-white" />}
                  </div>
                </div>
                <span className="flex-1 text-sm text-gray-900">{brand}</span>
                {count > 0 && (
                  <span className="text-xs text-gray-500">({count})</span>
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

