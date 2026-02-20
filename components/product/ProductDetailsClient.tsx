'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, MessageCircle, Image as ImageIcon, Home, ChevronLeft, Tag } from 'lucide-react';
import { useShop } from '@/context/ShopContext';
import { getDirectImageUrl } from '@/lib/utils';
import { getProductActiveCampaign } from '@/lib/api';
import { event } from '@/lib/fpixel';
import ProductFeatures from './ProductFeatures';
import ProductAccordion from './ProductAccordion';
import StickyCartBar from './StickyCartBar';

interface ProductDetailsClientProps {
  product: any;
}

export default function ProductDetailsClient({ product }: ProductDetailsClientProps) {
  const { addToCart } = useShop();
  const router = useRouter();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [activeCampaign, setActiveCampaign] = useState<{
    campaign_id: string;
    title: string;
    offer_price: number;
  } | null>(null);

  // Get all available images
  const images = [
    product.image || product.Image,
    product.image2 || product['Image 2'],
    product.image3 || product['image 3'],
  ]
    .filter((img): img is string => !!img && img.trim() !== '')
    .map((img) => getDirectImageUrl(img));

  const mainImage = images[selectedImageIndex] || images[0] || '';

  // Reset loading state when image changes
  useEffect(() => {
    if (!mainImage) {
      setImageLoading(false);
      setImageError(false);
      return;
    }

    // Set loading to true when image changes
    setImageLoading(true);
    setImageError(false);
  }, [mainImage]);

  // Check if image is already loaded (cached) - runs synchronously after DOM update
  useLayoutEffect(() => {
    if (!mainImage || !imgRef.current) {
      return;
    }

    const img = imgRef.current;

    // If image is already complete and has dimensions, it's loaded (cached)
    if (img.complete && img.naturalWidth > 0 && img.src === mainImage) {
      setImageLoading(false);
      setImageError(false);
    }
  }, [mainImage]);

  // Check if product is in an active campaign
  useEffect(() => {
    const checkCampaign = async () => {
      const productId = product.id || product.ProductID || '';
      if (productId) {
        const campaign = await getProductActiveCampaign(productId);
        setActiveCampaign(campaign);
      }
    };
    checkCampaign();
  }, [product.id, product.ProductID]);

  // Check if product is available
  const warehouseStock = product.CS_War || product.cs_war || 0;
  const shopStock = product.CS_Shop || product.cs_shop || 0;
  const totalStock = warehouseStock + shopStock;
  const isAvailable = totalStock > 0;

  // Price logic - prioritize campaign > promo > base
  const baseRetailPrice = Number(product.price || 0);
  const promotionalPrice = Number(product.sale_price || product.SalePrice || 0);
  const offerPrice = activeCampaign?.offer_price || null;

  const displayPrice = offerPrice !== null ? offerPrice : (promotionalPrice > 0 ? promotionalPrice : baseRetailPrice);

  const campaignOriginalPrice = promotionalPrice > 0 ? promotionalPrice : baseRetailPrice;
  const hasCampaignDiscount = offerPrice !== null && offerPrice < campaignOriginalPrice;
  const campaignDiscountPercent = hasCampaignDiscount && campaignOriginalPrice > 0
    ? Math.round(((campaignOriginalPrice - offerPrice!) / campaignOriginalPrice) * 100)
    : 0;

  const hasGeneralPromo = !hasCampaignDiscount && promotionalPrice > 0 && promotionalPrice < baseRetailPrice;

  // WhatsApp function
  const handleWhatsApp = () => {
    const phoneNumber = '972599048348';
    const message = `مرحباً، أريد الاستفسار عن المنتج: ${product.name || product.Name}`;
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleAddToCart = () => {
    if (isAvailable) {
      // Use offer price if product is in active campaign
      const productToAdd = offerPrice !== null
        ? { ...product, price: offerPrice, SalePrice: offerPrice }
        : product;
      addToCart(productToAdd);

      // Facebook Pixel: AddToCart
      const productId = product.product_id || product.id || product.ProductID;
      event('AddToCart', {
        content_ids: [String(productId)],
        content_name: product.name || product.Name || '',
        content_type: 'product',
        value: displayPrice,
        currency: 'ILS',
      });
    }
  };

  // Reset selected image when product changes
  useEffect(() => {
    setSelectedImageIndex(0);
    setImageLoading(true);
    setImageError(false);
  }, [product.id]);

  // Build specs table data
  const specs = [
    { label: 'النوع', value: product.type || product.Type },
    { label: 'العلامة التجارية', value: product.brand || product.Brand },
    { label: 'الحجم', value: product.size || product.Size },
    { label: 'اللون', value: product.color || product.Color },
    { label: 'المنشأ', value: product.Origin || product.origin },
    { label: 'الأبعاد', value: product.Dimention || product.dimention },
    { label: 'الضمان', value: product.Warranty || product.warranty },
    { label: 'الباركود', value: product.Barcode || product.barcode },
    { label: 'رقم شامل', value: product['Shamel No'] || product.shamel_no },
  ].filter((spec) => spec.value && spec.value !== '' && spec.value !== 0);

  const productName = product.name || product.Name || 'منتج';
  const productType = product.type || product.Type || '';

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-10 pb-24 md:pb-6">
        {/* Breadcrumbs */}
        <nav className="mb-6 md:mb-8 flex items-center gap-2 text-sm text-gray-600">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1 hover:text-[#D4AF37] transition-colors"
          >
            <Home size={16} />
            <span>الرئيسية</span>
          </button>
          <ChevronLeft size={16} className="text-gray-400" />
          {productType && (
            <>
              <button
                onClick={() => router.push(`/shop?type=${encodeURIComponent(productType)}`)}
                className="hover:text-[#D4AF37] transition-colors hover:underline"
              >
                {productType}
              </button>
              <ChevronLeft size={16} className="text-gray-400" />
            </>
          )}
          <span className="text-gray-900 font-medium line-clamp-1">{productName}</span>
        </nav>

        {/* Main Content - RTL Layout: Gallery (Right) + Info (Left) */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

          {/* Gallery Section (Right Side in RTL) - Sticky on Desktop */}
          <div className="w-full lg:w-1/2 flex flex-col order-1">
            <div className="sticky top-24">
              {/* Main Image */}
              <div className="relative w-full aspect-[4/3] sm:aspect-square bg-gray-50 rounded-2xl overflow-hidden mb-4 flex items-center justify-center border border-gray-100 group">
                {/* Out of Stock Badge */}
                {!isAvailable && (
                  <div className="absolute top-4 right-4 z-10 bg-red-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                    غير متوفر حالياً
                  </div>
                )}
                {/* Campaign Badge */}
                {activeCampaign && (
                  <div className="absolute top-4 left-4 z-10 bg-gradient-to-r from-red-600 to-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5">
                    <Tag size={14} />
                    <span>{activeCampaign.title}</span>
                  </div>
                )}

                {mainImage && !imageError ? (
                  <>
                    <img
                      ref={(node) => {
                        imgRef.current = node;
                        if (node && node.complete && node.naturalWidth > 0 && node.src === mainImage) {
                          setImageLoading(false);
                          setImageError(false);
                        }
                      }}
                      src={mainImage}
                      alt={productName}
                      className={`object-contain w-full h-full sm:p-4 transition-all duration-500 group-hover:scale-105 ${imageLoading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                        } ${!isAvailable ? 'opacity-50 grayscale' : ''}`}
                      onLoad={() => {
                        setImageLoading(false);
                        setImageError(false);
                      }}
                      onError={() => {
                        setImageError(true);
                        setImageLoading(false);
                      }}
                    />
                    {imageLoading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-white/80 z-10 backdrop-blur-sm">
                        <ImageIcon size={48} className="mb-2 animate-pulse" />
                        <span className="text-sm">جاري التحميل...</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-300">
                    <ImageIcon size={64} className="mb-2 opacity-50" />
                    <span className="text-sm">لا توجد صورة</span>
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-3 justify-center mt-4">
                  {images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 transition-all duration-200 ${selectedImageIndex === index
                        ? 'border-[#D4AF37] shadow-md scale-105'
                        : 'border-transparent hover:border-gray-200 opacity-70 hover:opacity-100 bg-gray-50'
                        }`}
                    >
                      <img
                        src={img}
                        alt={`${productName} - Image ${index + 1}`}
                        className="object-contain w-full h-full bg-white p-1"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Info Section (Left Side in RTL) */}
          <div className="w-full lg:w-1/2 flex flex-col order-2">

            {/* Brand */}
            {product.brand || product.Brand ? (
              <div className="mb-2 inline-block">
                <span className="text-xs sm:text-sm font-bold tracking-wider text-[#D4AF37] uppercase bg-[#D4AF37]/10 px-3 py-1 rounded-full">
                  {product.brand || product.Brand}
                </span>
              </div>
            ) : null}

            {/* Product Name */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight mb-6 text-right">
              {productName}
            </h1>

            {/* Price Block */}
            <div className="flex flex-col gap-2 mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="text-sm text-gray-500 font-medium">السعر الحالي</div>
              {hasCampaignDiscount ? (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-4xl font-bold text-red-600">
                      ₪{displayPrice.toFixed(2)}
                    </span>
                    <span className="text-xl font-medium text-gray-400 line-through">
                      ₪{campaignOriginalPrice.toFixed(2)}
                    </span>
                    <div className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold self-center">
                      وفر {campaignDiscountPercent}%
                    </div>
                  </div>
                </div>
              ) : hasGeneralPromo ? (
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-4xl font-bold text-red-600">
                    ₪{displayPrice.toFixed(2)}
                  </span>
                  <span className="text-xl font-medium text-gray-400 line-through">
                    ₪{baseRetailPrice.toFixed(2)}
                  </span>
                </div>
              ) : (
                <span className="text-4xl font-bold text-gray-900">
                  ₪{displayPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* Actions (Desktop only - mobile gets sticky bar) */}
            <div className="hidden md:flex flex-col sm:flex-row gap-3 mb-8">
              <button
                onClick={handleAddToCart}
                disabled={!isAvailable}
                className={`flex-1 flex items-center justify-center gap-3 py-4 px-8 rounded-xl transition-all duration-300 font-bold text-lg shadow-sm hover:shadow-md active:scale-95 ${isAvailable
                  ? 'bg-gray-900 text-white hover:bg-gray-800'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
              >
                <ShoppingCart size={22} />
                {isAvailable ? 'إضافة إلى السلة' : 'غير متوفر'}
              </button>

              <button
                onClick={handleWhatsApp}
                className="flex items-center justify-center gap-3 bg-[#25D366] text-white py-4 px-8 rounded-xl hover:bg-[#1ebd5a] transition-all duration-300 font-bold text-lg shadow-sm hover:shadow-md active:scale-95 sm:w-auto w-full"
              >
                <MessageCircle size={22} />
                <span className="hidden lg:inline">مراسلة واتساب</span>
              </button>
            </div>

            {/* Mobile Actions Fallback (if sticky bar fails or is unwanted) */}
            <div className="md:hidden flex flex-col gap-3 mb-8">
              <button
                onClick={handleWhatsApp}
                className="flex items-center justify-center gap-3 bg-[#25D366] text-white py-4 px-8 rounded-xl hover:bg-[#1ebd5a] transition-all duration-300 font-bold shadow-sm active:scale-95 w-full"
              >
                <MessageCircle size={22} />
                <span>استفسار عبر واتساب</span>
              </button>
            </div>

            {/* Feature Highlights (Trust indicators) */}
            <ProductFeatures />

            {/* Accordion Specs & Details */}
            <ProductAccordion description={product.description} specs={specs} />

          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar for Mobile */}
      <StickyCartBar
        product={product}
        isAvailable={isAvailable}
        displayPrice={displayPrice}
        originalPrice={hasCampaignDiscount ? campaignOriginalPrice : (hasGeneralPromo ? baseRetailPrice : displayPrice)}
      />
    </>
  );
}
