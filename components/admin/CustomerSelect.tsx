'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { useAdminAuth } from '@/context/AdminAuthContext';

interface Customer {
  CustomerID?: string;
  id?: string;
  Name?: string;
  name?: string;
  Phone?: string;
  phone?: string;
  [key: string]: any;
}

interface CustomerSelectProps {
  value: string;
  onChange: (customerID: string) => void;
  customers: Customer[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function CustomerSelect({
  value,
  onChange,
  customers,
  placeholder = 'اختر العميل',
  required = false,
  disabled = false,
}: CustomerSelectProps) {
  const { admin } = useAdminAuth();
  const canViewBalances = admin?.is_super_admin || admin?.permissions?.viewBalances === true;
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const formatBalance = (balance: number | undefined | null) => {
    const value = balance || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Filter customers using smart search (same logic as customers table)
  const filteredCustomers = useMemo(() => {
    let filtered = customers;

    // Search by name or phone - supports multiple words (e.g., "نادر حنانة" will find customers with both words)
    if (searchQuery.trim()) {
      // Split search query into individual words
      const searchWords = searchQuery
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0);
      
      filtered = filtered.filter((c) => {
        // Safely convert all values to strings and create searchable text
        const name = String(c.Name || c.name || '').toLowerCase();
        const phone = String(c.Phone || c.phone || '').toLowerCase();
        const customerID = String(c.CustomerID || c.id || '').toLowerCase();
        
        // Combine all searchable fields into one text
        const searchableText = `${name} ${phone} ${customerID}`;
        
        // Check if ALL search words are found in the searchable text
        return searchWords.every(word => searchableText.includes(word));
      });
    }

    return filtered;
  }, [customers, searchQuery]);

  const selectedCustomer = useMemo(() => {
    return customers.find(
      (c) => (c.CustomerID || c.id) === value
    );
  }, [customers, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (customerID: string) => {
    onChange(customerID);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-medium text-gray-900 mb-2">
        العميل {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-right flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className={selectedCustomer ? 'text-gray-900 font-medium' : 'text-gray-500'}>
            {selectedCustomer
              ? `${selectedCustomer.Name || selectedCustomer.name || ''} (${selectedCustomer.CustomerID || selectedCustomer.id || ''})${canViewBalances && (selectedCustomer.Balance || selectedCustomer.balance) !== undefined ? ` - ${formatBalance(selectedCustomer.Balance || selectedCustomer.balance || 0)}` : ''}`
              : placeholder}
          </span>
          <ChevronDown
            size={16}
            className={`text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden">
            {/* Search Input */}
            <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="بحث عن العميل..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full pr-8 pl-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm text-gray-900 placeholder:text-gray-500"
                  autoFocus
                  dir="rtl"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery('');
                    }}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                  >
                    <X size={14} className="text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Customer List */}
            <div className="overflow-y-auto max-h-64" dir="rtl">
              {filteredCustomers.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  {searchQuery ? 'لا توجد نتائج' : 'لا يوجد زبائن'}
                </div>
              ) : (
                <div className="py-1">
                  {filteredCustomers.map((customer) => {
                    const customerID = customer.CustomerID || customer.id || '';
                    const isSelected = customerID === value;
                    return (
                      <button
                        key={customerID}
                        type="button"
                        onClick={() => handleSelect(customerID)}
                        className={`w-full text-right px-4 py-2 hover:bg-gray-50 transition-colors ${
                          isSelected ? 'bg-gray-100 font-medium' : ''
                        }`}
                      >
                        <div className="text-sm text-gray-900">
                          {customer.Name || customer.name || 'بدون اسم'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {customerID} {customer.Phone || customer.phone ? `- ${customer.Phone || customer.phone}` : ''}
                          {canViewBalances && (customer.Balance || customer.balance) !== undefined && (
                            <span className="ml-2 font-medium">
                              ({formatBalance(customer.Balance || customer.balance || 0)})
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

