'use client';

import { ShoppingCart } from 'lucide-react';
import { useShop } from '@/context/ShopContext';
import { event } from '@/lib/fpixel';

interface StickyCartBarProps {
    product: any;
    isAvailable: boolean;
    displayPrice: number;
    originalPrice: number;
}

export default function StickyCartBar({ product, isAvailable, displayPrice, originalPrice }: StickyCartBarProps) {
    const { addToCart } = useShop();

    const handleAddToCart = () => {
        if (isAvailable) {
            const productToAdd = displayPrice !== originalPrice
                ? { ...product, price: displayPrice, SalePrice: displayPrice }
                : product;

            addToCart(productToAdd);

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

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] p-3 md:hidden transition-transform duration-300 translate-y-0" dir="rtl">
            <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
                <div className="flex flex-col">
                    {displayPrice !== originalPrice && originalPrice > 0 ? (
                        <>
                            <span className="text-xl font-bold text-red-600">₪{displayPrice.toFixed(2)}</span>
                            <span className="text-sm text-gray-400 line-through">₪{originalPrice.toFixed(2)}</span>
                        </>
                    ) : (
                        <>
                            <span className="text-sm text-gray-500">السعر</span>
                            <span className="text-xl font-bold text-gray-900">₪{displayPrice.toFixed(2)}</span>
                        </>
                    )}
                </div>
                <button
                    onClick={handleAddToCart}
                    disabled={!isAvailable}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-base transition-all active:scale-95 shadow-sm ${isAvailable
                            ? 'bg-gray-900 text-white hover:bg-gray-800'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                >
                    <ShoppingCart size={20} />
                    {isAvailable ? 'إضافة إلى السلة' : 'غير متوفر'}
                </button>
            </div>
        </div>
    );
}
