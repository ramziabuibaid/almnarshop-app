'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useShop } from '@/context/ShopContext';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  Users, 
  Store,
  LogOut,
  Menu,
  X,
  ClipboardList,
  CreditCard,
  FileText,
  Wrench,
  Wallet,
  Shield,
  Tag,
  Bell,
  Megaphone
} from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import { useState } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
}

const sidebarLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/notifications', label: 'الإشعارات', icon: Bell, permission: 'dashboardAndNotifications' },
  { href: '/admin/products', label: 'المنتجات', icon: Package },
  { href: '/admin/marketing/campaigns', label: 'العروض الترويجية', icon: Megaphone },
  { href: '/admin/labels', label: 'طباعة الملصقات', icon: Tag },
  { href: '/admin/pos', label: 'نقطة البيع (POS)', icon: CreditCard },
  { href: '/admin/invoices', label: 'الفواتير النقدية', icon: FileText },
  { href: '/admin/quotations', label: 'العروض السعرية', icon: FileText },
  { href: '/admin/orders', label: 'طلبيات اون لاين', icon: ShoppingBag },
  { href: '/admin/shop-sales', label: 'فواتير مبيعات المحل', icon: FileText },
  { href: '/admin/warehouse-sales', label: 'فواتير مبيعات المخزن', icon: FileText },
  { href: '/admin/shop-finance/cash-box', label: 'صندوق المحل', icon: Wallet },
  { href: '/admin/warehouse-finance/cash-box', label: 'صندوق المستودع', icon: Wallet },
  { href: '/admin/maintenance', label: 'الصيانة', icon: Wrench },
  { href: '/admin/checks', label: 'الشيكات الراجعة', icon: FileText },
  { href: '/admin/customers', label: 'الزبائن', icon: Users },
  { href: '/admin/serial-numbers', label: 'الأرقام التسلسلية', icon: Package },
  { href: '/admin/tasks', label: 'المهام والمتابعات', icon: ClipboardList },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { logout } = useShop();
  const { admin, loading: adminLoading, logoutAdmin } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!admin && !adminLoading) {
      router.push('/admin/login');
    }
  }, [admin, adminLoading, router]);

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-700">Checking admin session...</div>
      </div>
    );
  }

  if (!admin) return null;

  const handleLogout = async () => {
    await logoutAdmin();
    logout();
    router.push('/admin/login');
  };

  const handleGoToShop = () => {
    router.push('/');
  };

  // Swipe gesture handlers for mobile
  const minSwipeDistance = 50;
  const edgeThreshold = 30; // Distance from edge to trigger swipe

  const onTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    // In RTL mode, sidebar is on the right side (visually on the left)
    // Swipe from right edge to left (opening sidebar)
    // clientX: 0 is left edge, window.innerWidth is right edge
    // So right edge = high clientX value
    if (isLeftSwipe && !sidebarOpen) {
      // Check if swipe started from the right edge (where sidebar is)
      if (touchStartX.current > window.innerWidth - edgeThreshold) {
        setSidebarOpen(true);
      }
    }
    
    // Swipe from left to right (closing sidebar) - swipe anywhere on the sidebar
    if (isRightSwipe && sidebarOpen) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-full w-64 bg-gray-900 text-white z-[70] transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        } md:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 hover:bg-gray-800 rounded"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden" dir="rtl">
            {sidebarLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
              
              // Check permissions for specific links
              if (link.href === '/admin/notifications') {
                const canViewNotifications = admin.is_super_admin || 
                  admin.permissions?.viewNotifications === true || 
                  admin.permissions?.dashboardAndNotifications === true;
                if (!canViewNotifications) {
                  return null; // Hide the link if user doesn't have permission
                }
              }
              
              if (link.href === '/admin/tasks') {
                const canViewTasks = admin.is_super_admin || admin.permissions?.viewTasks === true;
                if (!canViewTasks) {
                  return null; // Hide the link if user doesn't have permission
                }
              }
              
              if (link.href === '/admin/invoices') {
                const canViewCashInvoices = admin.is_super_admin || admin.permissions?.viewCashInvoices === true;
                if (!canViewCashInvoices) {
                  return null;
                }
              }
              
              if (link.href === '/admin/pos') {
                const canCreatePOS = admin.is_super_admin || admin.permissions?.createPOS === true;
                if (!canCreatePOS) {
                  return null;
                }
              }
              
              if (link.href === '/admin/receipts') {
                const canAccessReceipts = admin.is_super_admin || admin.permissions?.accessReceipts === true;
                if (!canAccessReceipts) {
                  return null;
                }
              }
              
              if (link.href === '/admin/payments') {
                const canAccessPayPage = admin.is_super_admin || admin.permissions?.accessPayPage === true;
                if (!canAccessPayPage) {
                  return null;
                }
              }
              
              if (link.href === '/admin/shop-sales') {
                const canAccessShopInvoices = admin.is_super_admin || admin.permissions?.accessShopInvoices === true;
                if (!canAccessShopInvoices) {
                  return null;
                }
              }
              
              if (link.href === '/admin/warehouse-sales') {
                const canAccessWarehouseInvoices = admin.is_super_admin || admin.permissions?.accessWarehouseInvoices === true;
                if (!canAccessWarehouseInvoices) {
                  return null;
                }
              }
              
              if (link.href === '/admin/checks') {
                const canAccessChecks = admin.is_super_admin || admin.permissions?.accessChecks === true;
                if (!canAccessChecks) {
                  return null;
                }
              }
              
              if (link.href === '/admin/quotations') {
                const canAccessQuotations = admin.is_super_admin || admin.permissions?.accessQuotations === true;
                if (!canAccessQuotations) {
                  return null;
                }
              }
              
              if (link.href === '/admin/shop-finance/cash-box') {
                const canAccessShopCashBox = admin.is_super_admin || admin.permissions?.accessShopCashBox === true;
                if (!canAccessShopCashBox) {
                  return null;
                }
              }
              
              if (link.href === '/admin/warehouse-finance/cash-box') {
                const canAccessWarehouseCashBox = admin.is_super_admin || admin.permissions?.accessWarehouseCashBox === true;
                if (!canAccessWarehouseCashBox) {
                  return null;
                }
              }
              
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    // Allow default behavior (open in new tab) if Ctrl/Command is pressed
                    if (e.ctrlKey || e.metaKey) {
                      return; // Let browser handle it
                    }
                    // Otherwise, prevent default and use router for SPA navigation
                    e.preventDefault();
                    router.push(link.href);
                    setSidebarOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{link.label}</span>
                </a>
              );
            })}
            {admin.is_super_admin && (
              <a
                href="/admin/admin-users"
                onClick={(e) => {
                  // Allow default behavior (open in new tab) if Ctrl/Command is pressed
                  if (e.ctrlKey || e.metaKey) {
                    return; // Let browser handle it
                  }
                  // Otherwise, prevent default and use router for SPA navigation
                  e.preventDefault();
                  router.push('/admin/admin-users');
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  pathname === '/admin/admin-users'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Shield size={20} />
                <span className="font-medium">Admin Users</span>
              </a>
            )}

            {/* Go to Shop Link */}
            <button
              onClick={handleGoToShop}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <Store size={20} />
              <span className="font-medium">الذهاب الى المتجر</span>
            </button>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-800">
            <div className="mb-4 px-4 py-2 text-sm text-gray-400">
              <p className="font-medium text-white">{admin.username}</p>
              <p className="text-xs mt-1">{admin.is_super_admin ? 'Super Admin' : 'Admin'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div 
        className="md:mr-64"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm" dir="rtl">
          <div className="px-4 py-3 flex items-center justify-between">
            {/* Right side (visually left in RTL): Notifications and Menu button on Mobile, Notifications on Desktop */}
            <div className="flex items-center gap-2">
              {/* Mobile: Notifications and Menu */}
              <div className="flex items-center gap-2 md:hidden">
                <NotificationCenter />
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Menu size={24} className="text-gray-700" />
                </button>
              </div>
              
              {/* Desktop: Notifications */}
              <div className="hidden md:flex items-center gap-2">
                <NotificationCenter />
              </div>
            </div>
            
            {/* Desktop: Admin name in center */}
            <div className="hidden md:flex items-center gap-3 flex-1">
              <span className="text-sm text-gray-600">
                {admin.username}
              </span>
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                {admin.is_super_admin ? 'Super Admin' : 'Admin'}
              </span>
            </div>
            
            <div className="flex-1 md:hidden" />
            
            {/* Left side (visually right in RTL): Admin Name on Mobile */}
            <div className="flex items-center gap-3 md:hidden">
              <span className="text-sm font-medium text-gray-900">
                {admin.username}
              </span>
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                {admin.is_super_admin ? 'Super Admin' : 'Admin'}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 md:p-6" dir="rtl">{children}</main>
      </div>
    </div>
  );
}

