import { getGroomOffers } from '@/lib/api';
import StoreHeader from '@/components/store/StoreHeader';
import NewsletterSection from '@/components/store/NewsletterSection';
import { Package, Check, Gift } from 'lucide-react';

export const revalidate = 0; // Disable static caching for this page to get fresh offers

export default async function GroomOffersPage() {
    const offers = await getGroomOffers();

    return (
        <main className="min-h-screen bg-gray-50 font-cairo" dir="rtl">
            <StoreHeader />

            {/* Hero Section */}
            <div className="bg-gradient-to-r from-purple-800 to-indigo-900 text-white py-16 md:py-24 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <h1 className="text-4xl md:text-6xl font-bold mb-4">عروض العرسان المميزة</h1>
                    <p className="text-xl md:text-2xl text-purple-100 max-w-2xl mx-auto">
                        باقات متكاملة مجهزة خصيصاً لتلبية احتياجاتك بأفضل الأسعار وأجود المنتجات.
                    </p>
                </div>
            </div>

            {/* Offers Grid */}
            <div className="container mx-auto px-4 py-12">
                {offers.length === 0 ? (
                    <div className="text-center py-20">
                        <Package size={64} className="mx-auto text-gray-300 mb-4" />
                        <h2 className="text-2xl font-bold text-gray-500">لا توجد عروض حالياً</h2>
                        <p className="text-gray-400 mt-2">يرجى العودة لاحقاً للاطلاع على باقاتنا الجديدة.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {offers.map((offer) => (
                            <div
                                key={offer.QuotationID}
                                className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-shadow duration-300 flex flex-col border border-purple-50 relative group"
                            >
                                {/* Decorative Crown/Badge */}
                                <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-lg z-10 shadow-sm flex items-center gap-1">
                                    عرض مميز ✨
                                </div>

                                <div className="p-6 md:p-8 flex-1 flex flex-col">
                                    <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-purple-700 transition-colors">
                                        {offer.groomOfferTitle || 'عرض خاص'}
                                    </h3>

                                    <div className="flex items-baseline gap-1 mb-6">
                                        <span className="text-4xl font-bold text-purple-600">
                                            ₪{offer.TotalPrice.toLocaleString()}
                                        </span>
                                        {offer.SpecialDiscountAmount > 0 && (
                                            <span className="text-sm text-gray-400 line-through">
                                                ₪{(offer.TotalPrice + offer.SpecialDiscountAmount).toLocaleString()}
                                            </span>
                                        )}
                                    </div>

                                    {offer.Notes && (
                                        <div className="bg-purple-50 text-purple-800 p-3 rounded-lg text-sm mb-6 leading-relaxed">
                                            {offer.Notes}
                                        </div>
                                    )}

                                    <div className="space-y-3 mb-6 flex-1">
                                        <h4 className="font-bold text-gray-700 text-sm border-b pb-2 mb-3">محتويات الباقة:</h4>
                                        {offer.details.slice(0, 5).map((item: any) => (
                                            <div key={item.QuotationDetailID} className="flex items-start gap-2 text-gray-600 text-sm">
                                                <Check size={16} className="text-green-500 mt-0.5 shrink-0" />
                                                <span className="flex-1">
                                                    {item.product?.name || 'منتج'}
                                                    <span className="text-gray-400 text-xs mr-1">x{item.Quantity}</span>
                                                </span>
                                            </div>
                                        ))}
                                        {offer.details.length > 5 && (
                                            <div className="text-xs text-purple-600 font-medium pt-2">
                                                + {offer.details.length - 5} منتجات أخرى...
                                            </div>
                                        )}
                                    </div>

                                    {/* Gift Badge if applicable */}
                                    {offer.GiftDiscountAmount > 0 && (
                                        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm font-medium mb-6">
                                            <Gift size={18} />
                                            <span>يتضمن هدايا بقيمة ₪{offer.GiftDiscountAmount}</span>
                                        </div>
                                    )}

                                    <button className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-purple-200 mt-auto">
                                        اطلب هذا العرض
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <NewsletterSection />
        </main>
    );
}
