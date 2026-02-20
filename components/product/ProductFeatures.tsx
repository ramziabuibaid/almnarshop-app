'use client';

import { Shield, Truck, RotateCcw, HeadphonesIcon } from 'lucide-react';

export default function ProductFeatures() {
    const features = [
        {
            id: 1,
            icon: <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" />,
            title: 'ضمان الوكيل المعتمد',
            description: 'نضمن لك منتجات أصلية 100% مع ضمان الوكيل',
        },
        {
            id: 2,
            icon: <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" />,
            title: 'توصيل سريع وموثوق',
            description: 'خدمة توصيل سريعة لجميع مناطق القطاع',
        },
        {
            id: 3,
            icon: <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" />,
            title: 'إرجاع سهل ومرن',
            description: 'سياسة إرجاع خلال 3 أيام لراحة بالك',
        },
        {
            id: 4,
            icon: <HeadphonesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[#D4AF37]" />,
            title: 'دعم فني متخصص',
            description: 'فريقنا متواجد دائماً للرد على جميع استفساراتك',
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-8 mb-8" dir="rtl">
            {features.map((feature) => (
                <div
                    key={feature.id}
                    className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-right gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100/50 hover:border-gray-200 transition-colors"
                >
                    <div className="flex-shrink-0 bg-white p-2.5 rounded-full shadow-sm border border-gray-100">
                        {feature.icon}
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900 text-sm mb-0.5">{feature.title}</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">{feature.description}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}
