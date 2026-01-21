'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { ShoppingCart, Image as ImageIcon, Sparkles } from 'lucide-react';
import { useShop } from '@/context/ShopContext';
import { getDirectImageUrl } from '@/lib/utils';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    image?: string;
    image2?: string;
    image3?: string;
    created_at?: string;
    CS_War?: number;
    CS_Shop?: number;
    cs_war?: number;
    cs_shop?: number;
    originalPrice?: number;
    campaignPrice?: number;
    discount?: number;
    isCampaignMode?: boolean;
    [key: string]: any;
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useShop();
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  
  const productId = product.id || product.ProductID || product.product_id || '';
  const productUrl = productId ? `/product/${encodeURIComponent(productId)}` : '#';
  
  // Convert image URL to direct image link
  const rawImageUrl = product.image && product.image.trim() !== '' ? product.image.trim() : '';
  const imageUrl = getDirectImageUrl(rawImageUrl);
  const hasValidImage = imageUrl && !imageError;
  
  // Check if product is available
  const warehouseStock = product.CS_War || product.cs_war || 0;
  const shopStock = product.CS_Shop || product.cs_shop || 0;
  const totalStock = warehouseStock + shopStock;
  const isAvailable = totalStock > 0;
  
  // Check if product is new (created within last 30 days)
  // Use useState to prevent hydration mismatch (Date.now() differs between server and client)
  const [isNew, setIsNew] = useState(false);
  
  useEffect(() => {
    if (product.created_at) {
      const now = Date.now();
      const createdTime = new Date(product.created_at).getTime();
      setIsNew((now - createdTime) < 30 * 24 * 60 * 60 * 1000);
    } else {
      setIsNew(false);
    }
  }, [product.created_at]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!imgRef.current || !hasValidImage) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px',
        threshold: 0.01,
      }
    );

    const currentRef = imgRef.current;
    observer.observe(currentRef);

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, [hasValidImage]);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAvailable) {
      addToCart(product);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 group">
        {/* Image Container */}
        <Link 
          href={productUrl}
          className="relative w-full aspect-square bg-gray-50 flex items-center justify-center cursor-pointer overflow-hidden block"
        >
          {/* Badges */}
          <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-10 flex flex-col gap-1.5 sm:gap-2" suppressHydrationWarning>
            {/* Discount Badge - Priority in campaign mode */}
            {product.isCampaignMode && product.discount && product.discount > 0 && (
              <div className="bg-red-600 text-white px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold shadow-lg">
                خصم {product.discount}%
              </div>
            )}
            {isNew && !product.isCampaignMode && (
              <div className="bg-green-600 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold shadow-lg flex items-center gap-0.5 sm:gap-1">
                <Sparkles size={10} className="sm:w-3 sm:h-3" />
                جديد
              </div>
            )}
            {!isAvailable && (
              <div className="bg-red-600 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold shadow-lg">
                غير متوفر
              </div>
            )}
          </div>

          {/* Product Image */}
          <div ref={imgRef} className="w-full h-full flex items-center justify-center">
            {hasValidImage && isInView && imageUrl ? (
              <img
                src={imageUrl}
                alt={product.name}
                loading="lazy"
                className={`object-contain w-full h-full p-2 transition-transform duration-300 group-hover:scale-105 ${
                  imageLoading ? 'opacity-0' : 'opacity-100'
                } ${!isAvailable ? 'opacity-50 grayscale' : ''}`}
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageError(true);
                  setImageLoading(false);
                }}
              />
            ) : hasValidImage ? (
              <div className="flex flex-col items-center justify-center text-gray-300">
                <ImageIcon size={32} className="mb-1 animate-pulse" />
                <span className="text-xs">Loading...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-400">
                <ImageIcon size={48} className="mb-2" />
                <span className="text-xs">No Image</span>
              </div>
            )}
          </div>

          {/* Quick Add to Cart Button (Desktop - appears on hover) */}
          <div className="absolute bottom-0 left-0 right-0 p-1.5 sm:p-2 bg-white/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity md:block hidden">
            <button
              onClick={handleAddToCart}
              disabled={!isAvailable}
              className={`w-full flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg transition-colors font-medium text-xs sm:text-sm ${
                isAvailable
                  ? 'bg-gray-900 text-white hover:bg-gray-800'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <ShoppingCart size={14} className="sm:w-4 sm:h-4" />
              {isAvailable ? 'إضافة إلى السلة' : 'غير متوفر'}
            </button>
          </div>
        </Link>

        {/* Product Info */}
        <div className="p-3 sm:p-4" dir="rtl">
          <Link href={productUrl}>
            <h3 className="font-semibold text-gray-900 mb-1.5 sm:mb-2 line-clamp-2 min-h-[2.5rem] cursor-pointer hover:text-gray-700 transition-colors text-xs sm:text-sm">
              {product.name}
            </h3>
          </Link>
          
          {/* Price */}
          <div className="mb-2 sm:mb-3">
            {product.isCampaignMode && product.originalPrice && product.originalPrice > product.price ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm sm:text-base text-gray-500 line-through">
                  ₪{product.originalPrice.toFixed(2)}
                </span>
                <span className="text-lg sm:text-xl font-bold text-red-600">
                  ₪{product.price.toFixed(2)}
                </span>
              </div>
            ) : (
              <p className="text-lg sm:text-xl font-bold text-gray-900">
                ₪{product.price.toFixed(2)}
              </p>
            )}
          </div>

          {/* Mobile Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={!isAvailable}
            className={`w-full md:hidden flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg transition-colors font-medium text-xs sm:text-sm ${
              isAvailable
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <ShoppingCart size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span className="hidden xs:inline">{isAvailable ? 'إضافة إلى السلة' : 'غير متوفر'}</span>
            <span className="xs:hidden">{isAvailable ? 'إضافة' : 'غير متوفر'}</span>
          </button>
        </div>
      </div>
    </>
  );
}

