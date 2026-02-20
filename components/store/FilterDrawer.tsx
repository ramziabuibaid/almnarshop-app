'use client';

import { X } from 'lucide-react';
import { useMemo } from 'react';
import { useShop } from '@/context/ShopContext';
import FilterSection from './FilterSection';
import BrandFilter from './BrandFilter';
import ColorFilter from './ColorFilter';
import PriceFilter from './PriceFilter';
import { FilterState } from './types';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

export default function FilterDrawer({ isOpen, onClose, filters, onFilterChange }: FilterDrawerProps) {
  const { products } = useShop();

  // Calculate available options and counts (contextual: counts respect other active filters)
  const { types, brands, sizes, colors, priceRange, typeCounts, brandCounts, sizeCounts, colorCounts } = useMemo(() => {
    let filtered = products;

    if (filters.selectedTypes.length > 0) {
      filtered = filtered.filter((p) => filters.selectedTypes.includes(p.type || ''));
    }
    if (filters.selectedBrands.length > 0) {
      filtered = filtered.filter((p) => filters.selectedBrands.includes(p.brand || ''));
    }
    if (filters.selectedSizes.length > 0) {
      filtered = filtered.filter((p) => filters.selectedSizes.includes(p.size || ''));
    }
    if (filters.selectedColors.length > 0) {
      filtered = filtered.filter((p) => filters.selectedColors.includes(p.color || ''));
    }

    const typesSet = new Set<string>();
    const brandsSet = new Set<string>();
    const sizesSet = new Set<string>();
    const colorsSet = new Set<string>();
    const prices: number[] = [];

    filtered.forEach((p) => {
      const type = p.type || p.Type;
      const brand = p.brand || p.Brand;
      const size = p.size || p.Size;
      const color = p.color || p.Color;

      if (type) typesSet.add(type);
      if (brand) brandsSet.add(brand);
      if (size) sizesSet.add(size);
      if (color) colorsSet.add(color);
      if (p.price) prices.push(p.price);
    });

    const baseForTypes = products.filter((p) => {
      const brand = p.brand || p.Brand || '';
      const size = p.size || p.Size || '';
      const color = p.color || p.Color || '';
      if (filters.selectedBrands.length && !filters.selectedBrands.includes(brand)) return false;
      if (filters.selectedSizes.length && !filters.selectedSizes.includes(size)) return false;
      if (filters.selectedColors.length && !filters.selectedColors.includes(color)) return false;
      return true;
    });
    const baseForBrands = products.filter((p) => {
      const type = p.type || p.Type || '';
      const size = p.size || p.Size || '';
      const color = p.color || p.Color || '';
      if (filters.selectedTypes.length && !filters.selectedTypes.includes(type)) return false;
      if (filters.selectedSizes.length && !filters.selectedSizes.includes(size)) return false;
      if (filters.selectedColors.length && !filters.selectedColors.includes(color)) return false;
      return true;
    });
    const baseForSizes = products.filter((p) => {
      const type = p.type || p.Type || '';
      const brand = p.brand || p.Brand || '';
      const color = p.color || p.Color || '';
      if (filters.selectedTypes.length && !filters.selectedTypes.includes(type)) return false;
      if (filters.selectedBrands.length && !filters.selectedBrands.includes(brand)) return false;
      if (filters.selectedColors.length && !filters.selectedColors.includes(color)) return false;
      return true;
    });
    const baseForColors = products.filter((p) => {
      const type = p.type || p.Type || '';
      const brand = p.brand || p.Brand || '';
      const size = p.size || p.Size || '';
      if (filters.selectedTypes.length && !filters.selectedTypes.includes(type)) return false;
      if (filters.selectedBrands.length && !filters.selectedBrands.includes(brand)) return false;
      if (filters.selectedSizes.length && !filters.selectedSizes.includes(size)) return false;
      return true;
    });

    const typeCnt: Record<string, number> = {};
    baseForTypes.forEach((p) => {
      const type = p.type || p.Type;
      if (type) typeCnt[`type_${type}`] = (typeCnt[`type_${type}`] || 0) + 1;
    });
    const brandCnt: Record<string, number> = {};
    baseForBrands.forEach((p) => {
      const brand = p.brand || p.Brand;
      if (brand) brandCnt[brand] = (brandCnt[brand] || 0) + 1;
    });
    const sizeCnt: Record<string, number> = {};
    baseForSizes.forEach((p) => {
      const size = p.size || p.Size;
      if (size) sizeCnt[size] = (sizeCnt[size] || 0) + 1;
    });
    const colorCnt: Record<string, number> = {};
    baseForColors.forEach((p) => {
      const color = p.color || p.Color;
      if (color) colorCnt[color] = (colorCnt[color] || 0) + 1;
    });

    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 10000;

    return {
      types: Array.from(typesSet).sort(),
      brands: Array.from(brandsSet).sort(),
      sizes: Array.from(sizesSet).sort(),
      colors: Array.from(colorsSet).sort(),
      priceRange: { min: minPrice, max: maxPrice },
      typeCounts: typeCnt,
      brandCounts: brandCnt,
      sizeCounts: sizeCnt,
      colorCounts: colorCnt,
    };
  }, [products, filters.selectedTypes, filters.selectedBrands, filters.selectedSizes, filters.selectedColors]);

  const availableTypes = useMemo(() => {
    return types.filter((type) => {
      let filtered = products;
      if (filters.selectedBrands.length > 0) {
        filtered = filtered.filter((p) => filters.selectedBrands.includes(p.brand || ''));
      }
      if (filters.selectedSizes.length > 0) {
        filtered = filtered.filter((p) => filters.selectedSizes.includes(p.size || ''));
      }
      if (filters.selectedColors.length > 0) {
        filtered = filtered.filter((p) => filters.selectedColors.includes(p.color || ''));
      }
      return filtered.some((p) => p.type === type);
    });
  }, [products, types, filters.selectedBrands, filters.selectedSizes, filters.selectedColors]);

  const handleTypeToggle = (type: string) => {
    const newTypes = filters.selectedTypes.includes(type)
      ? filters.selectedTypes.filter((t) => t !== type)
      : [...filters.selectedTypes, type];
    onFilterChange({ ...filters, selectedTypes: newTypes });
  };

  const handleBrandToggle = (brand: string) => {
    const newBrands = filters.selectedBrands.includes(brand)
      ? filters.selectedBrands.filter((b) => b !== brand)
      : [...filters.selectedBrands, brand];
    onFilterChange({ ...filters, selectedBrands: newBrands });
  };

  const handleSizeToggle = (size: string) => {
    const newSizes = filters.selectedSizes.includes(size)
      ? filters.selectedSizes.filter((s) => s !== size)
      : [...filters.selectedSizes, size];
    onFilterChange({ ...filters, selectedSizes: newSizes });
  };

  const handleColorToggle = (color: string) => {
    const newColors = filters.selectedColors.includes(color)
      ? filters.selectedColors.filter((c) => c !== color)
      : [...filters.selectedColors, color];
    onFilterChange({ ...filters, selectedColors: newColors });
  };

  const handlePriceChange = (min: number, max: number) => {
    onFilterChange({ ...filters, priceRange: { min, max } });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-50 overflow-y-auto md:hidden" dir="rtl">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">الفلاتر والترتيب</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Type Filter */}
          <FilterSection title="النوع">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableTypes.map((type) => {
                const isSelected = filters.selectedTypes.includes(type);
                const count = typeCounts[`type_${type}`] || 0;
                return (
                  <label
                    key={type}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleTypeToggle(type)}
                      className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    />
                    <span className="flex-1 text-sm text-gray-900">{type}</span>
                    {count > 0 && (
                      <span className="text-xs text-gray-500">({count})</span>
                    )}
                  </label>
                );
              })}
            </div>
          </FilterSection>

          {/* Brand Filter */}
          <FilterSection title="العلامة التجارية">
            <BrandFilter
              brands={brands}
              selectedBrands={filters.selectedBrands}
              onToggle={handleBrandToggle}
              productCounts={brandCounts}
            />
          </FilterSection>

          {/* Size Filter */}
          <FilterSection title="الحجم">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sizes.map((size) => {
                const isSelected = filters.selectedSizes.includes(size);
                const count = sizeCounts[size] || 0;
                return (
                  <label
                    key={size}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSizeToggle(size)}
                      className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    />
                    <span className="flex-1 text-sm text-gray-900">{size}</span>
                    {count > 0 && (
                      <span className="text-xs text-gray-500">({count})</span>
                    )}
                  </label>
                );
              })}
            </div>
          </FilterSection>

          {/* Color Filter */}
          <FilterSection title="اللون">
            <ColorFilter
              colors={colors}
              selectedColors={filters.selectedColors}
              onToggle={handleColorToggle}
              productCounts={colorCounts}
            />
          </FilterSection>

          {/* Price Filter */}
          <FilterSection title="السعر">
            <PriceFilter
              minPrice={priceRange.min}
              maxPrice={priceRange.max}
              selectedMin={filters.priceRange.min}
              selectedMax={filters.priceRange.max}
              onRangeChange={handlePriceChange}
            />
          </FilterSection>

          {/* Clear All Button */}
          {(filters.selectedTypes.length > 0 ||
            filters.selectedBrands.length > 0 ||
            filters.selectedSizes.length > 0 ||
            filters.selectedColors.length > 0 ||
            filters.priceRange.min > priceRange.min ||
            filters.priceRange.max < priceRange.max) && (
              <button
                onClick={() => {
                  onFilterChange({
                    selectedTypes: [],
                    selectedBrands: [],
                    selectedSizes: [],
                    selectedColors: [],
                    priceRange: { min: priceRange.min, max: priceRange.max },
                  });
                }}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors text-sm"
              >
                إعادة تعيين الكل
              </button>
            )}
        </div>
      </div>
    </>
  );
}

