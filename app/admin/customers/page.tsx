'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import React from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import AddInteractionModal from '@/components/admin/AddInteractionModal';
import CustomerFormModal from '@/components/admin/CustomerFormModal';
import PhoneActions from '@/components/admin/PhoneActions';
import { getDashboardData, saveCustomer, getAllCustomers } from '@/lib/api';
import { fixPhoneNumber } from '@/lib/utils';
import {
  Users,
  Loader2,
  Phone,
  User,
  DollarSign,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Edit,
  AlertCircle,
  Calendar,
  Clock,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Customer {
  CustomerID?: string;
  id?: string;
  Name?: string;
  name?: string;
  Email?: string;
  email?: string;
  Phone?: string;
  phone?: string;
  Type?: string;
  type?: string;
  Balance?: number;
  balance?: number;
  Address?: string;
  address?: string;
  Photo?: string;
  photo?: string;
  [key: string]: any;
}

type FilterType = 'All' | 'Customer' | 'Merchant' | 'Supplier' | 'Accounting';
type SortField = 'customerId' | 'name' | 'type' | 'phone' | 'balance' | 'lastInvoice' | 'lastPayment' | null;
type SortDirection = 'asc' | 'desc';

// Optimized Mobile Customer Card Component
const MobileCustomerCard = React.memo(({ 
  customer, 
  canViewBalances, 
  router, 
  handleViewProfile, 
  handleEditCustomer, 
  handleOpenInteractionModal,
  getTypeBadgeColor,
  getBalanceColor,
  formatBalance,
  formatDate
}: {
  customer: Customer;
  canViewBalances: boolean;
  router: any;
  handleViewProfile: (customer: Customer, event?: React.MouseEvent) => void;
  handleEditCustomer: (customer: Customer) => void;
  handleOpenInteractionModal: (customer: Customer) => void;
  getTypeBadgeColor: (type: string | undefined) => string;
  getBalanceColor: (balance: number | undefined | null) => string;
  formatBalance: (balance: number | undefined | null) => string;
  formatDate: (dateString: string | undefined | null) => string | null;
}) => {
  const customerId = customer.CustomerID || customer.id || customer.customerID || '';
  const name = customer.Name || customer.name || 'N/A';
  const phone = customer.Phone || customer.phone || '';
  const type = customer.Type || customer.type || 'Customer';
  const balance = customer.Balance || customer.balance || 0;
  const lastInvoiceDate = customer.LastInvoiceDate || customer.lastInvoiceDate || customer['Last Invoice Date'] || '';
  const lastPaymentDate = customer.LastPaymentDate || customer.lastPaymentDate || customer['Last Payment Date'] || '';
  const shamelNo = customer['Shamel No'] || customer.ShamelNo || customer.shamel_no;
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-200">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <User size={18} className="text-gray-400 flex-shrink-0" />
            <button
              onClick={() => handleViewProfile(customer)}
              className="text-base font-bold text-gray-900 hover:text-blue-600 hover:underline text-right truncate transition-colors"
            >
              {name}
            </button>
          </div>
          <div className="text-xs text-gray-500 mb-1">
            {customerId}
            {shamelNo && ` • شامل: ${shamelNo}`}
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getTypeBadgeColor(
              type
            )}`}
          >
            {type}
          </span>
        </div>
      </div>

      {/* Phone */}
      {phone && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">الهاتف</div>
          <PhoneActions phone={phone} />
        </div>
      )}

      {/* Balance */}
      {canViewBalances && (
        <div className="mb-3 p-2 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">الرصيد</div>
          <div className={`text-lg font-bold ${getBalanceColor(balance)}`}>
            {formatBalance(balance)}
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        {formatDate(lastInvoiceDate) && (
          <div>
            <div className="text-gray-500 mb-0.5">آخر فاتورة</div>
            <div className="text-gray-900 font-medium">{formatDate(lastInvoiceDate)}</div>
          </div>
        )}
        {formatDate(lastPaymentDate) && (
          <div>
            <div className="text-gray-500 mb-0.5">آخر دفعة</div>
            <div className="text-gray-900 font-medium">{formatDate(lastPaymentDate)}</div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
        <button
          onClick={() => handleOpenInteractionModal(customer)}
          className="flex-1 px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center justify-center gap-2 transition-colors text-sm"
        >
          <Phone size={16} />
          <span>تفاعل</span>
        </button>
        {canViewBalances && (
          <button
            onClick={() => handleEditCustomer(customer)}
            className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center justify-center gap-2 transition-colors text-sm"
            title="تعديل العميل"
          >
            <Edit size={16} />
            <span>تعديل</span>
          </button>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  const prevId = prevProps.customer.CustomerID || prevProps.customer.id || prevProps.customer.customerID || '';
  const nextId = nextProps.customer.CustomerID || nextProps.customer.id || nextProps.customer.customerID || '';
  return (
    prevId === nextId &&
    prevProps.canViewBalances === nextProps.canViewBalances
  );
});

MobileCustomerCard.displayName = 'MobileCustomerCard';

export default function CustomersPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    document.title = 'الزبائن';
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user has permission to view balances
  const canViewBalances = admin?.is_super_admin || admin?.permissions?.viewBalances === true;
  const [searchInput, setSearchInput] = useState(''); // For input field - updates immediately
  const [searchQuery, setSearchQuery] = useState(''); // For actual filtering - updates in background
  const [isPending, startTransition] = useTransition();
  
  // Mobile pagination state
  const [mobilePage, setMobilePage] = useState(1);
  const MOBILE_PAGE_SIZE = 20;
  
  // Desktop pagination state
  const [desktopPage, setDesktopPage] = useState(1);
  const DESKTOP_PAGE_SIZE = 50;
  
  // Debounce hook for search
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Debounced search handler
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value); // Update input immediately
    
    // Clear previous timeout
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    // Set new timeout for debounced search
    searchDebounceRef.current = setTimeout(() => {
      startTransition(() => {
        setSearchQuery(value);
      });
    }, 300); // 300ms debounce delay
  }, [startTransition]);
  
  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);
  const [filterType, setFilterType] = useState<FilterType>('All');
  const [showNegativeBalance, setShowNegativeBalance] = useState(true);
  const [showZeroBalance, setShowZeroBalance] = useState(true);
  const [lastInvoiceYear, setLastInvoiceYear] = useState<string>('');
  const [lastPaymentYear, setLastPaymentYear] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedInteraction, setSelectedInteraction] = useState<any | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [dashboardData, setDashboardData] = useState<any>({ overdue: [], today: [], upcoming: [] });
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [showOverdueList, setShowOverdueList] = useState(false);
  const [showTodayList, setShowTodayList] = useState(false);

  // Set page title
  useEffect(() => {
    document.title = 'العملاء - Customers';
  }, []);

  // Load customers on mount
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAllCustomers();
        setCustomers(data || []);
      } catch (err: any) {
        console.error('[CustomersPage] Error loading customers:', err);
        setError(err?.message || 'Failed to load customers');
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    };

    loadCustomers();
  }, []);

  // Fetch dashboard data on mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  // Reload customers
  const reloadCustomers = async () => {
    try {
      const data = await getAllCustomers();
      setCustomers(data || []);
    } catch (err: any) {
      console.error('[CustomersPage] Error reloading customers:', err);
    }
  };

  const loadDashboardData = async () => {
    setDashboardLoading(true);
    try {
      console.log('[CustomersPage] Loading dashboard data...');
      const data = await getDashboardData();
      console.log('[CustomersPage] Dashboard data loaded:', data);
      setDashboardData(data || { overdue: [], today: [], upcoming: [] });
    } catch (error: any) {
      console.error('[CustomersPage] Error loading dashboard data:', error);
      // Don't show error to user, just log it
      setDashboardData({ overdue: [], today: [], upcoming: [] });
    } finally {
      setDashboardLoading(false);
    }
  };

  // Map English filter types to Arabic values in database
  const getTypeMapping = (englishType: FilterType): string[] => {
    const mapping: Record<FilterType, string[]> = {
      'All': [],
      'Customer': ['زبون', 'Customer', 'customer'],
      'Merchant': ['تاجر', 'Merchant', 'merchant'],
      'Supplier': ['مورد', 'Supplier', 'supplier'],
      'Accounting': ['تنظيمات محاسبية', 'Accounting', 'accounting'],
    };
    return mapping[englishType] || [];
  };

  // Helper function to parse date string to timestamp
  const parseDateToTimestamp = (dateString: string | undefined | null): number | null => {
    if (!dateString || dateString.trim() === '') return null;
    
    try {
      let date: Date;
      
      // Check if date is in DD-MM-YYYY format
      const ddMMyyyyPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
      const match = dateString.trim().match(ddMMyyyyPattern);
      
      if (match) {
        // Parse DD-MM-YYYY format
        const [, day, month, year] = match;
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        // Try to parse as standard date format
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) return null;
      
      return date.getTime();
    } catch (error) {
      console.error('[CustomersPage] Error parsing date:', dateString, error);
      return null;
    }
  };

  // Sort customers: by customer_id from largest to smallest (default sort)
  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a: any, b: any) => {
      const aId = String(a.CustomerID || a.id || a.customerID || '').toLowerCase();
      const bId = String(b.CustomerID || b.id || b.customerID || '').toLowerCase();
      // Compare as strings, but handle numeric parts if present
      const aNumMatch = aId.match(/(\d+)/);
      const bNumMatch = bId.match(/(\d+)/);
      
      if (aNumMatch && bNumMatch) {
        const aNum = parseInt(aNumMatch[1], 10);
        const bNum = parseInt(bNumMatch[1], 10);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return bNum - aNum; // Descending order (largest to smallest)
        }
      }
      
      // Fallback to string comparison (descending)
      return bId.localeCompare(aId, 'en', { numeric: true });
    });
  }, [customers]);

  // Filter and search customers
  const filteredCustomers = useMemo(() => {
    // First, filter out customers with empty CustomerID
    let filtered = sortedCustomers.filter((c) => {
      const customerId = c.CustomerID || c.id || c.customerID;
      return customerId && customerId !== '';
    });

    // Filter by type (handle both Arabic and English values)
    if (filterType !== 'All') {
      const typeValues = getTypeMapping(filterType);
      console.log('[CustomersPage] Filtering by type:', filterType, 'matching values:', typeValues);
      filtered = filtered.filter((c) => {
        const customerType = (c.Type || c.type || '').trim();
        const matches = typeValues.some(type => customerType === type || customerType.toLowerCase() === type.toLowerCase());
        if (matches) {
          console.log('[CustomersPage] Customer matches filter:', customerType, 'for filter:', filterType);
        }
        return matches;
      });
      console.log('[CustomersPage] Filtered customers count:', filtered.length, 'out of', customers.length);
    }

    // Filter by balance (negative balance)
    if (!showNegativeBalance) {
      filtered = filtered.filter((c) => {
        const balance = c.Balance || c.balance || 0;
        return balance >= 0;
      });
    }

    // Filter by balance (zero balance)
    if (!showZeroBalance) {
      filtered = filtered.filter((c) => {
        const balance = c.Balance || c.balance || 0;
        return balance !== 0;
      });
    }

    // Filter by last invoice year
    if (lastInvoiceYear) {
      filtered = filtered.filter((c) => {
        const lastInvoiceDate = c.LastInvoiceDate || c.lastInvoiceDate || c['Last Invoice Date'] || '';
        if (!lastInvoiceDate) return false;
        
        try {
          const date = new Date(lastInvoiceDate);
          if (isNaN(date.getTime())) return false;
          const year = date.getFullYear().toString();
          return year === lastInvoiceYear;
        } catch (error) {
          return false;
        }
      });
    }

    // Filter by last payment year
    if (lastPaymentYear) {
      filtered = filtered.filter((c) => {
        const lastPaymentDate = c.LastPaymentDate || c.lastPaymentDate || c['Last Payment Date'] || '';
        if (!lastPaymentDate) return false;
        
        try {
          const date = new Date(lastPaymentDate);
          if (isNaN(date.getTime())) return false;
          const year = date.getFullYear().toString();
          return year === lastPaymentYear;
        } catch (error) {
          return false;
        }
      });
    }

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
        
        // Combine all searchable fields into one text
        const searchableText = `${name} ${phone}`;
        
        // Check if ALL search words are found in the searchable text
        return searchWords.every(word => searchableText.includes(word));
      });
    }

    // Sort customers
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let comparison = 0;

        switch (sortField) {
          case 'customerId':
            const customerIdA = String(a.CustomerID || a.id || a.customerID || '').toLowerCase();
            const customerIdB = String(b.CustomerID || b.id || b.customerID || '').toLowerCase();
            comparison = customerIdA.localeCompare(customerIdB, 'en', { sensitivity: 'base' });
            break;

          case 'name':
            const nameA = String(a.Name || a.name || '').toLowerCase();
            const nameB = String(b.Name || b.name || '').toLowerCase();
            comparison = nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
            break;

          case 'type':
            const typeA = String(a.Type || a.type || '').toLowerCase();
            const typeB = String(b.Type || b.type || '').toLowerCase();
            comparison = typeA.localeCompare(typeB, 'en', { sensitivity: 'base' });
            break;

          case 'phone':
            const phoneA = String(a.Phone || a.phone || '').toLowerCase();
            const phoneB = String(b.Phone || b.phone || '').toLowerCase();
            comparison = phoneA.localeCompare(phoneB, 'en', { sensitivity: 'base' });
            break;

          case 'balance':
            // Only allow sorting by balance if user has permission
            if (!canViewBalances) {
              comparison = 0;
              break;
            }
            const balanceA = a.Balance || a.balance || 0;
            const balanceB = b.Balance || b.balance || 0;
            comparison = balanceA - balanceB;
            break;

          case 'lastInvoice':
            const invoiceDateA = a.LastInvoiceDate || a.lastInvoiceDate || a['Last Invoice Date'] || '';
            const invoiceDateB = b.LastInvoiceDate || b.lastInvoiceDate || b['Last Invoice Date'] || '';
            const timestampA = parseDateToTimestamp(invoiceDateA);
            const timestampB = parseDateToTimestamp(invoiceDateB);
            if (timestampA === null && timestampB === null) comparison = 0;
            else if (timestampA === null) comparison = 1; // null dates go to end
            else if (timestampB === null) comparison = -1; // null dates go to end
            else {
              comparison = timestampA - timestampB;
            }
            break;

          case 'lastPayment':
            const paymentDateA = a.LastPaymentDate || a.lastPaymentDate || a['Last Payment Date'] || '';
            const paymentDateB = b.LastPaymentDate || b.lastPaymentDate || b['Last Payment Date'] || '';
            const paymentTimestampA = parseDateToTimestamp(paymentDateA);
            const paymentTimestampB = parseDateToTimestamp(paymentDateB);
            if (paymentTimestampA === null && paymentTimestampB === null) comparison = 0;
            else if (paymentTimestampA === null) comparison = 1; // null dates go to end
            else if (paymentTimestampB === null) comparison = -1; // null dates go to end
            else {
              comparison = paymentTimestampA - paymentTimestampB;
            }
            break;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [sortedCustomers, filterType, searchQuery, showNegativeBalance, showZeroBalance, lastInvoiceYear, lastPaymentYear, sortField, sortDirection, canViewBalances]);
  
  // Paginated customers for mobile view
  const paginatedMobileCustomers = useMemo(() => {
    const startIndex = (mobilePage - 1) * MOBILE_PAGE_SIZE;
    const endIndex = startIndex + MOBILE_PAGE_SIZE;
    return filteredCustomers.slice(startIndex, endIndex);
  }, [filteredCustomers, mobilePage]);
  
  const totalMobilePages = Math.ceil(filteredCustomers.length / MOBILE_PAGE_SIZE);
  
  // Paginated customers for desktop view
  const paginatedDesktopCustomers = useMemo(() => {
    const startIndex = (desktopPage - 1) * DESKTOP_PAGE_SIZE;
    const endIndex = startIndex + DESKTOP_PAGE_SIZE;
    return filteredCustomers.slice(startIndex, endIndex);
  }, [filteredCustomers, desktopPage]);
  
  const totalDesktopPages = Math.ceil(filteredCustomers.length / DESKTOP_PAGE_SIZE);
  
  // Reset pages when filtered customers change significantly
  useEffect(() => {
    if (mobilePage > totalMobilePages && totalMobilePages > 0) {
      setMobilePage(1);
    }
    if (desktopPage > totalDesktopPages && totalDesktopPages > 0) {
      setDesktopPage(1);
    }
  }, [totalMobilePages, totalDesktopPages, mobilePage, desktopPage]);
  
  // Reset pages when search changes
  useEffect(() => {
    setMobilePage(1);
    setDesktopPage(1);
  }, [searchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalReceivables = sortedCustomers
      .filter((c) => {
        const balance = c.Balance || c.balance || 0;
        return balance > 0;
      })
      .reduce((sum, c) => sum + (c.Balance || c.balance || 0), 0);

    const totalPayables = Math.abs(
      sortedCustomers
        .filter((c) => {
          const balance = c.Balance || c.balance || 0;
          return balance < 0;
        })
        .reduce((sum, c) => sum + (c.Balance || c.balance || 0), 0)
    );

    return {
      totalReceivables,
      totalPayables,
      totalCustomers: sortedCustomers.length,
    };
  }, [sortedCustomers]);

  // Calculate filtered customers balance total
  const filteredBalanceTotal = useMemo(() => {
    return filteredCustomers.reduce((sum, c) => {
      return sum + (c.Balance || c.balance || 0);
    }, 0);
  }, [filteredCustomers]);

  const handleOpenInteractionModal = (customer: Customer, interaction?: any) => {
    setSelectedCustomer(customer);
    setSelectedInteraction(interaction || null);
    setIsInteractionModalOpen(true);
  };

  const handleCloseInteractionModal = () => {
    setIsInteractionModalOpen(false);
    setSelectedCustomer(null);
    setSelectedInteraction(null);
  };

  const handleInteractionSuccess = async () => {
    // Reload customers and dashboard data
    await reloadCustomers();
    loadDashboardData();
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsCustomerModalOpen(true);
  };

  const handleCloseCustomerModal = () => {
    setIsCustomerModalOpen(false);
    setEditingCustomer(null);
  };

  const handleCustomerSuccess = async (customerId?: string) => {
    // Reload customers
    await reloadCustomers();
    // customerId is available if needed for future enhancements
  };

  const handleViewProfile = (customer: Customer, event?: React.MouseEvent) => {
    const customerId = customer.CustomerID || customer.id || customer.customerID || '';
    if (!customerId) return;

    // If Ctrl/Cmd, Shift, or Middle mouse button is pressed, open in new tab
    if (event) {
      const isNewTab = event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1;
      if (isNewTab) {
        // Open in new tab (not new window)
        window.open(`/admin/customers/${customerId}`, '_blank', 'noopener,noreferrer');
        return;
      }
    }

    router.push(`/admin/customers/${customerId}`);
  };

  const formatBalance = (balance: number | undefined | null) => {
    const value = balance || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString || dateString.trim() === '') return null;
    
    try {
      let date: Date;
      
      // Check if date is in DD-MM-YYYY format
      const ddMMyyyyPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
      const match = dateString.trim().match(ddMMyyyyPattern);
      
      if (match) {
        // Parse DD-MM-YYYY format
        const [, day, month, year] = match;
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        // Try to parse as standard date format
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) return null;
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      console.error('[CustomersPage] Error formatting date:', dateString, error);
      return null;
    }
  };

  const getBalanceColor = (balance: number | undefined | null) => {
    const value = balance || 0;
    if (value > 0) return 'text-red-600 font-semibold';
    if (value < 0) return 'text-green-600 font-semibold';
    return 'text-gray-500';
  };

  const getTypeBadgeColor = (type: string | undefined) => {
    const typeStr = (type || '').trim();
    // Handle both Arabic and English values
    if (typeStr === 'زبون' || typeStr.toLowerCase() === 'customer') {
      return 'bg-blue-100 text-blue-800';
    } else if (typeStr === 'تاجر' || typeStr.toLowerCase() === 'merchant') {
      return 'bg-purple-100 text-purple-800';
    } else if (typeStr === 'مورد' || typeStr.toLowerCase() === 'supplier') {
      return 'bg-orange-100 text-orange-800';
    } else if (typeStr === 'تنظيمات محاسبية' || typeStr.toLowerCase() === 'accounting') {
      return 'bg-gray-100 text-gray-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    // Prevent sorting by balance if user doesn't have permission
    if (field === 'balance' && !canViewBalances) {
      return;
    }
    
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with ascending direction
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get sort icon for column header
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} className="inline-block mr-1" />
    ) : (
      <ArrowDown size={14} className="inline-block mr-1" />
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">الزبائن</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              إدارة علاقات العملاء ومتابعة المستحقات والمديونيات
            </p>
          </div>
          <button
            onClick={() => {
              setEditingCustomer(null);
              setIsCustomerModalOpen(true);
            }}
            className="w-full sm:w-auto px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Users size={20} />
            <span>إضافة عميل جديد</span>
          </button>
        </div>

        {/* Follow-up Dashboard */}
        {(dashboardData.overdue?.length > 0 || dashboardData.today?.length > 0) && (
          <div className="space-y-3 sm:space-y-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">مهام المتابعة</h2>
            
            {/* Overdue Follow-ups */}
            {dashboardData.overdue?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowOverdueList(!showOverdueList)}
                  className="w-full flex items-center justify-between p-4 hover:bg-red-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle size={20} className="text-red-600" />
                    <h3 className="font-semibold text-red-900">متأخرة ({dashboardData.overdue.length})</h3>
                  </div>
                  {showOverdueList ? (
                    <ChevronUp size={20} className="text-red-600" />
                  ) : (
                    <ChevronDown size={20} className="text-red-600" />
                  )}
                </button>
                {showOverdueList && (
                  <div className="p-4 pt-0 space-y-2">
                  {dashboardData.overdue
                    .filter((item: any) => item) // Filter out null/undefined items
                    .map((item: any, index: number) => {
                      const itemId = item.InteractionID || item.id || item.CustomerID || item.customerID || `overdue-${index}`;
                      return (
                        <div
                          key={`overdue-${itemId}-${index}`}
                          className="bg-white rounded-lg p-3 border border-red-200 flex items-center justify-between"
                        >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {item.CustomerName || item.customerName || 'عميل'}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {item.Notes || item.notes || 'لا توجد ملاحظات'}
                        </p>
                        {item.NextFollowUpDate && (
                          <p className="text-xs text-red-600 mt-1">
                            كان من المفترض: {formatDate(item.NextFollowUpDate)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const customer = customers.find(
                              (c) => (c.CustomerID || c.id) === (item.CustomerID || item.customerID)
                            );
                            if (customer) {
                              handleOpenInteractionModal(customer, item);
                            }
                          }}
                          className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                          title="تعديل"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => {
                            const customer = customers.find(
                              (c) => (c.CustomerID || c.id) === (item.CustomerID || item.customerID)
                            );
                            if (customer) {
                              handleOpenInteractionModal(customer, item);
                            }
                          }}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                          title="فتح/تعديل"
                        >
                          فتح
                        </button>
                      </div>
                    </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Today Follow-ups */}
            {dashboardData.today?.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowTodayList(!showTodayList)}
                  className="w-full flex items-center justify-between p-4 hover:bg-blue-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Calendar size={20} className="text-blue-600" />
                    <h3 className="font-semibold text-blue-900">اليوم ({dashboardData.today.length})</h3>
                  </div>
                  {showTodayList ? (
                    <ChevronUp size={20} className="text-blue-600" />
                  ) : (
                    <ChevronDown size={20} className="text-blue-600" />
                  )}
                </button>
                {showTodayList && (
                  <div className="p-4 pt-0 space-y-2">
                  {dashboardData.today
                    .filter((item: any) => item) // Filter out null/undefined items
                    .map((item: any, index: number) => {
                      const itemId = item.InteractionID || item.id || item.CustomerID || item.customerID || `today-${index}`;
                      return (
                        <div
                          key={`today-${itemId}-${index}`}
                          className="bg-white rounded-lg p-3 border border-blue-200 flex items-center justify-between"
                        >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {item.CustomerName || item.customerName || 'عميل'}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {item.Notes || item.notes || 'لا توجد ملاحظات'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const customer = customers.find(
                              (c) => (c.CustomerID || c.id) === (item.CustomerID || item.customerID)
                            );
                            if (customer) {
                              handleOpenInteractionModal(customer, item);
                            }
                          }}
                          className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                          title="تعديل"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => {
                            const customer = customers.find(
                              (c) => (c.CustomerID || c.id) === (item.CustomerID || item.customerID)
                            );
                            if (customer) {
                              handleOpenInteractionModal(customer, item);
                            }
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          title="فتح/تعديل"
                        >
                          فتح
                        </button>
                      </div>
                    </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {/* Total Receivables */}
          {canViewBalances && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">إجمالي المستحقات</p>
                  <p className="text-2xl font-bold text-red-600 mt-2">
                    {formatBalance(stats.totalReceivables)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">المال المستحق لنا</p>
                </div>
                <div className="p-3 bg-red-50 rounded-full">
                  <TrendingUp size={24} className="text-red-600" />
                </div>
              </div>
            </div>
          )}

          {/* Total Payables */}
          {canViewBalances && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">إجمالي المدفوعات</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">
                    {formatBalance(stats.totalPayables)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">المال المستحق علينا</p>
                </div>
                <div className="p-3 bg-green-50 rounded-full">
                  <TrendingDown size={24} className="text-green-600" />
                </div>
              </div>
            </div>
          )}

          {/* Total Customers */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">إجمالي العملاء</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {stats.totalCustomers}
                </p>
                <p className="text-xs text-gray-500 mt-1">جميع أنواع العملاء</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-full">
                <Users size={24} className="text-gray-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* Search */}
          <div className="relative">
            <Search
              size={18}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="البحث بالاسم أو الهاتف..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-500 text-sm sm:text-base"
              dir="rtl"
            />
            {searchInput && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Type Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs sm:text-sm font-semibold text-gray-700 mr-2">فلترة حسب النوع:</span>
            {([
              { value: 'All', label: 'الكل' },
              { value: 'Customer', label: 'زبون' },
              { value: 'Merchant', label: 'تاجر' },
              { value: 'Supplier', label: 'مورد' },
              { value: 'Accounting', label: 'تنظيمات محاسبية' }
            ] as { value: FilterType; label: string }[]).map(
              ({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilterType(value)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors ${
                    filterType === value
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              )
            )}
          </div>

          {/* Balance Filters */}
          {canViewBalances && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-xs sm:text-sm font-semibold text-gray-700">فلاتر الرصيد:</span>
              <button
                onClick={() => setShowNegativeBalance(!showNegativeBalance)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors flex items-center gap-2 ${
                  showNegativeBalance
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-100 text-gray-500 border border-gray-300'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${showNegativeBalance ? 'bg-green-600' : 'bg-gray-400'}`} />
                <span className="hidden sm:inline">إظهار الرصيد السالب</span>
                <span className="sm:hidden">رصيد سالب</span>
              </button>
              <button
                onClick={() => setShowZeroBalance(!showZeroBalance)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors flex items-center gap-2 ${
                  showZeroBalance
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-500 border border-gray-300'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${showZeroBalance ? 'bg-blue-600' : 'bg-gray-400'}`} />
                <span className="hidden sm:inline">إظهار الرصيد الصفر</span>
                <span className="sm:hidden">رصيد صفر</span>
              </button>
            </div>
          )}

          {/* Date Filters */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-4">
            <span className="text-xs sm:text-sm font-semibold text-gray-700">فلاتر التاريخ:</span>
            
            {/* Last Invoice Year Filter */}
            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <label className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">آخر فاتورة:</label>
              <select
                value={lastInvoiceYear}
                onChange={(e) => {
                  setLastInvoiceYear(e.target.value);
                  if (e.target.value) {
                    setLastPaymentYear(''); // Clear payment year when invoice year is selected
                  }
                }}
                className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 text-xs sm:text-sm"
              >
                <option value="">جميع السنوات</option>
                {Array.from({ length: 11 }, (_, i) => 2025 - i).map((year) => (
                  <option key={year} value={year.toString()}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Last Payment Year Filter */}
            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <label className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">آخر دفعة:</label>
              <select
                value={lastPaymentYear}
                onChange={(e) => {
                  setLastPaymentYear(e.target.value);
                  if (e.target.value) {
                    setLastInvoiceYear(''); // Clear invoice year when payment year is selected
                  }
                }}
                className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 text-xs sm:text-sm"
              >
                <option value="">جميع السنوات</option>
                {Array.from({ length: 11 }, (_, i) => 2025 - i).map((year) => (
                  <option key={year} value={year.toString()}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>


          {/* Filtered Balance Total */}
          {canViewBalances && filteredCustomers.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-semibold text-gray-700">
                  مجموع أرصدة العملاء المفلترين ({filteredCustomers.length}):
                </span>
                <span className={`text-base sm:text-lg font-bold ${
                  filteredBalanceTotal > 0 
                    ? 'text-red-600' 
                    : filteredBalanceTotal < 0 
                    ? 'text-green-600' 
                    : 'text-gray-600'
                }`}>
                  {formatBalance(filteredBalanceTotal)}
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-800 mb-1">خطأ في تحميل العملاء</h3>
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      setError(null);
                      const data = await getAllCustomers();
                      setCustomers(data || []);
                    } catch (err: any) {
                      setError(err?.message || 'فشل تحميل العملاء');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  إعادة المحاولة
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Table View */}
        <div className="hidden md:block">
          {loading ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">جاري تحميل العملاء...</p>
            </div>
          ) : error ? null : filteredCustomers.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Users size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">لم يتم العثور على عملاء</p>
              {searchQuery && (
                <p className="text-gray-500 text-sm mt-2">
                  حاول تعديل استعلام البحث
                </p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th 
                        className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                        onClick={() => handleSort('customerId')}
                      >
                        <div className="flex items-center justify-end">
                          رقم الزبون
                          {getSortIcon('customerId')}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center justify-end">
                          الاسم
                          {getSortIcon('name')}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                        onClick={() => handleSort('type')}
                      >
                        <div className="flex items-center justify-end">
                          النوع
                          {getSortIcon('type')}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                        onClick={() => handleSort('phone')}
                      >
                        <div className="flex items-center justify-end">
                          الهاتف
                          {getSortIcon('phone')}
                        </div>
                      </th>
                      {canViewBalances && (
                        <th 
                          className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                          onClick={() => handleSort('balance')}
                        >
                          <div className="flex items-center justify-end">
                            الرصيد
                            {getSortIcon('balance')}
                          </div>
                        </th>
                      )}
                      <th 
                        className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                        onClick={() => handleSort('lastInvoice')}
                      >
                        <div className="flex items-center justify-end">
                          تاريخ آخر فاتورة
                          {getSortIcon('lastInvoice')}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                        onClick={() => handleSort('lastPayment')}
                      >
                        <div className="flex items-center justify-end">
                          تاريخ آخر دفعة
                          {getSortIcon('lastPayment')}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedDesktopCustomers.map((customer, index) => {
                        const customerId = customer.CustomerID || customer.id || customer.customerID || `fallback-${index}`;
                        const name = customer.Name || customer.name || 'N/A';
                        const phone = customer.Phone || customer.phone || '';
                        const type = customer.Type || customer.type || 'Customer';
                        const balance = customer.Balance || customer.balance || 0;
                        const lastInvoiceDate = customer.LastInvoiceDate || customer.lastInvoiceDate || customer['Last Invoice Date'] || '';
                        const lastPaymentDate = customer.LastPaymentDate || customer.lastPaymentDate || customer['Last Payment Date'] || '';

                        return (
                        <tr
                          key={customerId}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          {/* Customer Number */}
                          <td className="px-4 py-3 text-right">
                            <div className="font-semibold text-gray-900">
                              {customerId}
                            </div>
                            {(customer['Shamel No'] || customer.ShamelNo || customer.shamel_no) && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {customer['Shamel No'] || customer.ShamelNo || customer.shamel_no}
                              </div>
                            )}
                          </td>
                          {/* Name */}
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={(e) => {
                                // If Ctrl/Cmd is pressed, open in new tab
                                if (e.ctrlKey || e.metaKey) {
                                  e.preventDefault();
                                  window.open(`/admin/customers/${customerId}`, '_blank', 'noopener,noreferrer');
                                } else {
                                  // Otherwise, use router
                                  handleViewProfile(customer);
                                }
                              }}
                              onMouseDown={(e) => {
                                // Handle middle mouse button - open in new tab
                                if (e.button === 1) {
                                  e.preventDefault();
                                  window.open(`/admin/customers/${customerId}`, '_blank', 'noopener,noreferrer');
                                }
                              }}
                              className="font-semibold text-gray-900 hover:text-blue-600 hover:underline text-right transition-colors cursor-pointer"
                              title="عرض الملف الشخصي (Ctrl+Click أو Cmd+Click لفتح في تاب جديد)"
                            >
                              {name}
                            </button>
                          </td>

                          {/* Type */}
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(
                                type
                              )}`}
                            >
                              {type}
                            </span>
                          </td>

                          {/* Phone */}
                          <td className="px-4 py-3 text-right">
                            {phone ? (
                              <PhoneActions phone={phone} />
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>

                          {/* Balance */}
                          {canViewBalances && (
                            <td className="px-4 py-3 text-right">
                              <span className={getBalanceColor(balance)}>
                                {formatBalance(balance)}
                              </span>
                            </td>
                          )}

                          {/* Last Invoice Date */}
                          <td className="px-4 py-3 text-right">
                            {formatDate(lastInvoiceDate) ? (
                              <span className="text-sm text-gray-900">
                                {formatDate(lastInvoiceDate)}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>

                          {/* Last Payment Date */}
                          <td className="px-4 py-3 text-right">
                            {formatDate(lastPaymentDate) ? (
                              <span className="text-sm text-gray-900">
                                {formatDate(lastPaymentDate)}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center gap-2">
                              {canViewBalances && (
                                <button
                                  onClick={() => handleEditCustomer(customer)}
                                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                  title="تعديل العميل"
                                >
                                  <Edit size={18} />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenInteractionModal(customer)}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="إضافة تفاعل"
                              >
                                <Phone size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Desktop Pagination */}
              {totalDesktopPages > 1 && (
                <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex items-center justify-between flex-wrap gap-4" dir="rtl">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDesktopPage((prev) => Math.max(1, prev - 1))}
                      disabled={desktopPage === 1}
                      className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm text-gray-900 font-medium"
                    >
                      <ChevronRight size={16} className="text-gray-900" />
                      السابق
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from(
                        { length: Math.min(5, totalDesktopPages) },
                        (_, i) => {
                          let pageNum;
                          const currentPage = desktopPage;

                          if (totalDesktopPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalDesktopPages - 2) {
                            pageNum = totalDesktopPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => setDesktopPage(pageNum)}
                              className={`px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${
                                currentPage === pageNum
                                  ? 'bg-gray-900 text-white'
                                  : 'border border-gray-300 hover:bg-gray-100 text-gray-900'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        }
                      )}
                    </div>

                    <button
                      onClick={() => setDesktopPage((prev) => Math.min(totalDesktopPages, prev + 1))}
                      disabled={desktopPage === totalDesktopPages}
                      className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm text-gray-900 font-medium"
                    >
                      التالي
                      <ChevronLeft size={16} className="text-gray-900" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-900 font-medium">
                    <span>
                      صفحة {desktopPage} من {totalDesktopPages || 1}
                    </span>
                    <select
                      value={DESKTOP_PAGE_SIZE}
                      onChange={(e) => {
                        // Page size is fixed for now, but we can make it dynamic later
                        const newSize = Number(e.target.value);
                        setDesktopPage(1); // Reset to first page when changing page size
                      }}
                      className="px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900 text-sm text-gray-900 font-medium bg-white"
                      dir="rtl"
                      disabled
                    >
                      <option value={DESKTOP_PAGE_SIZE}>{DESKTOP_PAGE_SIZE} لكل صفحة</option>
                    </select>
                    <span>
                      إجمالي: {filteredCustomers.length} عميل
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <Loader2 className="animate-spin" size={20} />
                <span>جاري التحميل...</span>
              </div>
            </div>
          ) : error ? null : filteredCustomers.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              <Users size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">لم يتم العثور على عملاء</p>
              {searchQuery && (
                <p className="text-gray-500 text-sm mt-2">
                  حاول تعديل استعلام البحث
                </p>
              )}
            </div>
          ) : isPending ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <Loader2 className="animate-spin" size={20} />
                <span>جاري البحث...</span>
              </div>
            </div>
          ) : (
            <>
              {paginatedMobileCustomers.map((customer) => {
                const customerId = customer.CustomerID || customer.id || customer.customerID || '';
                return (
                  <MobileCustomerCard
                    key={customerId}
                    customer={customer}
                    canViewBalances={canViewBalances}
                    router={router}
                    handleViewProfile={handleViewProfile}
                    handleEditCustomer={handleEditCustomer}
                    handleOpenInteractionModal={handleOpenInteractionModal}
                    getTypeBadgeColor={getTypeBadgeColor}
                    getBalanceColor={getBalanceColor}
                    formatBalance={formatBalance}
                    formatDate={formatDate}
                  />
                );
              })}
              
              {/* Mobile Pagination */}
              {totalMobilePages > 1 && (
                <div className="flex items-center justify-between gap-4 pt-4 pb-2 border-t border-gray-200 bg-white sticky bottom-0 z-10">
                  <button
                    onClick={() => setMobilePage((prev) => Math.max(1, prev - 1))}
                    disabled={mobilePage === 1}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium text-gray-900"
                  >
                    <ChevronRight size={16} />
                    السابق
                  </button>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="font-medium">
                      صفحة {mobilePage} من {totalMobilePages}
                    </span>
                    <span className="text-gray-500">
                      ({filteredCustomers.length} عميل)
                    </span>
                  </div>
                  
                  <button
                    onClick={() => setMobilePage((prev) => Math.min(totalMobilePages, prev + 1))}
                    disabled={mobilePage === totalMobilePages}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium text-gray-900"
                  >
                    التالي
                    <ChevronLeft size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Results Count */}
        {!loading && filteredCustomers.length > 0 && (
          <div className="text-xs sm:text-sm text-gray-600 text-center">
            عرض {filteredCustomers.length} من {sortedCustomers.length} عميل
          </div>
        )}
      </div>

      {/* Add/Edit Interaction Modal */}
      <AddInteractionModal
        isOpen={isInteractionModalOpen}
        onClose={handleCloseInteractionModal}
        customer={selectedCustomer}
        interaction={selectedInteraction}
        onSuccess={handleInteractionSuccess}
      />

      {/* Customer Form Modal */}
      <CustomerFormModal
        isOpen={isCustomerModalOpen}
        onClose={handleCloseCustomerModal}
        customer={editingCustomer}
        onSuccess={handleCustomerSuccess}
      />
    </AdminLayout>
  );
}
