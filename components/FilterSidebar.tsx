'use client';

import { X, Search, ChevronDown } from 'lucide-react';
import { useShop } from '@/context/ShopContext';
import { useMemo, useState, useRef, useEffect } from 'react';

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FilterState) => void;
  currentFilters: FilterState;
}

export interface FilterState {
  type: string;
  brand: string;
  size: string;
  color: string;
}

export type SortOption = 
  | 'name-asc'      // A-Z
  | 'name-desc'     // Z-A
  | 'price-asc'     // Lowest to Highest
  | 'price-desc'    // Highest to Lowest
  | 'date-desc';    // Newest First

interface SearchableSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}

function SearchableSelect({ label, value, options, onChange, placeholder = 'All' }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(query));
  }, [options, searchQuery]);

  const selectedOption = value ? options.find(opt => opt === value) : null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-semibold text-gray-900 mb-2 text-right">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-right flex items-center justify-between"
          dir="rtl"
        >
          <span className={selectedOption ? 'text-gray-900 font-medium' : 'text-gray-700'}>
            {selectedOption || placeholder}
          </span>
          <ChevronDown size={16} className={`text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden" dir="rtl">
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <Search size={16} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full pr-8 pl-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm text-gray-900 placeholder:text-gray-500 text-right"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-48">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                className={`w-full text-right px-3 py-2 hover:bg-gray-100 transition-colors text-gray-900 ${
                  !value ? 'bg-gray-100 font-medium' : ''
                }`}
              >
                {placeholder}
              </button>
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-600 text-right">لا توجد نتائج</div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      onChange(option);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full text-right px-3 py-2 hover:bg-gray-100 transition-colors text-gray-900 ${
                      value === option ? 'bg-gray-100 font-medium' : ''
                    }`}
                  >
                    {option}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FilterSidebar({
  isOpen,
  onClose,
  onApplyFilters,
  currentFilters,
}: FilterSidebarProps) {
  const { products } = useShop();
  const [filters, setFilters] = useState<FilterState>(currentFilters);

  // Sync filters with currentFilters prop
  useEffect(() => {
    setFilters(currentFilters);
  }, [currentFilters]);

  // Extract unique values for each filter category - DYNAMIC CASCADING
  // Each filter shows only options available based on other selected filters
  const availableTypes = useMemo(() => {
    let filtered = products;
    
    // Apply other filters (excluding type)
    if (filters.brand) {
      filtered = filtered.filter((p) => p.brand === filters.brand);
    }
    if (filters.size) {
      filtered = filtered.filter((p) => p.size === filters.size);
    }
    if (filters.color) {
      filtered = filtered.filter((p) => p.color === filters.color);
    }
    
    const types = new Set<string>();
    filtered.forEach((p) => {
      if (p.type) types.add(p.type);
    });
    return Array.from(types).sort();
  }, [products, filters.brand, filters.size, filters.color]);

  const availableBrands = useMemo(() => {
    let filtered = products;
    
    // Apply other filters (excluding brand)
    if (filters.type) {
      filtered = filtered.filter((p) => p.type === filters.type);
    }
    if (filters.size) {
      filtered = filtered.filter((p) => p.size === filters.size);
    }
    if (filters.color) {
      filtered = filtered.filter((p) => p.color === filters.color);
    }
    
    const brands = new Set<string>();
    filtered.forEach((p) => {
      if (p.brand) brands.add(p.brand);
    });
    return Array.from(brands).sort();
  }, [products, filters.type, filters.size, filters.color]);

  const availableSizes = useMemo(() => {
    let filtered = products;
    
    // Apply other filters (excluding size)
    if (filters.type) {
      filtered = filtered.filter((p) => p.type === filters.type);
    }
    if (filters.brand) {
      filtered = filtered.filter((p) => p.brand === filters.brand);
    }
    if (filters.color) {
      filtered = filtered.filter((p) => p.color === filters.color);
    }
    
    const sizes = new Set<string>();
    filtered.forEach((p) => {
      if (p.size) sizes.add(p.size);
    });
    return Array.from(sizes).sort();
  }, [products, filters.type, filters.brand, filters.color]);

  const availableColors = useMemo(() => {
    let filtered = products;
    
    // Apply other filters (excluding color)
    if (filters.type) {
      filtered = filtered.filter((p) => p.type === filters.type);
    }
    if (filters.brand) {
      filtered = filtered.filter((p) => p.brand === filters.brand);
    }
    if (filters.size) {
      filtered = filtered.filter((p) => p.size === filters.size);
    }
    
    const colors = new Set<string>();
    filtered.forEach((p) => {
      if (p.color) colors.add(p.color);
    });
    return Array.from(colors).sort();
  }, [products, filters.type, filters.brand, filters.size]);

  // Validate and clean up filters when available options change
  useEffect(() => {
    setFilters((prev) => {
      const updated = { ...prev };
      let changed = false;

      // Check if selected type is still available
      if (updated.type && !availableTypes.includes(updated.type)) {
        updated.type = '';
        updated.brand = '';
        updated.size = '';
        updated.color = '';
        changed = true;
      }

      // Check if selected brand is still available
      if (updated.brand && !availableBrands.includes(updated.brand)) {
        updated.brand = '';
        updated.size = '';
        updated.color = '';
        changed = true;
      }

      // Check if selected size is still available
      if (updated.size && !availableSizes.includes(updated.size)) {
        updated.size = '';
        changed = true;
      }

      // Check if selected color is still available
      if (updated.color && !availableColors.includes(updated.color)) {
        updated.color = '';
        changed = true;
      }

      return changed ? updated : prev;
    });
  }, [availableTypes, availableBrands, availableSizes, availableColors]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      
      // Reset dependent filters when a filter is cleared
      // If Type is cleared, reset Brand, Size, Color
      if (key === 'type' && !value) {
        newFilters.brand = '';
        newFilters.size = '';
        newFilters.color = '';
      }
      // If Brand is cleared, reset Size, Color (but keep Type)
      if (key === 'brand' && !value) {
        newFilters.size = '';
        newFilters.color = '';
      }
      // If Size or Color is cleared, no need to reset others
      
      return newFilters;
    });
  };

  const handleApply = () => {
    onApplyFilters(filters);
  };

  const handleReset = () => {
    const resetFilters: FilterState = { type: '', brand: '', size: '', color: '' };
    setFilters(resetFilters);
    onApplyFilters(resetFilters);
  };

  // Desktop: Always visible, Mobile: Drawer
  const filterContent = (
    <div className="space-y-4" dir="rtl">
      {/* Type Filter */}
      <SearchableSelect
        label="النوع"
        value={filters.type}
        options={availableTypes}
        onChange={(value) => handleFilterChange('type', value)}
        placeholder="كل الأنواع"
      />

      {/* Brand Filter */}
      <SearchableSelect
        label="العلامة التجارية"
        value={filters.brand}
        options={availableBrands}
        onChange={(value) => handleFilterChange('brand', value)}
        placeholder="كل العلامات"
      />

      {/* Size Filter */}
      <SearchableSelect
        label="الحجم"
        value={filters.size}
        options={availableSizes}
        onChange={(value) => handleFilterChange('size', value)}
        placeholder="كل الأحجام"
      />

      {/* Color Filter */}
      <SearchableSelect
        label="اللون"
        value={filters.color}
        options={availableColors}
        onChange={(value) => handleFilterChange('color', value)}
        placeholder="كل الألوان"
      />

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2 border-t border-gray-200">
        <button
          onClick={handleReset}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
        >
          إعادة تعيين
        </button>
        <button
          onClick={handleApply}
          className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium transition-colors"
        >
          تطبيق
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: Always visible inline */}
      <div className="hidden md:block bg-white border-b border-gray-200 py-4" dir="rtl">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-4 gap-4">
            <SearchableSelect
              label="النوع"
              value={filters.type}
              options={availableTypes}
              onChange={(value) => {
                const newFilters = { ...filters };
                newFilters.type = value;
                if (!value) {
                  newFilters.brand = '';
                  newFilters.size = '';
                  newFilters.color = '';
                }
                handleFilterChange('type', value);
                onApplyFilters(newFilters);
              }}
              placeholder="كل الأنواع"
            />
            <SearchableSelect
              label="العلامة التجارية"
              value={filters.brand}
              options={availableBrands}
              onChange={(value) => {
                const newFilters = { ...filters };
                newFilters.brand = value;
                if (!value) {
                  newFilters.size = '';
                  newFilters.color = '';
                }
                handleFilterChange('brand', value);
                onApplyFilters(newFilters);
              }}
              placeholder="كل العلامات"
            />
            <SearchableSelect
              label="الحجم"
              value={filters.size}
              options={availableSizes}
              onChange={(value) => {
                handleFilterChange('size', value);
                onApplyFilters({ ...filters, size: value });
              }}
              placeholder="كل الأحجام"
            />
            <SearchableSelect
              label="اللون"
              value={filters.color}
              options={availableColors}
              onChange={(value) => {
                handleFilterChange('color', value);
                onApplyFilters({ ...filters, color: value });
              }}
              placeholder="كل الألوان"
            />
          </div>
          <div className="mt-3 flex justify-start">
            <button
              onClick={handleReset}
              className="px-4 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              إعادة تعيين الكل
            </button>
          </div>
        </div>
      </div>

      {/* Mobile: Drawer */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-[60] md:hidden"
            onClick={onClose}
          />
          
          {/* Sidebar */}
          <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-[70] overflow-y-auto md:hidden" dir="rtl">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">الفلاتر</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            <div className="p-4">
              {filterContent}
            </div>
          </div>
        </>
      )}
    </>
  );
}
