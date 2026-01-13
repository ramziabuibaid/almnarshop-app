'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ProductCard from '@/components/store/ProductCard';

interface RelatedProductsProps {
  currentProductId: string;
  currentProductType: string;
  allProducts: any[];
}

export default function RelatedProducts({ currentProductId, currentProductType, allProducts }: RelatedProductsProps) {
  const router = useRouter();

  // Filter related products: same type, exclude current product
  const relatedProducts = useMemo(() => {
    if (!currentProductType) return [];

    return allProducts
      .filter((product) => {
        const productType = product.type || product.Type || '';
        const productId = product.id || product.ProductID || '';
        return (
          productType === currentProductType &&
          productId !== currentProductId &&
          (product.CS_War || product.cs_war || 0) + (product.CS_Shop || product.cs_shop || 0) > 0 // Only show available products
        );
      })
      .slice(0, 5); // Limit to 5 products
  }, [allProducts, currentProductId, currentProductType]);

  if (relatedProducts.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-right">منتجات مشابهة</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {relatedProducts.map((product) => (
          <ProductCard key={product.id || product.ProductID} product={product} />
        ))}
      </div>
    </div>
  );
}
