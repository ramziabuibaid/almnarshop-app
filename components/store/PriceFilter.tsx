'use client';

import { useState, useEffect } from 'react';

interface PriceFilterProps {
  minPrice: number;
  maxPrice: number;
  selectedMin: number;
  selectedMax: number;
  onRangeChange: (min: number, max: number) => void;
}

export default function PriceFilter({
  minPrice,
  maxPrice,
  selectedMin,
  selectedMax,
  onRangeChange,
}: PriceFilterProps) {
  const [localMin, setLocalMin] = useState(selectedMin);
  const [localMax, setLocalMax] = useState(selectedMax);

  useEffect(() => {
    setLocalMin(selectedMin);
    setLocalMax(selectedMax);
  }, [selectedMin, selectedMax]);

  const handleMinChange = (value: number) => {
    const newMin = Math.max(minPrice, Math.min(value, localMax));
    setLocalMin(newMin);
    onRangeChange(newMin, localMax);
  };

  const handleMaxChange = (value: number) => {
    const newMax = Math.max(localMin, Math.min(value, maxPrice));
    setLocalMax(newMax);
    onRangeChange(localMin, newMax);
  };

  const percentageMin = ((localMin - minPrice) / (maxPrice - minPrice)) * 100;
  const percentageMax = ((localMax - minPrice) / (maxPrice - minPrice)) * 100;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Range Slider */}
      <div className="relative">
        <div className="h-2 bg-gray-200 rounded-full relative">
          <div
            className="absolute h-2 bg-gray-900 rounded-full"
            style={{
              right: `${percentageMin}%`,
              width: `${percentageMax - percentageMin}%`,
            }}
          />
        </div>
        <input
          type="range"
          min={minPrice}
          max={maxPrice}
          value={localMin}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
        />
        <input
          type="range"
          min={minPrice}
          max={maxPrice}
          value={localMax}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
        />
      </div>

      {/* Input Fields */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-600 mb-1">من</label>
          <input
            type="number"
            min={minPrice}
            max={maxPrice}
            value={localMin}
            onChange={(e) => handleMinChange(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm text-gray-900 text-right"
            dir="rtl"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-600 mb-1">إلى</label>
          <input
            type="number"
            min={minPrice}
            max={maxPrice}
            value={localMax}
            onChange={(e) => handleMaxChange(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm text-gray-900 text-right"
            dir="rtl"
          />
        </div>
      </div>

      {/* Price Display */}
      <div className="text-center text-sm text-gray-600">
        ₪{localMin.toFixed(2)} - ₪{localMax.toFixed(2)}
      </div>
    </div>
  );
}

