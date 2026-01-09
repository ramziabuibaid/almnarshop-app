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

  // Calculate percentages with bounds checking
  const calculatePercentage = (value: number, min: number, max: number): number => {
    if (max <= min) return 0;
    const percentage = ((value - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, percentage)); // Clamp between 0 and 100
  };

  const percentageMin = calculatePercentage(localMin, minPrice, maxPrice);
  const percentageMax = calculatePercentage(localMax, minPrice, maxPrice);
  const trackWidth = Math.max(0, Math.min(100, percentageMax - percentageMin));

  return (
    <div className="space-y-4 w-full" dir="rtl" style={{ maxWidth: '100%' }}>
      {/* Range Slider */}
      <div className="relative w-full" style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
        <div 
          className="h-2 bg-gray-200 rounded-full relative" 
          style={{ 
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}
        >
          <div
            className="absolute h-2 bg-gray-900 rounded-full"
            style={{
              right: `${Math.max(0, Math.min(100, percentageMin))}%`,
              width: `${Math.max(0, Math.min(100, trackWidth))}%`,
              maxWidth: `calc(100% - ${Math.max(0, Math.min(100, percentageMin))}%)`,
              boxSizing: 'border-box',
            }}
          />
        </div>
        <input
          type="range"
          min={minPrice}
          max={maxPrice}
          value={localMin}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          className="absolute top-0 w-full h-2 opacity-0 cursor-pointer z-10"
          style={{ 
            left: 0, 
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}
        />
        <input
          type="range"
          min={minPrice}
          max={maxPrice}
          value={localMax}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          className="absolute top-0 w-full h-2 opacity-0 cursor-pointer z-20"
          style={{ 
            left: 0, 
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Input Fields */}
      <div className="flex items-center gap-3 w-full">
        <div className="flex-1 min-w-0">
          <label className="block text-xs text-gray-600 mb-1">من</label>
          <input
            type="number"
            min={minPrice}
            max={maxPrice}
            value={localMin}
            onChange={(e) => handleMinChange(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm text-gray-900 text-right bg-white"
            dir="rtl"
          />
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-xs text-gray-600 mb-1">إلى</label>
          <input
            type="number"
            min={minPrice}
            max={maxPrice}
            value={localMax}
            onChange={(e) => handleMaxChange(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm text-gray-900 text-right bg-white"
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
