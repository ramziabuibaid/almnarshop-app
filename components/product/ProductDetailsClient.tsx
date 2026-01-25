'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, MessageCircle, Image as ImageIcon, Ruler, Palette, Shield, Home, ChevronLeft, Tag } from 'lucide-react';
import { useShop } from '@/context/ShopContext';
import { getDirectImageUrl } from '@/lib/utils';
import { getProductActiveCampaign } from '@/lib/api';

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

  // Price logic - use offer price if in active campaign, otherwise use sale_price
  const originalSalePrice = product.price || product.SalePrice || 0;
  const offerPrice = activeCampaign?.offer_price || null;
  const displayPrice = offerPrice !== null ? offerPrice : originalSalePrice;
  const regularPrice = product.CostPrice || product.T1Price || product.T2Price || 0;
  const hasDiscount = regularPrice > 0 && regularPrice > displayPrice;
  const hasCampaignDiscount = offerPrice !== null && offerPrice < originalSalePrice;
  const campaignDiscountPercent = hasCampaignDiscount && originalSalePrice > 0
    ? Math.round(((originalSalePrice - offerPrice!) / originalSalePrice) * 100)
    : 0;

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
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumbs */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-gray-600">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1 hover:text-gray-900 transition-colors"
        >
          <Home size={16} />
          <span>الرئيسية</span>
        </button>
        <ChevronLeft size={16} className="text-gray-400" />
        {productType && (
          <>
            <button
              onClick={() => router.push(`/?type=${encodeURIComponent(productType)}`)}
              className="hover:text-gray-900 transition-colors hover:underline"
            >
              {productType}
            </button>
            <ChevronLeft size={16} className="text-gray-400" />
          </>
        )}
        <span className="text-gray-900 font-medium line-clamp-1">{productName}</span>
      </nav>

      {/* Main Content - RTL Layout: Gallery (Right) + Info (Left) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="flex flex-col lg:flex-row">
          {/* Gallery Section (Right Side in RTL) */}
          <div className="w-full lg:w-1/2 bg-gray-50 p-4 md:p-6 flex flex-col order-2 lg:order-1">
            {/* Main Image */}
            <div className="relative w-full min-h-[300px] max-h-[600px] bg-white rounded-lg overflow-hidden mb-4 flex items-center justify-center border border-gray-200">
              {/* Out of Stock Badge */}
              {!isAvailable && (
                <div className="absolute top-4 right-4 z-10 bg-red-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                  غير متوفر حالياً
                </div>
              )}
              {mainImage && !imageError ? (
                <>
                  <img
                    ref={(node) => {
                      imgRef.current = node;
                      // Check if image is already loaded (cached) when ref is set
                      if (node && node.complete && node.naturalWidth > 0 && node.src === mainImage) {
                        setImageLoading(false);
                        setImageError(false);
                      }
                    }}
                    src={mainImage}
                    alt={productName}
                    className={`object-contain w-full h-full transition-opacity duration-300 ${
                      imageLoading ? 'opacity-0' : 'opacity-100'
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-white/80 z-10">
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
              <div className="flex gap-2 justify-center flex-wrap">
                {images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSelectedImageIndex(index);
                      // Don't reset loading state here - let the useEffect handle it
                    }}
                    className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImageIndex === index
                        ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-2'
                        : 'border-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${productName} - Image ${index + 1}`}
                      className="object-contain w-full h-full bg-white"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info Section (Left Side in RTL) */}
          <div className="w-full lg:w-1/2 p-4 md:p-6 flex flex-col order-1 lg:order-2">
            {/* Brand */}
            {product.brand || product.Brand ? (
              <div className="mb-3">
                <span className="text-sm font-semibold text-gray-700">العلامة التجارية: </span>
                <span className="text-sm text-gray-900">{product.brand || product.Brand}</span>
              </div>
            ) : null}

            {/* Product Name */}
            <div className="mb-4">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 text-right">
                {productName}
              </h1>
              {/* Campaign Badge */}
              {activeCampaign && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2">
                    <Tag size={16} />
                    <span>{activeCampaign.title}</span>
                  </div>
                  {hasCampaignDiscount && (
                    <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold">
                      خصم {campaignDiscountPercent}%
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Price */}
            <div className="mb-6 text-right">
              {hasCampaignDiscount ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-4xl md:text-5xl font-bold text-red-600">
                      ₪{displayPrice.toFixed(2)}
                    </span>
                    <span className="text-2xl md:text-3xl font-semibold text-gray-400 line-through">
                      ₪{originalSalePrice.toFixed(2)}
                    </span>
                  </div>
                  {hasDiscount && regularPrice > displayPrice && (
                    <div className="text-sm text-gray-500">
                      السعر الأصلي: <span className="line-through">₪{regularPrice.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              ) : hasDiscount ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-4xl md:text-5xl font-bold text-gray-900">
                    ₪{displayPrice.toFixed(2)}
                  </span>
                  <span className="text-2xl md:text-3xl font-semibold text-gray-400 line-through">
                    ₪{regularPrice.toFixed(2)}
                  </span>
                </div>
              ) : (
                <span className="text-4xl md:text-5xl font-bold text-gray-900">
                  ₪{displayPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* Key Specs Icons */}
            <div className="mb-6 flex flex-wrap gap-4">
              {product.size || product.Size ? (
                <div className="flex items-center gap-2 text-gray-700">
                  <Ruler size={20} className="text-gray-500" />
                  <span className="text-sm">
                    <span className="font-semibold">الحجم: </span>
                    {product.size || product.Size}
                  </span>
                </div>
              ) : null}
              {product.color || product.Color ? (
                <div className="flex items-center gap-2 text-gray-700">
                  <Palette size={20} className="text-gray-500" />
                  <span className="text-sm">
                    <span className="font-semibold">اللون: </span>
                    {product.color || product.Color}
                  </span>
                </div>
              ) : null}
              {product.Warranty || product.warranty ? (
                <div className="flex items-center gap-2 text-gray-700">
                  <Shield size={20} className="text-gray-500" />
                  <span className="text-sm">
                    <span className="font-semibold">الضمان: </span>
                    {product.Warranty || product.warranty}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Actions */}
            <div className="space-y-3 mb-6">
              {/* Add to Cart Button */}
              <button
                onClick={handleAddToCart}
                disabled={!isAvailable}
                className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-lg transition-colors font-semibold text-lg ${
                  isAvailable
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <ShoppingCart size={24} />
                {isAvailable ? 'إضافة إلى السلة' : 'غير متوفر'}
              </button>

              {/* WhatsApp Button */}
              <button
                onClick={handleWhatsApp}
                className="w-full flex items-center justify-center gap-3 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors font-semibold text-base"
              >
                <MessageCircle size={20} />
                مراسلة عبر واتساب
              </button>
            </div>

            {/* Description */}
            {product.description && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">الوصف</h3>
                <p className="text-gray-700 leading-relaxed text-right">{product.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Specs Table (Bottom) */}
        {specs.length > 0 && (
          <div className="border-t border-gray-200 p-4 md:p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 text-right">المواصفات الفنية</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <tbody>
                  {specs.map((spec, index) => (
                    <tr
                      key={index}
                      className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                    >
                      <td className="px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">
                        {spec.label}
                      </td>
                      <td className="px-4 py-3 text-gray-900 border-b border-gray-200">
                        {spec.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
