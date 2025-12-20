export interface FilterState {
  selectedTypes: string[];
  selectedBrands: string[];
  selectedSizes: string[];
  selectedColors: string[];
  priceRange: {
    min: number;
    max: number;
  };
}

export type SortOption = 
  | 'name-asc'      // A-Z
  | 'name-desc'     // Z-A
  | 'price-asc'     // Lowest to Highest
  | 'price-desc'    // Highest to Lowest
  | 'date-desc';    // Newest First

