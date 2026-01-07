'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, DollarSign } from 'lucide-react';
import { useShop } from '@/context/ShopContext';
import { getCustomerHistory } from '@/lib/api';

interface Invoice {
  id: string;
  date: string;
  amount: number;
  source: string;
  items?: any[];
  [key: string]: any;
}

export default function ProfilePage() {
  const { user, logout } = useShop();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'invoices' | 'receipts'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = 'الملف الشخصي - Profile';
  }, []);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadHistory = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const history = await getCustomerHistory(user.id);
      
      // Separate invoices and receipts
      // Handle different response structures
      let allInvoices: Invoice[] = [];
      let allReceipts: Invoice[] = [];

      if (Array.isArray(history)) {
        // If history is an array, separate by type
        allInvoices = history.filter((item: any) => 
          item.type === 'invoice' || item.source === 'Shop' || item.source === 'Warehouse'
        );
        allReceipts = history.filter((item: any) => 
          item.type === 'receipt' || item.type === 'Receipt'
        );
      } else if (history.invoices || history.receipts) {
        allInvoices = Array.isArray(history.invoices) ? history.invoices : [];
        allReceipts = Array.isArray(history.receipts) ? history.receipts : [];
      }

      // Sort by date (newest first)
      const sortByDate = (a: Invoice, b: Invoice) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      };

      setInvoices(allInvoices.sort(sortByDate));
      setReceipts(allReceipts.sort(sortByDate));
    } catch (error) {
      console.error('[Profile] Failed to load history:', error);
      setInvoices([]);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!user) {
    return null;
  }

  // Group invoices by source
  const groupedInvoices = invoices.reduce((acc, invoice) => {
    const source = invoice.source || 'Other';
    if (!acc[source]) {
      acc[source] = [];
    }
    acc[source].push(invoice);
    return acc;
  }, {} as Record<string, Invoice[]>);

  // Flatten and sort grouped invoices
  const sortedInvoices = Object.values(groupedInvoices)
    .flat()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={24} className="text-gray-700" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut size={20} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Customer Info Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {user.name || user.email}
              </h2>
              <p className="text-gray-600">{user.email}</p>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-3 rounded-lg">
              <DollarSign size={24} className="text-gray-700" />
              <div>
                <p className="text-xs text-gray-500">Balance</p>
                <p className="text-xl font-bold text-gray-900">
                  ₪{(user.balance || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`flex-1 px-6 py-4 text-center font-semibold transition-colors ${
                activeTab === 'invoices'
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              My Invoices
            </button>
            <button
              onClick={() => setActiveTab('receipts')}
              className={`flex-1 px-6 py-4 text-center font-semibold transition-colors ${
                activeTab === 'receipts'
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Receipts
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Loading...</p>
              </div>
            ) : activeTab === 'invoices' ? (
              <div>
                {sortedInvoices.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No invoices found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sortedInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              Invoice #{invoice.id}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {new Date(invoice.date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">
                              ₪{invoice.amount?.toFixed(2) || '0.00'}
                            </p>
                            {invoice.source && (
                              <span className="inline-block mt-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                                {invoice.source}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {receipts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No receipts found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {receipts.map((receipt) => (
                      <div
                        key={receipt.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              Receipt #{receipt.id}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {new Date(receipt.date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">
                              ₪{receipt.amount?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

