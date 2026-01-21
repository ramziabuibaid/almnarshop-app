'use client';

import { useState, useEffect } from 'react';
import { Clock, Tag, ShoppingBag, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { useShop } from '@/context/ShopContext';
import { useRouter } from 'next/navigation';
import ProductCard from '@/components/store/ProductCard';
import StoreHeader from '@/components/store/StoreHeader';

interface CampaignProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  campaignPrice?: number;
  offer_price: number;
  image?: string;
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

interface CampaignLandingPageProps {
  campaign: Campaign;
}

export default function CampaignLandingPage({ campaign }: CampaignLandingPageProps) {
  const { addToCart } = useShop();
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!campaign) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const endDate = new Date(campaign.end_date).getTime();
      const difference = endDate - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
        setIsExpired(false);
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsExpired(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [campaign]);

  const handleAddToCart = (product: CampaignProduct) => {
    const warehouseStock = product.CS_War || product.cs_war || 0;
    const shopStock = product.CS_Shop || product.cs_shop || 0;
    const totalStock = warehouseStock + shopStock;

    if (totalStock > 0) {
      // Create a product object with the campaign price
      const productToAdd = {
        ...product,
        price: product.campaignPrice || product.offer_price || product.price,
        SalePrice: product.campaignPrice || product.offer_price || product.price,
      };
      addToCart(productToAdd);
    }
  };

  if (!campaign) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <StoreHeader showSearch={false} />

      {/* Hero Banner */}
      <section className="relative w-full h-[60vh] min-h-[400px] max-h-[600px] overflow-hidden">
        {campaign.banner_image ? (
          <div className="relative w-full h-full">
            <Image
              src={campaign.banner_image}
              alt={campaign.title}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-red-600 via-red-500 to-orange-500" />
        )}

        {/* Content Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-4xl mx-auto px-4 text-center text-white">
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-4">
                <Tag size={20} />
                <span className="font-semibold">عرض خاص</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                {campaign.title}
              </h1>
              <p className="text-lg md:text-xl text-gray-100 max-w-2xl mx-auto">
                لا تفوت الفرصة! عروض محدودة بأسعار لا تقاوم
              </p>
            </div>

            {/* Countdown Timer */}
            {!isExpired ? (
              <div className="flex items-center justify-center gap-3 md:gap-4">
                <div className="bg-white/20 backdrop-blur-sm px-4 py-3 rounded-lg">
                  <div className="text-3xl md:text-4xl font-bold">{String(timeLeft.days).padStart(2, '0')}</div>
                  <div className="text-xs md:text-sm text-gray-200 mt-1">يوم</div>
                </div>
                <div className="text-2xl font-bold">:</div>
                <div className="bg-white/20 backdrop-blur-sm px-4 py-3 rounded-lg">
                  <div className="text-3xl md:text-4xl font-bold">{String(timeLeft.hours).padStart(2, '0')}</div>
                  <div className="text-xs md:text-sm text-gray-200 mt-1">ساعة</div>
                </div>
                <div className="text-2xl font-bold">:</div>
                <div className="bg-white/20 backdrop-blur-sm px-4 py-3 rounded-lg">
                  <div className="text-3xl md:text-4xl font-bold">{String(timeLeft.minutes).padStart(2, '0')}</div>
                  <div className="text-xs md:text-sm text-gray-200 mt-1">دقيقة</div>
                </div>
                <div className="text-2xl font-bold">:</div>
                <div className="bg-white/20 backdrop-blur-sm px-4 py-3 rounded-lg">
                  <div className="text-3xl md:text-4xl font-bold">{String(timeLeft.seconds).padStart(2, '0')}</div>
                  <div className="text-xs md:text-sm text-gray-200 mt-1">ثانية</div>
                </div>
              </div>
            ) : (
              <div className="bg-red-600/80 backdrop-blur-sm px-6 py-3 rounded-lg inline-block">
                <p className="text-lg font-semibold">انتهى العرض</p>
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={() => {
                const productsSection = document.getElementById('products-section');
                if (productsSection) {
                  productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="mt-8 inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-all duration-300 font-semibold text-lg shadow-xl hover:shadow-2xl transform hover:scale-105"
            >
              <ShoppingBag size={24} />
              <span>تسوق الآن</span>
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* Sticky Countdown Bar (Mobile) */}
      {!isExpired && (
        <div className="sticky top-0 z-20 bg-gradient-to-r from-red-600 to-orange-500 text-white py-3 md:hidden">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-center gap-2">
              <Clock size={18} />
              <span className="text-sm font-medium">ينتهي خلال:</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="bg-white/20 px-2 py-1 rounded text-xs">
                  {String(timeLeft.hours).padStart(2, '0')}
                </span>
                <span>:</span>
                <span className="bg-white/20 px-2 py-1 rounded text-xs">
                  {String(timeLeft.minutes).padStart(2, '0')}
                </span>
                <span>:</span>
                <span className="bg-white/20 px-2 py-1 rounded text-xs">
                  {String(timeLeft.seconds).padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products Section */}
      <main id="products-section" className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            منتجات العرض الخاص
          </h2>
          <p className="text-gray-600">
            {campaign.products.length} منتج متاح بأسعار مميزة
          </p>
        </div>

        {campaign.products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">لا توجد منتجات متاحة في هذا العرض</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {campaign.products.map((product) => {
              // Calculate discount percentage
              const originalPrice = product.originalPrice || product.price || 0;
              const campaignPrice = product.campaignPrice || product.offer_price || product.price || 0;
              const discount = originalPrice > 0 && campaignPrice < originalPrice
                ? Math.round(((originalPrice - campaignPrice) / originalPrice) * 100)
                : 0;

              // Create product object with campaign price
              const productWithCampaignPrice = {
                ...product,
                price: campaignPrice,
                SalePrice: campaignPrice,
                originalPrice,
                discount,
                isCampaignMode: true,
              };

              return (
                <div key={product.id} className="relative">
                  <ProductCard product={productWithCampaignPrice} />
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
