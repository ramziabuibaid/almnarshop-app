import { getGroomOfferFromSupabase, getGroomOfferDetailsFromSupabase } from '@/lib/api';
import StoreHeader from '@/components/store/StoreHeader';
import NewsletterSection from '@/components/store/NewsletterSection';
import { Package, Check, Gift, Phone, Info } from 'lucide-react';
import { notFound } from 'next/navigation';
import Image from 'next/image';

interface PageProps {
    params: {
        id: string;
    };
}

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default async function GroomOfferDetailsPage({ params }: PageProps) {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    try {
        const quotationUrl = await getGroomOfferFromSupabase(id);

        if (!quotationUrl) {
            return notFound();
        }

        const details = await getGroomOfferDetailsFromSupabase(id);

        const subtotal = details.reduce((sum: number, detail: any) => {
            return sum + (detail.Quantity * detail.UnitPrice);
        }, 0);

        const specialDiscount = parseFloat(String(quotationUrl.special_discount_amount || 0)) || 0;
        const giftDiscount = parseFloat(String(quotationUrl.gift_discount_amount || 0)) || 0;
        const totalAmount = subtotal - specialDiscount - giftDiscount;

        const whatsappMessage = encodeURIComponent(`مرحباً، أود الاستفسار عن عرض العرسان:\n${quotationUrl.groom_offer_title || 'عرض خاص'}\nرقم العرض: ${id}\nالسعر: ₪${totalAmount.toLocaleString()}`);

        return (
            <main className="min-h-screen bg-gray-50 font-cairo" dir="rtl">
                <StoreHeader />

                {/* Hero section */}
                <div className="bg-gradient-to-r from-purple-800 to-indigo-900 text-white py-12 md:py-16 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    <div className="container mx-auto px-4 relative z-10">
                        <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
                            <h1 className="text-3xl md:text-5xl font-bold mb-4">
                                {quotationUrl.groom_offer_title || 'عرض باقة العرسان'}
                            </h1>
                            <p className="text-lg text-purple-200">
                                توفير استثنائي ومجموعة متكاملة لمنزل عصري
                            </p>
                        </div>
                    </div>
                </div>

                {/* Page Content */}
                <div className="container mx-auto px-4 py-8">
                    <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-8">

                        <div className="w-full lg:w-2/3 space-y-8">
                            {quotationUrl.Notes && (
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex gap-4 text-purple-800">
                                    <Info className="flex-shrink-0 mt-1" size={24} />
                                    <p className="leading-relaxed">
                                        {quotationUrl.Notes}
                                    </p>
                                </div>
                            )}

                            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                                <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">محتويات الباقة</h2>

                                <div className="space-y-4">
                                    {details.map((item: any) => (
                                        <div key={item.QuotationDetailID} className={`flex items-start gap-4 p-4 rounded-xl border ${item.isGift ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
                                            {/* Optional Product Image Thumbnail if exists */}
                                            <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center shrink-0 border border-gray-200 overflow-hidden relative">
                                                {item.product?.image ? (
                                                    <Image
                                                        src={item.product.image.startsWith('http') ? item.product.image : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${item.product.image}`}
                                                        alt={item.product?.name || 'صورة المنتج'}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <Package className="text-gray-400" size={24} />
                                                )}
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                                            {item.product?.name || 'منتج غير معروف'}
                                                            {item.isGift && (
                                                                <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                                                                    <Gift size={12} /> هدية
                                                                </span>
                                                            )}
                                                        </h3>
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            الكمية: {item.Quantity}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>


                        {/* Sticky Sidebar pricing */}
                        <div className="w-full lg:w-1/3">
                            <div className="bg-white rounded-2xl shadow-xl border border-purple-100 p-6 md:p-8 sticky top-24">
                                <h3 className="text-xl font-bold text-gray-900 mb-6">ملخص التكلفة</h3>

                                <div className="space-y-4 mb-6">
                                    {specialDiscount > 0 && (
                                        <div className="flex justify-between text-gray-600 border-b pb-4">
                                            <span>القيمة الأصلية للمنتجات</span>
                                            <span className="line-through">₪{subtotal.toLocaleString()}</span>
                                        </div>
                                    )}

                                    {giftDiscount > 0 && (
                                        <div className="flex justify-between text-green-600 font-medium border-b pb-4">
                                            <span className="flex items-center gap-2"><Gift size={16} /> قيمة الهدايا المشمولة</span>
                                            <span>₪{giftDiscount.toLocaleString()}</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-end pt-4">
                                        <span className="text-gray-900 font-bold">السعر النهائي للباقة</span>
                                        <span className="text-4xl font-black text-purple-700">₪{totalAmount.toLocaleString()}</span>
                                    </div>

                                    {specialDiscount > 0 && (
                                        <div className="bg-purple-50 text-purple-700 text-center py-2 rounded-lg text-sm font-bold mt-2">
                                            وفرت ₪{(specialDiscount).toLocaleString()}!
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <a
                                        href={`https://wa.me/972599048348?text=${whatsappMessage}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                                    >
                                        <Phone size={20} />
                                        للاستفسار والحجز عبر واتساب
                                    </a>
                                </div>
                                <p className="text-center text-xs text-gray-400 mt-4">
                                    هذا العرض خاضع لتوفر المنتجات في المخزون
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <NewsletterSection />
            </main>
        );
    } catch (error) {
        console.error("Error loading groom offer details:", error);
        return notFound();
    }
}
