'use client';

import { useState, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import ImageUploadField from '@/components/admin/ImageUploadField';
import { ArrowRight, Loader2, X, Search, Plus, Trash } from 'lucide-react';
import { createCampaign, getProducts, Product } from '@/lib/api';

interface CampaignProduct {
  product_id: string;
  offer_price: number;
  product?: Product;
}

export default function NewCampaignPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [bannerImage, setBannerImage] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Product manager state
  const [searchQuery, setSearchQuery] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<CampaignProduct[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  useLayoutEffect(() => {
    document.title = 'إضافة عرض ترويجي جديد - New Campaign';
  }, []);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const products = await getProducts();
      setAllProducts(products || []);
    } catch (error) {
      console.error('[NewCampaignPage] Error loading products:', error);
    }
  };

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = allProducts
        .filter((p) => {
          const name = String(p.name || p.Name || '').toLowerCase();
          const id = String(p.id || p.ProductID || '').toLowerCase();
          const brand = String(p.brand || p.Brand || '').toLowerCase();
          return name.includes(query) || id.includes(query) || brand.includes(query);
        })
        .slice(0, 10); // Limit to 10 results
      setSearchResults(filtered);
      setShowSearchResults(true);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, [searchQuery, allProducts]);

  const handleProductSelect = (product: Product) => {
    // Check if product is already selected
    if (selectedProducts.some((sp) => sp.product_id === (product.id || product.ProductID))) {
      setSearchQuery('');
      setShowSearchResults(false);
      return;
    }

    // Add product with offer price = sale price initially
    const salePrice = product.price || product.SalePrice || 0;
    setSelectedProducts([
      ...selectedProducts,
      {
        product_id: product.id || product.ProductID || '',
        offer_price: salePrice,
        product,
      },
    ]);

    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter((sp) => sp.product_id !== productId));
  };

  const handleOfferPriceChange = (productId: string, offerPrice: number) => {
    setSelectedProducts(
      selectedProducts.map((sp) =>
        sp.product_id === productId ? { ...sp, offer_price: offerPrice } : sp
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('يرجى إدخال عنوان العرض');
      return;
    }

    if (!startDate || !endDate) {
      alert('يرجى إدخال تاريخ البداية والنهاية');
      return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      alert('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
      return;
    }

    if (selectedProducts.length === 0) {
      alert('يرجى إضافة منتج واحد على الأقل');
      return;
    }

    try {
      setSaving(true);
      await createCampaign({
        title: title.trim(),
        banner_image: bannerImage,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        products: selectedProducts.map((sp) => ({
          product_id: sp.product_id,
          offer_price: sp.offer_price,
        })),
      });

      router.push('/admin/marketing/campaigns');
    } catch (error: any) {
      console.error('[NewCampaignPage] Error creating campaign:', error);
      alert(`فشل في إنشاء العرض: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Set default dates (start: now, end: 7 days from now)
  useEffect(() => {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 7);

    if (!startDate) {
      setStartDate(formatDateForInput(now));
    }
    if (!endDate) {
      setEndDate(formatDateForInput(endDate));
    }
  }, []);

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">إضافة عرض ترويجي جديد</h1>
            <p className="text-gray-600 mt-1">إنشاء عرض ترويجي محدود الوقت</p>
          </div>
          <button
            onClick={() => router.push('/admin/marketing/campaigns')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium"
          >
            <ArrowRight size={20} />
            رجوع
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">معلومات أساسية</h2>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                عنوان العرض *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: عرض الصيف الكبير"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                dir="rtl"
                required
              />
            </div>

            {/* Banner Image */}
            <ImageUploadField
              label="صورة البانر"
              currentValue={bannerImage}
              onUploadComplete={setBannerImage}
            />

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  تاريخ البداية *
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  تاريخ النهاية *
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  required
                />
              </div>
            </div>
          </div>

          {/* Product Manager */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">إدارة المنتجات</h2>

            {/* Search Bar */}
            <div className="relative">
              <Search
                size={20}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن منتج بالاسم، الرمز، أو العلامة التجارية..."
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-500"
                dir="rtl"
              />

              {/* Search Results */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto" dir="rtl">
                  {searchResults.map((product) => {
                    const productId = product.id || product.ProductID || '';
                    const productName = product.name || product.Name || '';
                    const productImage = product.image || product.Image || '';
                    const salePrice = product.price || product.SalePrice || 0;

                    return (
                      <button
                        key={productId}
                        type="button"
                        onClick={() => handleProductSelect(product)}
                        className="w-full text-right px-4 py-3 hover:bg-gray-100 transition-colors border-b border-gray-200 last:border-b-0 flex items-center gap-3"
                      >
                        {productImage && (
                          <img
                            src={productImage}
                            alt={productName}
                            className="w-12 h-12 object-contain rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{productName}</div>
                          <div className="text-sm text-gray-500">
                            {productId} • ₪{salePrice.toFixed(2)}
                          </div>
                        </div>
                        <Plus size={20} className="text-gray-400" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Products List */}
            {selectedProducts.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  المنتجات المضافة ({selectedProducts.length})
                </h3>
                <div className="space-y-2">
                  {selectedProducts.map((sp) => {
                    const product = sp.product;
                    if (!product) return null;

                    const productName = product.name || product.Name || '';
                    const productId = product.id || product.ProductID || '';
                    const originalPrice = product.price || product.SalePrice || 0;
                    const discount = originalPrice > 0
                      ? ((originalPrice - sp.offer_price) / originalPrice) * 100
                      : 0;

                    return (
                      <div
                        key={sp.product_id}
                        className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg bg-gray-50"
                      >
                        {/* Product Image */}
                        {product.image && (
                          <img
                            src={product.image}
                            alt={productName}
                            className="w-16 h-16 object-contain rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}

                        {/* Product Info */}
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{productName}</div>
                          <div className="text-sm text-gray-500">{productId}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-600 line-through">
                              ₪{originalPrice.toFixed(2)}
                            </span>
                            <span className="text-lg font-bold text-green-600">
                              ₪{sp.offer_price.toFixed(2)}
                            </span>
                            {discount > 0 && (
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                خصم {discount.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Offer Price Input */}
                        <div className="w-32">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            سعر العرض
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={sp.offer_price}
                            onChange={(e) =>
                              handleOfferPriceChange(sp.product_id, parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 text-sm"
                            dir="ltr"
                          />
                        </div>

                        {/* Remove Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(sp.product_id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash size={18} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-start gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <span>حفظ العرض</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/marketing/campaigns')}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
