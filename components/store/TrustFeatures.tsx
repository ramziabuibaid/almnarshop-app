'use client';

import { ShieldCheck, Truck, CreditCard, Headphones, Repeat } from 'lucide-react';

const features = [
    {
        icon: ShieldCheck,
        title: 'ضمان رسمي',
        description: 'ضمان شامل على جميع المنتجات'
    },
    {
        icon: Truck,
        title: 'توصيل سريع',
        description: 'لجميع أنحاء الضفة والقدس'
    },
    {
        icon: CreditCard,
        title: 'دفع آمن',
        description: 'خيارات دفع متعددة وآمنة'
    },
    {
        icon: Repeat,
        title: 'سياسة إرجاع',
        description: 'إرجاع سهل خلال 14 يوم'
    },
    {
        icon: Headphones,
        title: 'دعم فني',
        description: 'فريق دعم جاهز لخدمتكم'
    }
];

export default function TrustFeatures() {
    return (
        <div className="bg-white border-b border-gray-100 py-8 relative overflow-hidden" dir="rtl">
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 p-10 opacity-5 transform rotate-45 translate-x-10 -translate-y-10">
                <ShieldCheck size={120} className="text-[#D4AF37]" />
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 lg:gap-4 relative z-10">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className="flex flex-col items-center text-center group cursor-default"
                        >
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4 group-hover:bg-[#D4AF37]/10 group-hover:scale-110 transition-all duration-300 ease-out border border-gray-100 group-hover:border-[#D4AF37]/30">
                                <feature.icon
                                    size={32}
                                    className="text-gray-400 group-hover:text-[#D4AF37] transition-colors duration-300"
                                    strokeWidth={1.5}
                                />
                            </div>
                            <h3 className="font-bold text-gray-900 mb-1.5 text-sm sm:text-base group-hover:text-[#D4AF37] transition-colors">
                                {feature.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-500 max-w-[140px] leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
