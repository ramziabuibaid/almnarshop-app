'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAuth } from '@/context/AdminAuthContext';
import AddInteractionModal from '@/components/admin/AddInteractionModal';
import CustomerFormModal from '@/components/admin/CustomerFormModal';
import PhoneActions from '@/components/admin/PhoneActions';
import { getDashboardData, saveCustomer } from '@/lib/api';
import { fixPhoneNumber } from '@/lib/utils';
import { useCustomers, queryKeys } from '@/hooks/useData';
import { useQueryClient } from '@tanstack/react-query';
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

export default function CustomersPage() {
  const { admin } = useAdminAuth();
  const router = useRouter();
  const { data: customers = [], isLoading: loading, error: queryError } = useCustomers();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // Check if user has permission to view balances
  const canViewBalances = admin?.is_super_admin || admin?.permissions?.viewBalances === true;
  const [searchQuery, setSearchQuery] = useState('');
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

  // Fetch dashboard data on mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  // Handle query errors
  useEffect(() => {
    if (queryError) {
      setError((queryError as Error)?.message || 'Failed to load customers');
    } else {
      setError(null);
    }
  }, [queryError]);

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
  }, [sortedCustomers, filterType, searchQuery, showNegativeBalance, showZeroBalance, lastInvoiceYear, lastPaymentYear, sortField, sortDirection]);

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

  const handleInteractionSuccess = () => {
    // Invalidate queries to refetch in background
    queryClient.invalidateQueries({ queryKey: queryKeys.customers });
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

  const handleCustomerSuccess = (customerId?: string) => {
    // Invalidate customers query to refetch in background
    queryClient.invalidateQueries({ queryKey: queryKeys.customers });
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
      <ArrowUp size={14} className="inline-block ml-1" />
    ) : (
      <ArrowDown size={14} className="inline-block ml-1" />
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customers & Debt Management</h1>
            <p className="text-gray-600 mt-1">
              Manage customer relationships and track receivables/payables
            </p>
          </div>
          <button
            onClick={() => {
              setEditingCustomer(null);
              setIsCustomerModalOpen(true);
            }}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium flex items-center gap-2"
          >
            <Users size={20} />
            إضافة عميل جديد
          </button>
        </div>

        {/* Follow-up Dashboard */}
        {(dashboardData.overdue?.length > 0 || dashboardData.today?.length > 0) && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">مهام المتابعة</h2>
            
            {/* Overdue Follow-ups */}
            {dashboardData.overdue?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={20} className="text-red-600" />
                  <h3 className="font-semibold text-red-900">متأخرة ({dashboardData.overdue.length})</h3>
                </div>
                <div className="space-y-2">
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
              </div>
            )}

            {/* Today Follow-ups */}
            {dashboardData.today?.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={20} className="text-blue-600" />
                  <h3 className="font-semibold text-blue-900">اليوم ({dashboardData.today.length})</h3>
                </div>
                <div className="space-y-2">
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
              </div>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Receivables */}
          {canViewBalances && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Receivables</p>
                  <p className="text-2xl font-bold text-red-600 mt-2">
                    {formatBalance(stats.totalReceivables)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Money owed to us</p>
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
                  <p className="text-sm font-medium text-gray-600">Total Payables</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">
                    {formatBalance(stats.totalPayables)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Money we owe</p>
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
                <p className="text-sm font-medium text-gray-600">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {stats.totalCustomers}
                </p>
                <p className="text-xs text-gray-500 mt-1">All customer types</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-full">
                <Users size={24} className="text-gray-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          {/* Type Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-700 mr-2">Filter by Type:</span>
            {(['All', 'Customer', 'Merchant', 'Supplier', 'Accounting'] as FilterType[]).map(
              (type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    filterType === type
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type}
                </button>
              )
            )}
          </div>

          {/* Balance Filters */}
          {canViewBalances && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">Balance Filters:</span>
              <button
                onClick={() => setShowNegativeBalance(!showNegativeBalance)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                  showNegativeBalance
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-100 text-gray-500 border border-gray-300'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${showNegativeBalance ? 'bg-green-600' : 'bg-gray-400'}`} />
                إظهار الرصيد السالب
              </button>
              <button
                onClick={() => setShowZeroBalance(!showZeroBalance)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                  showZeroBalance
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-500 border border-gray-300'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${showZeroBalance ? 'bg-blue-600' : 'bg-gray-400'}`} />
                إظهار الرصيد الصفر
              </button>
            </div>
          )}

          {/* Date Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-semibold text-gray-700">Date Filters:</span>
            
            {/* Last Invoice Year Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">آخر فاتورة:</label>
              <select
                value={lastInvoiceYear}
                onChange={(e) => {
                  setLastInvoiceYear(e.target.value);
                  if (e.target.value) {
                    setLastPaymentYear(''); // Clear payment year when invoice year is selected
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 text-sm"
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
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">آخر دفعة:</label>
              <select
                value={lastPaymentYear}
                onChange={(e) => {
                  setLastPaymentYear(e.target.value);
                  if (e.target.value) {
                    setLastInvoiceYear(''); // Clear invoice year when payment year is selected
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 text-sm"
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
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">
                  مجموع أرصدة العملاء المفلترين ({filteredCustomers.length}):
                </span>
                <span className={`text-lg font-bold ${
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

          {/* Search */}
          <div className="relative">
            <Search
              size={20}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-800 mb-1">Error Loading Customers</h3>
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.customers })}
                  className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Customers Table */}
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Loader2 size={48} className="animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Loading customers...</p>
          </div>
        ) : error ? null : filteredCustomers.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Users size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No customers found</p>
            {searchQuery && (
              <p className="text-gray-500 text-sm mt-2">
                Try adjusting your search query
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
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      onClick={() => handleSort('customerId')}
                    >
                      <div className="flex items-center">
                        رقم الزبون
                        {getSortIcon('customerId')}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Name
                        {getSortIcon('name')}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center">
                        Type
                        {getSortIcon('type')}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      onClick={() => handleSort('phone')}
                    >
                      <div className="flex items-center">
                        Phone
                        {getSortIcon('phone')}
                      </div>
                    </th>
                    {canViewBalances && (
                      <th 
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                        onClick={() => handleSort('balance')}
                      >
                        <div className="flex items-center">
                          Balance
                          {getSortIcon('balance')}
                        </div>
                      </th>
                    )}
                    <th 
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      onClick={() => handleSort('lastInvoice')}
                    >
                      <div className="flex items-center">
                        Last Invoice Date
                        {getSortIcon('lastInvoice')}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                      onClick={() => handleSort('lastPayment')}
                    >
                      <div className="flex items-center">
                        Last Payment Date
                        {getSortIcon('lastPayment')}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCustomers.map((customer, index) => {
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
                        <td className="px-4 py-3">
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
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{name}</div>
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(
                              type
                            )}`}
                          >
                            {type}
                          </span>
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-3">
                          {phone ? (
                            <PhoneActions phone={phone} />
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Balance */}
                        {canViewBalances && (
                          <td className="px-4 py-3">
                            <span className={getBalanceColor(balance)}>
                              {formatBalance(balance)}
                            </span>
                          </td>
                        )}

                        {/* Last Invoice Date */}
                        <td className="px-4 py-3">
                          {formatDate(lastInvoiceDate) ? (
                            <span className="text-sm text-gray-900">
                              {formatDate(lastInvoiceDate)}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>

                        {/* Last Payment Date */}
                        <td className="px-4 py-3">
                          {formatDate(lastPaymentDate) ? (
                            <span className="text-sm text-gray-900">
                              {formatDate(lastPaymentDate)}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {canViewBalances && (
                              <button
                                onClick={() => handleEditCustomer(customer)}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Edit Customer"
                              >
                                <Edit size={18} />
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenInteractionModal(customer)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Add Interaction"
                            >
                              <Phone size={18} />
                            </button>
                            <a
                              href={`/admin/customers/${customerId}`}
                              onClick={(e) => {
                                // If Ctrl/Cmd or Shift is pressed, let default behavior (open in new tab)
                                if (e.ctrlKey || e.metaKey || e.shiftKey) {
                                  return; // Let browser handle it
                                }
                                // Otherwise, prevent default and use router
                                e.preventDefault();
                                handleViewProfile(customer);
                              }}
                              onMouseDown={(e) => {
                                // Handle middle mouse button - open in new tab
                                if (e.button === 1) {
                                  e.preventDefault();
                                  window.open(`/admin/customers/${customerId}`, '_blank', 'noopener,noreferrer');
                                }
                              }}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors inline-flex items-center justify-center"
                              title="View Profile (Ctrl+Click, Shift+Click, or Middle Click to open in new tab)"
                            >
                              <User size={18} />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Results Count */}
        {!loading && filteredCustomers.length > 0 && (
          <div className="text-sm text-gray-600 text-center">
            Showing {filteredCustomers.length} of {sortedCustomers.length} customers
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
