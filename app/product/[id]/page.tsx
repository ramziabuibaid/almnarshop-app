'use client';

import { useEffect } from 'react';
import { notFound, useParams } from 'next/navigation';
import { getProductById, getProducts } from '@/lib/api';
import ProductDetailsClient from '@/components/product/ProductDetailsClient';
import StoreHeader from '@/components/store/StoreHeader';
import StoreFooter from '@/components/store/StoreFooter';
import RelatedProducts from '@/components/product/RelatedProducts';
import { useShop } from '@/context/ShopContext';
import { useState } from 'react';
import { event } from '@/lib/fpixel';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ProductPage() {
  const params = useParams();
  const id = params.id as string;
  const { loadProducts, products: contextProducts } = useShop();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundPage, setNotFoundPage] = useState(false);

  // Load product first (fast) - priority
  useEffect(() => {
    if (!id) {
      setNotFoundPage(true);
      return;
    }

    const fetchProduct = async () => {
      try {
        setLoading(true);
        // Fetch product details first (fast operation)
        const productData = await getProductById(id);
        if (!productData) {
          setNotFoundPage(true);
          return;
        }
        // Hidden products: 404 on store
        if (productData.is_visible === false || productData.isVisible === false) {
          setNotFoundPage(true);
          return;
        }

        setProduct(productData);
        setLoading(false);

        // Set page title immediately
        document.title = `${productData.name || productData.Name || 'Product'} - Almnar Home`;
      } catch (error) {
        console.error('[ProductPage] Error loading product:', error);
        setNotFoundPage(true);
      }
    };

    fetchProduct();
  }, [id]);

  // Load all products in background (for search and related products) - non-blocking
  useEffect(() => {
    // Load products in context for search functionality and related products (only if not already loaded)
    if (contextProducts.length === 0) {
      loadProducts().catch((error) => {
        console.error('[ProductPage] Error loading products in background:', error);
      });
    }
  }, [contextProducts.length, loadProducts]);

  // Facebook Pixel: ViewContent on product page load (when product data is ready)
  useEffect(() => {
    if (!product) return;
    const productId = product.product_id || product.id || product.ProductID || id;
    const productName = product.name || product.Name || '';
    const salePrice = Number(product.sale_price ?? product.SalePrice ?? product.price ?? 0) || 0;
    const contentCategory = product.type || product.Type || undefined;
    event('ViewContent', {
      content_name: productName,
      content_ids: [String(productId)],
      content_type: 'product',
      value: salePrice,
      currency: 'ILS',
      ...(contentCategory ? { content_category: contentCategory } : {}),
    });
  }, [product, id]);

  if (notFoundPage) {
    notFound();
  }

  if (loading || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
          <p className="text-gray-600">جاري تحميل المنتج...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Store Header */}
      <StoreHeader showSearch={true} />

      <ProductDetailsClient product={product} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <RelatedProducts
          currentProductId={product.id || product.ProductID || id}
          currentProductType={product.type || product.Type || ''}
          allProducts={contextProducts}
        />
      </div>
      <StoreFooter />
    </div>
  );
}
