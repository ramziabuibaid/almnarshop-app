import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">المنتج غير موجود</h2>
        <p className="text-gray-600 mb-8">عذراً، المنتج الذي تبحث عنه غير موجود أو تم حذفه.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
        >
          <Home size={20} />
          العودة إلى الصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
