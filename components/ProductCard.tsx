'use client';

import { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Image as ImageIcon, MessageCircle } from 'lucide-react';
import { useShop } from '@/context/ShopContext';
import ProductModal from './ProductModal';
import { getDirectImageUrl } from '@/lib/utils';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    image?: string;
    image2?: string;
    image3?: string;
    [key: string]: any;
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useShop();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Convert image URL to direct image link (handles Google Drive preview links)
  const rawImageUrl = product.image && product.image.trim() !== '' ? product.image.trim() : '';
  const imageUrl = getDirectImageUrl(rawImageUrl);
  const hasValidImage = imageUrl && !imageError;

  // Check if product is available (CS_War + CS_Shop > 0)
  const warehouseStock = product.CS_War || product.cs_war || 0;
  const shopStock = product.CS_Shop || product.cs_shop || 0;
  const totalStock = warehouseStock + shopStock;
  const isAvailable = totalStock > 0;

  // WhatsApp function
  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const phoneNumber = '972599048348';
    const message = `مرحباً، أريد الاستفسار عن المنتج: ${product.name}`;
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Pricing Logic - Depend purely on ShopContext injected Campaign Prices
  const originalParsed = parseFloat(String(product.originalPrice || 0));
  const campaignParsed = parseFloat(String(product.campaignPrice || 0));

  const hasDiscount = campaignParsed > 0 && originalParsed > 0 && campaignParsed < originalParsed;

  // Fallback to standard price if no discount exists
  const standardPrice = parseFloat(String(product.SalePrice || product.sale_price || product.price || 0));

  const displayPrice = hasDiscount ? campaignParsed : standardPrice;
  const renderStrikethrough = hasDiscount ? originalParsed : null;

  // Intersection Observer for lazy loading - only load images when visible
  useEffect(() => {
    if (!imgRef.current || !hasValidImage) {
      // If no image, don't wait
      setIsInView(true);
      return;
    }

    // Only create observer if image is valid
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect(); // Stop observing once loaded
          }
        });
      },
      {
        rootMargin: '100px', // Start loading 100px before entering viewport for smoother experience
        threshold: 0.01, // Trigger when even 1% is visible
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

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
        <div
          ref={imgRef}
          className="relative w-full aspect-square bg-gray-100 flex items-center justify-center cursor-pointer"
          onClick={() => setIsModalOpen(true)}
        >
          {/* Out of Stock Badge */}
          {!isAvailable && (
            <div className="absolute top-2 right-2 z-10 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
              غير متوفر
            </div>
          )}
          {hasValidImage && isInView && imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              loading="lazy"
              className={`object-contain w-full h-full ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300 ${!isAvailable ? 'opacity-50 grayscale' : ''}`}
              onLoad={() => setImageLoading(false)}
              onError={(e) => {
                // Silently handle image errors - don't spam console
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
        <div className="p-4">
          <h3
            className="font-semibold text-gray-900 mb-1 line-clamp-2 min-h-[2.5rem] cursor-pointer hover:text-gray-700 transition-colors"
            onClick={() => setIsModalOpen(true)}
          >
            {product.name}
          </h3>

          <div className="mb-3">
            {hasDiscount && renderStrikethrough ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-red-600">
                  ₪{displayPrice.toFixed(2)}
                </span>
                <span className="text-sm text-gray-400 line-through">
                  ₪{renderStrikethrough.toFixed(2)}
                </span>
              </div>
            ) : (
              <p className="text-lg font-bold text-gray-900">
                ₪{displayPrice.toFixed(2)}
              </p>
            )}
          </div>
          <div className="space-y-2">
            {/* WhatsApp Button */}
            <button
              onClick={handleWhatsApp}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <MessageCircle size={18} />
              مراسلة عبر واتساب
            </button>

            {/* Add to Cart Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isAvailable) {
                  addToCart(product);
                }
              }}
              disabled={!isAvailable}
              className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-colors font-medium ${isAvailable
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
            >
              <ShoppingCart size={18} />
              {isAvailable ? 'إضافة إلى السلة' : 'غير متوفر'}
            </button>
          </div>
        </div>
      </div>

      {/* Product Modal */}
      <ProductModal
        product={product}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

