'use client';

import { useState } from 'react';
import { X, Plus, Minus, ShoppingBag, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useShop } from '@/context/ShopContext';
import { submitOnlineOrder, getCustomerFromSupabase } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface CartItemProps {
  item: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
  };
  updateCartQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
}

function CartItem({ item, updateCartQuantity, removeFromCart }: CartItemProps) {
  const [imageError, setImageError] = useState(false);
  // Use ImageUrl directly from API - no conversion needed
  const imageUrl = item.image && item.image.trim() !== '' ? item.image.trim() : '';
  const hasValidImage = imageUrl && !imageError;

  return (
    <div className="flex gap-4 p-3 bg-gray-50 rounded-lg">
      <div className="relative w-20 h-20 bg-white rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
        {hasValidImage && imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="object-contain w-full h-full"
            onError={() => setImageError(true)}
          />
        ) : (
          <ImageIcon size={24} className="text-gray-300" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
          {item.name}
        </h3>
        <p className="text-sm text-gray-600 mb-2">
          ₪{item.price.toFixed(2)} each
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              <Minus size={16} className="text-gray-600" />
            </button>
            <span className="w-8 text-center font-medium text-gray-900">
              {item.quantity}
            </span>
            <button
              onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              <Plus size={16} className="text-gray-600" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-gray-900">
              ₪{(item.price * item.quantity).toFixed(2)}
            </p>
            <button
              onClick={() => removeFromCart(item.id)}
              className="p-1 hover:bg-red-100 rounded transition-colors"
            >
              <X size={16} className="text-red-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { cart, updateCartQuantity, removeFromCart, user, clearCart } = useShop();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckoutClick = () => {
    if (cart.length === 0) {
      setCheckoutError('السلة فارغة');
      return;
    }

    // If user is logged in, use old flow
    if (user) {
      handleCheckoutWithUser();
      return;
    }

    // If no user, show checkout form
    setShowCheckoutForm(true);
    setCheckoutError('');
  };

  const handleCheckoutWithUser = async () => {
    setIsSubmitting(true);
    setCheckoutError('');
    setCheckoutSuccess(false);

    try {
      console.log('[Checkout] Submitting order for logged-in user...', {
        userId: user?.id,
        userEmail: user?.email,
        cartItems: cart.length,
        total: total,
      });

      // Get customer data from Supabase
      const customerId = user?.id || user?.CustomerID || user?.customerID || '';
      const userEmail = user?.email || user?.Email || '';
      
      let customerData = null;
      if (customerId) {
        customerData = await getCustomerFromSupabase(customerId);
      }
      if (!customerData && userEmail) {
        customerData = await getCustomerFromSupabase(userEmail);
      }

      // Use customer data from Supabase if available, otherwise use user data from context
      const customerName = customerData?.name || user?.name || user?.Name || userEmail || '';
      const customerPhone = customerData?.phone || user?.phone || user?.Phone || '';
      const customerEmail = customerData?.email || userEmail || '';

      if (!customerName) {
        setCheckoutError('لم يتم العثور على بيانات الزبون. يرجى المحاولة مرة أخرى.');
        return;
      }

      if (!customerPhone) {
        setCheckoutError('رقم الهاتف غير موجود في بيانات الزبون. يرجى إدخال رقم الهاتف.');
        // Show form to enter phone number
        setCustomerName(customerName);
        setCustomerEmail(customerEmail);
        setShowCheckoutForm(true);
        setIsSubmitting(false);
        return;
      }

      // Prepare order data for online_orders table
      const orderData = {
        customerName: customerName,
        customerPhone: customerPhone,
        customerEmail: customerEmail || undefined,
        notes: undefined, // Can be added later if needed
        items: cart.map((item) => ({
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
      };

      console.log('[Checkout] Online order data:', orderData);

      // Submit online order to Supabase
      const result = await submitOnlineOrder(orderData);
      console.log('[Checkout] Online order submitted successfully:', result);

      // Show success message
      setCheckoutSuccess(true);

      // Clear cart after successful order
      setTimeout(() => {
        clearCart();
        setCheckoutSuccess(false);
        onClose();
        router.push('/profile');
      }, 2000);
    } catch (error: any) {
      console.error('[Checkout] Error submitting order:', error);
      setCheckoutError(
        error?.message || 'فشل إرسال الطلبية. يرجى المحاولة مرة أخرى.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitOnlineOrder = async () => {
    // Validate form
    if (!customerName.trim()) {
      setCheckoutError('الرجاء إدخال اسم الزبون');
      return;
    }

    if (!customerPhone.trim()) {
      setCheckoutError('الرجاء إدخال رقم الهاتف');
      return;
    }

    setIsSubmitting(true);
    setCheckoutError('');
    setCheckoutSuccess(false);

    try {
      console.log('[Checkout] Submitting online order...', {
        customerName,
        customerPhone,
        cartItems: cart.length,
        total: total,
      });

      const orderData = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        notes: customerNotes.trim() || undefined,
        items: cart.map((item) => ({
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
      };

      console.log('[Checkout] Online order data:', orderData);

      // Submit online order to Supabase
      const result = await submitOnlineOrder(orderData);
      console.log('[Checkout] Online order submitted successfully:', result);

      // Show success message
      setCheckoutSuccess(true);

      // Clear cart and form after successful order
      setTimeout(() => {
        clearCart();
        setCustomerName('');
        setCustomerPhone('');
        setCustomerEmail('');
        setCustomerNotes('');
        setShowCheckoutForm(false);
        setCheckoutSuccess(false);
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error('[Checkout] Error submitting online order:', error);
      setCheckoutError(
        error?.message || 'فشل إرسال الطلبية. يرجى المحاولة مرة أخرى.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-[60]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-xl z-[70] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag size={24} />
            Cart ({cart.length})
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingBag size={64} className="text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  updateCartQuantity={updateCartQuantity}
                  removeFromCart={removeFromCart}
                />
              ))}
            </div>
          )}
        </div>

        {/* Checkout Form Modal */}
        {showCheckoutForm && (
          <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">معلومات الطلبية</h3>
                <button
                  onClick={() => {
                    setShowCheckoutForm(false);
                    setCheckoutError('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    اسم الزبون <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="أدخل اسم الزبون"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    رقم الهاتف <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="أدخل رقم الهاتف"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    البريد الإلكتروني (اختياري)
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="أدخل البريد الإلكتروني"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ملاحظات خاصة (اختياري)
                  </label>
                  <textarea
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                    placeholder="أدخل أي ملاحظات خاصة بالطلبية"
                    disabled={isSubmitting}
                  />
                </div>

                {checkoutError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {checkoutError}
                  </div>
                )}

                {checkoutSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                    تم إرسال الطلبية بنجاح!
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowCheckoutForm(false);
                      setCheckoutError('');
                    }}
                    disabled={isSubmitting || checkoutSuccess}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSubmitOnlineOrder}
                    disabled={isSubmitting || checkoutSuccess}
                    className="flex-1 bg-gray-900 text-white py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        جاري الإرسال...
                      </>
                    ) : checkoutSuccess ? (
                      'تم الإرسال!'
                    ) : (
                      'إرسال الطلبية'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {cart.length > 0 && !showCheckoutForm && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between text-lg">
              <span className="font-semibold text-gray-900">المجموع:</span>
              <span className="font-bold text-gray-900">₪{total.toFixed(2)}</span>
            </div>

            {checkoutSuccess && !showCheckoutForm && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                تم إرسال الطلبية بنجاح!
              </div>
            )}

            {checkoutError && !showCheckoutForm && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {checkoutError}
              </div>
            )}

            <button
              onClick={handleCheckoutClick}
              disabled={isSubmitting || checkoutSuccess}
              className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  جاري المعالجة...
                </>
              ) : checkoutSuccess ? (
                'تم إرسال الطلبية!'
              ) : (
                'إتمام الطلب'
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

