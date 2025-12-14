'use client';

import { useState, useEffect } from 'react';
import { X, ShoppingCart, Image as ImageIcon, MessageCircle } from 'lucide-react';
import { useShop } from '@/context/ShopContext';
import { getDirectImageUrl } from '@/lib/utils';

interface ProductModalProps {
  product: {
    id: string;
    name: string;
    price: number;
    image?: string;
    image2?: string;
    image3?: string;
    brand?: string;
    description?: string;
    [key: string]: any;
  };
  isOpen: boolean;
  onClose: () => void;
}

export default function ProductModal({ product, isOpen, onClose }: ProductModalProps) {
  const { addToCart } = useShop();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Get all available images and convert to direct URLs
  const images = [
    product.image,
    product.image2,
    product.image3,
  ]
    .filter((img): img is string => !!img && img.trim() !== '')
    .map((img) => getDirectImageUrl(img));

  const mainImage = images[selectedImageIndex] || images[0] || '';
  
  // Check if product is available (CS_War + CS_Shop > 0)
  const warehouseStock = product.CS_War || product.cs_war || 0;
  const shopStock = product.CS_Shop || product.cs_shop || 0;
  const totalStock = warehouseStock + shopStock;
  const isAvailable = totalStock > 0;
  
  // WhatsApp function
  const handleWhatsApp = () => {
    const phoneNumber = '972599048348';
    const message = `مرحباً، أريد الاستفسار عن المنتج: ${product.name}`;
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Reset selected image when product changes
  useEffect(() => {
    if (isOpen) {
      setSelectedImageIndex(0);
      setImageLoading(true);
      setImageError(false);
    }
  }, [product.id, isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAddToCart = () => {
    addToCart(product);
    // Optional: Show a toast notification or close modal
    // onClose();
  };

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
        style={{ animation: 'fadeIn 0.2s ease-out' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row pointer-events-auto"
          style={{ animation: 'scaleIn 0.3s ease-out' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-10 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={24} className="text-gray-700" />
          </button>

          {/* Gallery Section */}
          <div className="w-full md:w-1/2 bg-gray-50 p-4 md:p-6 flex flex-col">
            {/* Main Image */}
            <div className="relative w-full min-h-[300px] max-h-[600px] bg-gray-100 rounded-lg overflow-hidden mb-4 flex items-center justify-center">
              {/* Out of Stock Badge */}
              {!isAvailable && (
                <div className="absolute top-4 right-4 z-10 bg-red-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                  غير متوفر حالياً
                </div>
              )}
              {mainImage && !imageError ? (
                <>
                  <img
                    src={mainImage}
                    alt={product.name}
                    className={`object-contain w-full h-full transition-opacity duration-300 ${
                      imageLoading ? 'opacity-0' : 'opacity-100'
                    } ${!isAvailable ? 'opacity-50 grayscale' : ''}`}
                    onLoad={() => setImageLoading(false)}
                    onError={() => {
                      setImageError(true);
                      setImageLoading(false);
                    }}
                  />
                  {imageLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                      <ImageIcon size={48} className="mb-2 animate-pulse" />
                      <span className="text-sm">جاري التحميل...</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <ImageIcon size={64} className="mb-2" />
                  <span className="text-sm">لا توجد صورة</span>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 justify-center">
                {images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSelectedImageIndex(index);
                      setImageLoading(true);
                      setImageError(false);
                    }}
                    className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImageIndex === index
                        ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-2'
                        : 'border-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${product.name} - Image ${index + 1}`}
                      className="object-contain w-full h-full"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="w-full md:w-1/2 p-4 md:p-6 flex flex-col overflow-y-auto" dir="rtl">
            <div className="flex-1">
              {/* Name */}
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 text-right">
                {product.name}
              </h2>

              {/* Price */}
              <p className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-right">
                ₪{product.price.toFixed(2)}
              </p>

              {/* Product Details with Arabic labels */}
              <div className="mb-4 space-y-2">
                {product.type && (
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-700">النوع: </span>
                    <span className="text-sm text-gray-900">{product.type}</span>
                  </div>
                )}
                {product.brand && (
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-700">العلامة التجارية: </span>
                    <span className="text-sm text-gray-900">{product.brand}</span>
                  </div>
                )}
                {product.size && (
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-700">الحجم: </span>
                    <span className="text-sm text-gray-900">{product.size}</span>
                  </div>
                )}
                {product.color && (
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-700">اللون: </span>
                    <span className="text-sm text-gray-900">{product.color}</span>
                  </div>
                )}
                {product.Origin && (
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-700">المنشأ: </span>
                    <span className="text-sm text-gray-900">{product.Origin}</span>
                  </div>
                )}
                {product.Dimention && (
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-700">الأبعاد: </span>
                    <span className="text-sm text-gray-900">{product.Dimention}</span>
                  </div>
                )}
                {product.Warranty && (
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-700">الضمان: </span>
                    <span className="text-sm text-gray-900">{product.Warranty}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <div className="mb-6">
                  <p className="text-gray-700 leading-relaxed text-right">{product.description}</p>
                </div>
              )}
            </div>

            {/* WhatsApp Button */}
            <button
              onClick={handleWhatsApp}
              className="w-full flex items-center justify-center gap-3 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors font-semibold text-base mt-4"
            >
              <MessageCircle size={20} />
              مراسلة عبر واتساب
            </button>

            {/* Add to Cart Button */}
            <button
              onClick={handleAddToCart}
              disabled={!isAvailable}
              className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-lg transition-colors font-semibold text-lg mt-2 ${
                isAvailable
                  ? 'bg-gray-900 text-white hover:bg-gray-800'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <ShoppingCart size={24} />
              {isAvailable ? 'إضافة إلى السلة' : 'غير متوفر'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

