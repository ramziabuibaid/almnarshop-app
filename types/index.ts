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

  // Store Visibility (hidden products don't appear in online store)
  is_visible?: boolean;
  isVisible?: boolean;

  // Restock tracking (for "new" badge and store sorting)
  last_restocked_at?: string | null;
  LastRestockedAt?: string | null;
  created_at?: string | null;

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

export type ArticleBlockType = 'text' | 'image' | 'products' | 'table';

export interface ArticleBlock {
  id: string;
  type: ArticleBlockType;
  content: any; // string for text/image, array of product IDs for products, { rows: string[][] } for table
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  type: string;
  summary?: string;
  cover_image?: string;
  content: ArticleBlock[];
  view_count: number;
  is_published: boolean;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
}
