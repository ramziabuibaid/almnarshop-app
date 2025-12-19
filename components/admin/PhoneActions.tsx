'use client';

import { useState, useRef, useEffect } from 'react';
import { Phone, MessageCircle } from 'lucide-react';
import { fixPhoneNumber } from '@/lib/utils';

interface PhoneActionsProps {
  phone: string;
  onClose?: () => void;
}

export default function PhoneActions({ phone, onClose }: PhoneActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const fixedPhone = fixPhoneNumber(phone);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (onClose) onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Get local number (remove leading 0 for WhatsApp)
  const getLocalNumber = (phoneNum: string): string => {
    if (!phoneNum) return '';
    const cleaned = phoneNum.trim().replace(/\s+/g, '').replace(/-/g, '');
    // Remove leading 0 if present
    if (cleaned.startsWith('0')) {
      return cleaned.substring(1);
    }
    return cleaned;
  };

  const localNumber = getLocalNumber(fixedPhone);

  const handleCall = () => {
    window.location.href = `tel:${fixedPhone}`;
    setIsOpen(false);
    if (onClose) onClose();
  };

  const handleWhatsApp = (countryCode: '970' | '972') => {
    const whatsappNumber = `${countryCode}${localNumber}`;
    window.open(`https://wa.me/${whatsappNumber}`, '_blank');
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!fixedPhone) return null;

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
      >
        <Phone size={14} />
        {fixedPhone}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
            <div className="p-2 space-y-1">
              {/* Call Option */}
              <button
                onClick={handleCall}
                className="w-full flex items-center gap-3 px-3 py-2 text-right text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Phone size={18} className="text-blue-600" />
                <span className="flex-1">اتصال: {fixedPhone}</span>
              </button>

              {/* WhatsApp 970 */}
              <button
                onClick={() => handleWhatsApp('970')}
                className="w-full flex items-center gap-3 px-3 py-2 text-right text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <MessageCircle size={18} className="text-green-600" />
                <span className="flex-1">واتساب: 970{localNumber}</span>
              </button>

              {/* WhatsApp 972 */}
              <button
                onClick={() => handleWhatsApp('972')}
                className="w-full flex items-center gap-3 px-3 py-2 text-right text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <MessageCircle size={18} className="text-green-600" />
                <span className="flex-1">واتساب: 972{localNumber}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

