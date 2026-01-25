/**
 * Product interface matching Google Sheets schema exactly
 */
export interface Product {
  // Identifiers
  ProductID?: string;
  'Shamel No'?: string;
  Barcode?: string;
  
  // Basic Info
  Name?: string;
  Type?: string;
  Brand?: string;
  Origin?: string;
  Warranty?: string;
  
  // Specs
  Size?: string;
  Color?: string;
  Dimention?: string;
  
  // Stock
  CS_War?: number; // Warehouse Qty
  CS_Shop?: number; // Shop Qty
  
  // Pricing
  CostPrice?: number;
  SalePrice?: number;
  T1Price?: number;
  T2Price?: number;
  
  // Images
  Image?: string;
  'Image 2'?: string;
  'image 3'?: string;
  
  // Serial Number Support
  is_serialized?: boolean;
  IsSerialized?: boolean;
  
  // Legacy fields (for backward compatibility)
  id?: string;
  name?: string;
  price?: number;
  image?: string;
  image2?: string;
  image3?: string;
  type?: string;
  brand?: string;
  size?: string;
  color?: string;
  description?: string;
  [key: string]: any;
}

