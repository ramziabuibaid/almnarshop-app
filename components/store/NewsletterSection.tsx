'use client';

import { Mail, ArrowLeft } from 'lucide-react';

export default function NewsletterSection() {
    return (
        <section className="relative py-20 overflow-hidden bg-gray-900" dir="rtl">
            {/* Background Shapes */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#D4AF37] opacity-5 rounded-full blur-[100px] transform translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-900 opacity-10 rounded-full blur-[100px] transform -translate-x-1/3 translate-y-1/3" />

            <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
                <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Mail size={32} className="text-[#D4AF37]" />
                </div>

                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    لا تفوت العروض الحصرية
                </h2>

                <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
                    اشترك في نشرتنا البريدية واحصل على أحدث المنتجات، العروض الخاصة، وكوبونات الخصم مباشرة إلى بريدك الوارد.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
                    <input
                        type="email"
                        placeholder="أدخل بريدك الإلكتروني"
                        className="flex-1 px-5 py-4 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] transition-all"
                    />
                    <button className="px-8 py-4 bg-[#D4AF37] hover:bg-[#B8941F] text-black font-bold rounded-xl transition-all hover:scale-105 flex items-center justify-center gap-2">
                        اشتراك <ArrowLeft size={20} />
                    </button>
                </div>

                <p className="text-gray-500 text-sm mt-6">
                    نحترم خصوصيتك. يمكنك إلغاء الاشتراك في أي وقت.
                </p>
            </div>
        </section>
    );
}
