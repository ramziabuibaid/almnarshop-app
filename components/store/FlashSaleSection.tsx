'use client';

import { useState, useEffect } from 'react';
import { Clock, Tag } from 'lucide-react';
import { getActiveCampaignWithProducts } from '@/lib/api';
import { getDirectImageUrl } from '@/lib/utils';
import { useShop } from '@/context/ShopContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CampaignProduct {
  product_id?: string;
  id?: string;
  name?: string;
  Name?: string;
  price?: number;
  SalePrice?: number;
  offer_price: number;
  image?: string;
  Image?: string;
  type?: string;
  brand?: string;
  CS_War?: number;
  CS_Shop?: number;
  cs_war?: number;
  cs_shop?: number;
  [key: string]: any;
}

interface Campaign {
  campaign_id: string;
  title: string;
  banner_image?: string;
  start_date: string;
  end_date: string;
  slug?: string;
  products: CampaignProduct[];
}

export default function FlashSaleSection() {
  const { addToCart } = useShop();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    loadActiveCampaign();
  }, []);

  useEffect(() => {
    if (!campaign) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const endDate = new Date(campaign.end_date).getTime();
      const difference = endDate - now;

      if (difference > 0) {
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ hours, minutes, seconds });
      } else {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        // Campaign expired, reload to check for new active campaign
        loadActiveCampaign();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [campaign]);

  const loadActiveCampaign = async () => {
    try {
      setLoading(true);
      const activeCampaign = await getActiveCampaignWithProducts();
      setCampaign(activeCampaign);
    } catch (error) {
      console.error('[FlashSaleSection] Error loading active campaign:', error);
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: CampaignProduct) => {
    const warehouseStock = product.CS_War || product.cs_war || 0;
    const shopStock = product.CS_Shop || product.cs_shop || 0;
    const totalStock = warehouseStock + shopStock;

    if (totalStock > 0) {
      // Create a product object with the offer price
      const productToAdd = {
        ...product,
        price: product.offer_price,
        SalePrice: product.offer_price,
      };
      addToCart(productToAdd);
    }
  };

  // Get campaign URL - check both slug and campaign_id as fallback
  const campaignUrl = campaign?.slug 
    ? `/offers/${campaign.slug}` 
    : campaign?.campaign_id 
      ? `/offers/${campaign.campaign_id}` 
      : null;
  
  // Debug: log campaign data to check if slug exists
  useEffect(() => {
    if (campaign) {
      console.log('[FlashSaleSection] Campaign data:', {
        campaign_id: campaign.campaign_id,
        slug: campaign.slug,
        title: campaign.title,
        hasUrl: !!campaignUrl,
      });
    }
  }, [campaign, campaignUrl]);

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (!campaign || !campaign.products || campaign.products.length === 0) {
    return null; // Don't show section if no active campaign
  }

  const productId = (product: CampaignProduct) => product.id || product.product_id || '';
  const productName = (product: CampaignProduct) => product.name || product.Name || '';
  const originalPrice = (product: CampaignProduct) => product.price || product.SalePrice || 0;
  const discount = (product: CampaignProduct) => {
    const orig = originalPrice(product);
    return orig > 0 ? Math.round(((orig - product.offer_price) / orig) * 100) : 0;
  };

  const handleSectionClick = () => {
    if (campaignUrl) {
      router.push(campaignUrl);
    }
  };

  return (
    <section className="w-full my-6 sm:my-8" dir="rtl">
      <div 
        className={`bg-gradient-to-r from-red-600 via-red-500 to-orange-500 rounded-xl sm:rounded-2xl shadow-xl overflow-hidden ${
          campaignUrl ? 'cursor-pointer hover:shadow-2xl transition-all duration-300' : ''
        }`}
        onClick={campaignUrl ? handleSectionClick : undefined}
      >
        {/* Header */}
        <div className="bg-black/20 backdrop-blur-sm px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-white/20 p-1.5 sm:p-2 rounded-lg">
              <Tag size={20} className="text-white sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-white">{campaign.title}</h2>
              <p className="text-white/90 text-xs sm:text-sm mt-0.5 sm:mt-1">
                {campaignUrl ? 'عرض محدود الوقت - لا تفوت الفرصة! اضغط لعرض المزيد' : 'عرض محدود الوقت - لا تفوت الفرصة!'}
              </p>
            </div>
          </div>

          {/* Countdown Timer */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-white/20 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg backdrop-blur-sm">
            <Clock size={16} className="text-white sm:w-5 sm:h-5" />
            <div className="flex items-center gap-1 sm:gap-2 text-white font-mono">
              <div className="bg-white/30 px-2 sm:px-3 py-0.5 sm:py-1 rounded">
                <span className="text-sm sm:text-lg font-bold">{String(timeLeft.hours).padStart(2, '0')}</span>
                <span className="text-[10px] sm:text-xs mr-0.5 sm:mr-1">س</span>
              </div>
              <span className="text-base sm:text-xl">:</span>
              <div className="bg-white/30 px-2 sm:px-3 py-0.5 sm:py-1 rounded">
                <span className="text-sm sm:text-lg font-bold">{String(timeLeft.minutes).padStart(2, '0')}</span>
                <span className="text-[10px] sm:text-xs mr-0.5 sm:mr-1">د</span>
              </div>
              <span className="text-base sm:text-xl">:</span>
              <div className="bg-white/30 px-2 sm:px-3 py-0.5 sm:py-1 rounded">
                <span className="text-sm sm:text-lg font-bold">{String(timeLeft.seconds).padStart(2, '0')}</span>
                <span className="text-[10px] sm:text-xs mr-0.5 sm:mr-1">ث</span>
              </div>
            </div>
          </div>
        </div>

        {/* View All Button - Show if slug exists */}
        {campaignUrl && (
          <div className="px-3 sm:px-6 pb-3 sm:pb-4">
            <div
              onClick={(e) => {
                e.stopPropagation();
                router.push(campaignUrl);
              }}
              className="block w-full text-center bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 hover:scale-105 cursor-pointer"
            >
              عرض جميع منتجات العرض ←
            </div>
          </div>
        )}

        {/* Products Grid */}
        <div className="p-3 sm:p-6" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
            {campaign.products.map((product) => {
              const prodId = productId(product);
              const prodName = productName(product);
              const origPrice = originalPrice(product);
              const disc = discount(product);
              const imageUrl = getDirectImageUrl(product.image || product.Image || '');
              const warehouseStock = product.CS_War || product.cs_war || 0;
              const shopStock = product.CS_Shop || product.cs_shop || 0;
              const totalStock = warehouseStock + shopStock;
              const isAvailable = totalStock > 0;
              const productUrl = prodId ? `/product/${encodeURIComponent(prodId)}` : '#';

              return (
                <div
                  key={prodId}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-200 group"
                >
                  {/* Product Image */}
                  <Link href={productUrl} className="relative w-full aspect-square bg-gray-50 flex items-center justify-center overflow-hidden block">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={prodName}
                        className={`object-contain w-full h-full p-2 transition-transform duration-300 group-hover:scale-105 ${
                          !isAvailable ? 'opacity-50 grayscale' : ''
                        }`}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Tag size={32} />
                        <span className="text-xs mt-2">لا توجد صورة</span>
                      </div>
                    )}

                    {/* Discount Badge */}
                    {disc > 0 && (
                      <div className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-red-600 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-lg">
                        خصم {disc}%
                      </div>
                    )}

                    {/* Limited Offer Badge */}
                    <div className="absolute top-1 sm:top-2 left-1 sm:left-2 bg-orange-500 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-lg">
                      عرض محدود
                    </div>
                  </Link>

                  {/* Product Info */}
                  <div className="p-2.5 sm:p-3" dir="rtl">
                    <Link href={productUrl}>
                      <h3 className="font-semibold text-gray-900 mb-1.5 sm:mb-2 line-clamp-2 min-h-[2.5rem] text-xs sm:text-sm hover:text-gray-700 transition-colors">
                        {prodName}
                      </h3>
                    </Link>

                    {/* Price */}
                    <div className="mb-2 sm:mb-3">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        {origPrice > product.offer_price && (
                          <span className="text-xs sm:text-sm text-gray-500 line-through">
                            ₪{origPrice.toFixed(2)}
                          </span>
                        )}
                        <span className="text-lg sm:text-xl font-bold text-red-600">
                          ₪{product.offer_price.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Add to Cart Button */}
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={!isAvailable}
                      className={`w-full flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg transition-colors font-medium text-xs sm:text-sm ${
                        isAvailable
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <span className="hidden xs:inline">{isAvailable ? 'إضافة إلى السلة' : 'غير متوفر'}</span>
                      <span className="xs:hidden">{isAvailable ? 'إضافة' : 'غير متوفر'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
