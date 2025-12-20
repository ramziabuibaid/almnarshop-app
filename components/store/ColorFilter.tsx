'use client';

import { Check } from 'lucide-react';

interface ColorFilterProps {
  colors: string[];
  selectedColors: string[];
  onToggle: (color: string) => void;
  productCounts?: Record<string, number>;
}

// Color name to hex mapping (common colors in Arabic/English)
const COLOR_MAP: Record<string, string> = {
  'أبيض': '#FFFFFF',
  'أسود': '#000000',
  'أحمر': '#FF0000',
  'أزرق': '#0000FF',
  'أخضر': '#008000',
  'أصفر': '#FFFF00',
  'رمادي': '#808080',
  'بني': '#A52A2A',
  'وردي': '#FFC0CB',
  'برتقالي': '#FFA500',
  'بنفسجي': '#800080',
  'فضي': '#C0C0C0',
  'ذهبي': '#FFD700',
  'أزرق فاتح': '#87CEEB',
  'أخضر فاتح': '#90EE90',
  // English equivalents
  'white': '#FFFFFF',
  'black': '#000000',
  'red': '#FF0000',
  'blue': '#0000FF',
  'green': '#008000',
  'yellow': '#FFFF00',
  'gray': '#808080',
  'grey': '#808080',
  'brown': '#A52A2A',
  'pink': '#FFC0CB',
  'orange': '#FFA500',
  'purple': '#800080',
  'silver': '#C0C0C0',
  'gold': '#FFD700',
  'light blue': '#87CEEB',
  'light green': '#90EE90',
};

function getColorHex(colorName: string): string {
  const normalized = colorName.toLowerCase().trim();
  return COLOR_MAP[normalized] || '#CCCCCC'; // Default gray if not found
}

export default function ColorFilter({ colors, selectedColors, onToggle, productCounts = {} }: ColorFilterProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {colors.map((color) => {
          const isSelected = selectedColors.includes(color);
          const count = productCounts[color] || 0;
          const colorHex = getColorHex(color);

          return (
            <button
              key={color}
              onClick={() => onToggle(color)}
              className="group relative flex flex-col items-center gap-1"
              title={color}
            >
              <div
                className={`w-10 h-10 rounded-full border-2 transition-all ${
                  isSelected
                    ? 'border-gray-900 scale-110 shadow-md'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                style={{ backgroundColor: colorHex }}
              >
                {isSelected && (
                  <div className="w-full h-full flex items-center justify-center">
                    <Check size={16} className="text-white drop-shadow-md" />
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-600 max-w-[60px] truncate">{color}</span>
              {count > 0 && (
                <span className="text-[10px] text-gray-500">({count})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

