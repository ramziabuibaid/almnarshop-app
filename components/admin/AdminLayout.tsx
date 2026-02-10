'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
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
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  Wrench,
  Wallet,
  Shield,
  Tag,
  Megaphone
} from 'lucide-react';
import NotificationCenter from './NotificationCenter';

interface AdminLayoutProps {
  children: ReactNode;
}

/** Sidebar accent: thin border + subtle active bg for compact professional look */
const ACCENT_STYLES: Record<string, { border: string; borderMuted: string; activeBg: string }> = {
  slate:   { border: 'border-s-slate-400',   borderMuted: 'border-s-slate-600/40',   activeBg: 'bg-slate-500/10' },
  indigo:  { border: 'border-s-indigo-400',  borderMuted: 'border-s-indigo-600/40',  activeBg: 'bg-indigo-500/10' },
  violet:  { border: 'border-s-violet-400',  borderMuted: 'border-s-violet-600/40',  activeBg: 'bg-violet-500/10' },
  emerald: { border: 'border-s-emerald-500', borderMuted: 'border-s-emerald-600/40', activeBg: 'bg-emerald-500/10' },
  teal:    { border: 'border-s-teal-400',    borderMuted: 'border-s-teal-600/40',    activeBg: 'bg-teal-500/10' },
  cyan:    { border: 'border-s-cyan-400',    borderMuted: 'border-s-cyan-600/40',    activeBg: 'bg-cyan-500/10' },
  blue:    { border: 'border-s-blue-400',    borderMuted: 'border-s-blue-600/40',    activeBg: 'bg-blue-500/10' },
  amber:   { border: 'border-s-amber-400',   borderMuted: 'border-s-amber-600/40',   activeBg: 'bg-amber-500/10' },
  rose:    { border: 'border-s-rose-400',    borderMuted: 'border-s-rose-600/40',    activeBg: 'bg-rose-500/10' },
  green:   { border: 'border-s-green-500',   borderMuted: 'border-s-green-600/40',   activeBg: 'bg-green-500/10' },
  orange:  { border: 'border-s-orange-400',  borderMuted: 'border-s-orange-600/40',  activeBg: 'bg-orange-500/10' },
  fuchsia: { border: 'border-s-fuchsia-400', borderMuted: 'border-s-fuchsia-600/40', activeBg: 'bg-fuchsia-500/10' },
  sky:     { border: 'border-s-sky-400',     borderMuted: 'border-s-sky-600/40',     activeBg: 'bg-sky-500/10' },
  neutral: { border: 'border-s-gray-400',    borderMuted: 'border-s-gray-600/40',    activeBg: 'bg-gray-500/10' },
  red:     { border: 'border-s-red-400',     borderMuted: 'border-s-red-600/40',     activeBg: 'bg-red-500/10' },
};

/** Submenu shown on hover under "المنتجات" */
const productsSubmenu = [
  { href: '/admin/marketing/campaigns', label: 'العروض الترويجية', icon: Megaphone },
  { href: '/admin/labels', label: 'طباعة الملصقات', icon: Tag },
  { href: '/admin/serial-numbers', label: 'الأرقام التسلسلية', icon: Package },
];

/** Submenu under "نقطة البيع" - items may require permission */
const posSubmenu = [
  { href: '/admin/invoices', label: 'قائمة الفواتير النقدية', icon: FileText, permission: 'viewCashInvoices' as const },
];

/** Submenu under "الفواتير": فواتير المحل، فواتير المخزن، عرض سعر، طلبيات اون لاين */
const invoicesSubmenu = [
  { href: '/admin/shop-sales', label: 'فواتير المحل', icon: FileText, permission: 'accessShopInvoices' as const },
  { href: '/admin/warehouse-sales', label: 'فواتير المخزن', icon: FileText, permission: 'accessWarehouseInvoices' as const },
  { href: '/admin/quotations', label: 'عرض سعر', icon: FileText, permission: 'accessQuotations' as const },
  { href: '/admin/orders', label: 'طلبيات اون لاين', icon: ShoppingBag },
];

/** Submenu under "الزبائن": المهام والمتابعات، الشيكات الراجعة */
const customersSubmenu = [
  { href: '/admin/tasks', label: 'المهام والمتابعات', icon: ClipboardList, permission: 'viewTasks' as const },
  { href: '/admin/checks', label: 'الشيكات الراجعة', icon: FileText, permission: 'accessChecks' as const },
];

const sidebarLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, accent: 'indigo' as const },
  { href: '/admin/products', label: 'المنتجات', icon: Package, accent: 'emerald' as const, hasSubmenu: true as const },
  { href: '/admin/pos', label: 'نقطة البيع (POS)', icon: CreditCard, accent: 'green' as const, hasSubmenu: true as const },
  { href: '/admin/shop-sales', label: 'الفواتير', icon: FileText, accent: 'blue' as const, hasSubmenu: true as const },
  { href: '/admin/shop-finance/cash-box', label: 'صندوق المحل', icon: Wallet, accent: 'green' as const },
  { href: '/admin/warehouse-finance/cash-box', label: 'صندوق المستودع', icon: Wallet, accent: 'teal' as const },
  { href: '/admin/maintenance', label: 'الصيانة', icon: Wrench, accent: 'amber' as const },
  { href: '/admin/customers', label: 'الزبائن', icon: Users, accent: 'indigo' as const, hasSubmenu: true as const },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { logout } = useShop();
  const { admin, loading: adminLoading, logoutAdmin } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [productsSubmenuOpen, setProductsSubmenuOpen] = useState(false);
  const productsSubmenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [posSubmenuOpen, setPosSubmenuOpen] = useState(false);
  const posSubmenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [invoicesSubmenuOpen, setInvoicesSubmenuOpen] = useState(false);
  const invoicesSubmenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [customersSubmenuOpen, setCustomersSubmenuOpen] = useState(false);
  const customersSubmenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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
          className={`fixed inset-0 bg-black/50 z-[60] ${pathname === '/admin/pos' ? 'lg:block' : 'md:hidden'}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — compact, professional */}
      <aside
        className={`fixed top-0 right-0 h-full w-52 bg-gray-800 text-white z-[70] transform transition-transform duration-300 shadow-xl border-l border-gray-700/50 ${
          pathname === '/admin/pos' 
            ? (sidebarOpen ? 'translate-x-0' : 'translate-x-full')
            : (sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0')
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header — compact */}
          <div className="px-3 py-2.5 border-b border-gray-700/80 flex items-center justify-between shrink-0">
            <h1 className="text-sm font-semibold tracking-tight text-gray-100">Admin</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className={`p-1.5 hover:bg-gray-700/80 rounded-md text-gray-400 hover:text-white transition-colors ${pathname === '/admin/pos' ? 'lg:block' : 'md:hidden'}`}
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation — tight spacing, small text for quick scan */}
          <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto overflow-x-hidden flex flex-col" dir="rtl">
            <div className="flex-1">
              {sidebarLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
                const isProductsWithSubmenu = 'hasSubmenu' in link && link.hasSubmenu && link.href === '/admin/products';
                const isPosWithSubmenu = 'hasSubmenu' in link && link.hasSubmenu && link.href === '/admin/pos';
                const isInvoicesWithSubmenu = 'hasSubmenu' in link && link.hasSubmenu && link.href === '/admin/shop-sales';
                const isCustomersWithSubmenu = 'hasSubmenu' in link && link.hasSubmenu && link.href === '/admin/customers';

                // صلاحيات الروابط الرئيسية (نفس السلوك قبل دمج القوائم المنسدلة)
                // POS: createPOS | صندوق المحل: accessShopCashBox | صندوق المستودع: accessWarehouseCashBox
                // الفواتير: يظهر إذا كان لديه وصول لواحد على الأقل من (فواتير المحل/المخزن/عرض سعر/طلبيات)
                // الزبائن: يظهر للجميع؛ العناصر الفرعية (المهام، الشيكات) تُصفّى حسب viewTasks و accessChecks
                // المنتجات: يظهر للجميع؛ لا صلاحيات للعناصر الفرعية (عروض ترويجية، ملصقات، أرقام تسلسلية)
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
                
                const styles = ACCENT_STYLES[link.accent] ?? ACCENT_STYLES.neutral;
                const borderClass = isActive ? styles.border : styles.borderMuted;

                // Products: main button opens /admin/products, hover shows العروض الترويجية + طباعة الملصقات
                if (isProductsWithSubmenu) {
                  const submenuActive = pathname?.startsWith('/admin/marketing') || pathname?.startsWith('/admin/labels') || pathname?.startsWith('/admin/serial-numbers');
                  return (
                    <div
                      key={link.href}
                      className="relative"
                      onMouseEnter={() => {
                        if (productsSubmenuTimeout.current) {
                          clearTimeout(productsSubmenuTimeout.current);
                          productsSubmenuTimeout.current = null;
                        }
                        productsSubmenuTimeout.current = setTimeout(() => setProductsSubmenuOpen(true), 150);
                      }}
                      onMouseLeave={() => {
                        if (productsSubmenuTimeout.current) {
                          clearTimeout(productsSubmenuTimeout.current);
                          productsSubmenuTimeout.current = null;
                        }
                        productsSubmenuTimeout.current = setTimeout(() => setProductsSubmenuOpen(false), 120);
                      }}
                    >
                      <a
                        href={link.href}
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey) return;
                          e.preventDefault();
                          router.push(link.href);
                          setSidebarOpen(false);
                        }}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors border-s-2 text-sm ${borderClass} ${
                          isActive || submenuActive
                            ? `${styles.activeBg} text-white font-medium`
                            : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
                        }`}
                      >
                        <Icon size={18} className="shrink-0" />
                        <span className="font-cairo truncate">{link.label}</span>
                      </a>
                      {productsSubmenuOpen && (
                        <div className="absolute top-full right-0 mt-0.5 w-full min-w-[11rem] py-0.5 bg-gray-700/95 rounded-md shadow-xl border border-gray-600/80 z-20">
                          {productsSubmenu.map((sub) => {
                            const SubIcon = sub.icon;
                            const subActive = pathname === sub.href || pathname?.startsWith(sub.href + '/');
                            return (
                              <a
                                key={sub.href}
                                href={sub.href}
                                onClick={(e) => {
                                  if (e.ctrlKey || e.metaKey) return;
                                  e.preventDefault();
                                  router.push(sub.href);
                                  setSidebarOpen(false);
                                  setProductsSubmenuOpen(false);
                                }}
                                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded transition-colors ${
                                  subActive ? 'bg-gray-600 text-white' : 'text-gray-300 hover:bg-gray-600/80 hover:text-white'
                                }`}
                              >
                                <SubIcon size={14} className="shrink-0" />
                                <span className="font-cairo truncate">{sub.label}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                      {/* على الجوال: سهم لفتح القائمة الفرعية */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setProductsSubmenuOpen((v) => !v);
                        }}
                        className="md:hidden absolute left-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-white"
                        aria-label="فتح قائمة المنتجات"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${productsSubmenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  );
                }

                // نقطة البيع: الزر الرئيسي يفتح POS، وعند التمرير تظهر "قائمة الفواتير النقدية"
                if (isPosWithSubmenu) {
                  const canViewCashInvoices = admin.is_super_admin || admin.permissions?.viewCashInvoices === true;
                  const filteredPosSubmenu = posSubmenu.filter((s) => (s.permission ? (s.permission === 'viewCashInvoices' && canViewCashInvoices) : true));
                  const submenuActive = pathname?.startsWith('/admin/invoices');
                  return (
                    <div
                      key={link.href}
                      className="relative"
                      onMouseEnter={() => {
                        if (posSubmenuTimeout.current) {
                          clearTimeout(posSubmenuTimeout.current);
                          posSubmenuTimeout.current = null;
                        }
                        posSubmenuTimeout.current = setTimeout(() => setPosSubmenuOpen(true), 150);
                      }}
                      onMouseLeave={() => {
                        if (posSubmenuTimeout.current) {
                          clearTimeout(posSubmenuTimeout.current);
                          posSubmenuTimeout.current = null;
                        }
                        posSubmenuTimeout.current = setTimeout(() => setPosSubmenuOpen(false), 120);
                      }}
                    >
                      <a
                        href={link.href}
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey) return;
                          e.preventDefault();
                          router.push(link.href);
                          setSidebarOpen(false);
                        }}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors border-s-2 text-sm ${borderClass} ${
                          isActive || submenuActive
                            ? `${styles.activeBg} text-white font-medium`
                            : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
                        }`}
                      >
                        <Icon size={18} className="shrink-0" />
                        <span className="font-cairo truncate">{link.label}</span>
                      </a>
                      {posSubmenuOpen && filteredPosSubmenu.length > 0 && (
                        <div className="absolute top-full right-0 mt-0.5 w-full min-w-[11rem] py-0.5 bg-gray-700/95 rounded-md shadow-xl border border-gray-600/80 z-20">
                          {filteredPosSubmenu.map((sub) => {
                            const SubIcon = sub.icon;
                            const subActive = pathname === sub.href || pathname?.startsWith(sub.href + '/');
                            return (
                              <a
                                key={sub.href}
                                href={sub.href}
                                onClick={(e) => {
                                  if (e.ctrlKey || e.metaKey) return;
                                  e.preventDefault();
                                  router.push(sub.href);
                                  setSidebarOpen(false);
                                  setPosSubmenuOpen(false);
                                }}
                                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded transition-colors ${
                                  subActive ? 'bg-gray-600 text-white' : 'text-gray-300 hover:bg-gray-600/80 hover:text-white'
                                }`}
                              >
                                <SubIcon size={14} className="shrink-0" />
                                <span className="font-cairo truncate">{sub.label}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                      {filteredPosSubmenu.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPosSubmenuOpen((v) => !v);
                          }}
                          className="md:hidden absolute left-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-white"
                          aria-label="فتح قائمة نقطة البيع"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${posSubmenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                  );
                }

                // الفواتير: قائمة رئيسية تنبثق منها فواتير المحل، فواتير المخزن، عرض سعر، طلبيات اون لاين
                if (isInvoicesWithSubmenu) {
                  const hasPerm = (p: string) => admin.is_super_admin || (admin.permissions as Record<string, boolean>)?.[p] === true;
                  const filteredInvoicesSubmenu = invoicesSubmenu.filter((s) => !('permission' in s && s.permission) || hasPerm(s.permission));
                  if (filteredInvoicesSubmenu.length === 0) return null;
                  const invoicesSubmenuActive = pathname?.startsWith('/admin/shop-sales') || pathname?.startsWith('/admin/warehouse-sales') || pathname?.startsWith('/admin/quotations') || pathname?.startsWith('/admin/orders');
                  return (
                    <div
                      key={link.href}
                      className="relative"
                      onMouseEnter={() => {
                        if (invoicesSubmenuTimeout.current) {
                          clearTimeout(invoicesSubmenuTimeout.current);
                          invoicesSubmenuTimeout.current = null;
                        }
                        invoicesSubmenuTimeout.current = setTimeout(() => setInvoicesSubmenuOpen(true), 150);
                      }}
                      onMouseLeave={() => {
                        if (invoicesSubmenuTimeout.current) {
                          clearTimeout(invoicesSubmenuTimeout.current);
                          invoicesSubmenuTimeout.current = null;
                        }
                        invoicesSubmenuTimeout.current = setTimeout(() => setInvoicesSubmenuOpen(false), 120);
                      }}
                    >
                      <a
                        href={link.href}
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey) return;
                          e.preventDefault();
                          router.push(link.href);
                          setSidebarOpen(false);
                        }}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors border-s-2 text-sm ${borderClass} ${
                          isActive || invoicesSubmenuActive
                            ? `${styles.activeBg} text-white font-medium`
                            : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
                        }`}
                      >
                        <Icon size={18} className="shrink-0" />
                        <span className="font-cairo truncate">{link.label}</span>
                      </a>
                      {invoicesSubmenuOpen && (
                        <div className="absolute top-full right-0 mt-0.5 w-full min-w-[11rem] py-0.5 bg-gray-700/95 rounded-md shadow-xl border border-gray-600/80 z-20">
                          {filteredInvoicesSubmenu.map((sub) => {
                            const SubIcon = sub.icon;
                            const subActive = pathname === sub.href || pathname?.startsWith(sub.href + '/');
                            return (
                              <a
                                key={sub.href}
                                href={sub.href}
                                onClick={(e) => {
                                  if (e.ctrlKey || e.metaKey) return;
                                  e.preventDefault();
                                  router.push(sub.href);
                                  setSidebarOpen(false);
                                  setInvoicesSubmenuOpen(false);
                                }}
                                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded transition-colors ${
                                  subActive ? 'bg-gray-600 text-white' : 'text-gray-300 hover:bg-gray-600/80 hover:text-white'
                                }`}
                              >
                                <SubIcon size={14} className="shrink-0" />
                                <span className="font-cairo truncate">{sub.label}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setInvoicesSubmenuOpen((v) => !v);
                        }}
                        className="md:hidden absolute left-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-white"
                        aria-label="فتح قائمة الفواتير"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${invoicesSubmenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  );
                }

                // الزبائن: قائمة رئيسية تنبثق منها المهام والمتابعات، الشيكات الراجعة
                if (isCustomersWithSubmenu) {
                  const hasPerm = (p: string) => admin.is_super_admin || (admin.permissions as Record<string, boolean>)?.[p] === true;
                  const filteredCustomersSubmenu = customersSubmenu.filter((s) => !('permission' in s && s.permission) || hasPerm(s.permission));
                  const customersSubmenuActive = pathname?.startsWith('/admin/tasks') || pathname?.startsWith('/admin/checks');
                  return (
                    <div
                      key={link.href}
                      className="relative"
                      onMouseEnter={() => {
                        if (customersSubmenuTimeout.current) {
                          clearTimeout(customersSubmenuTimeout.current);
                          customersSubmenuTimeout.current = null;
                        }
                        customersSubmenuTimeout.current = setTimeout(() => setCustomersSubmenuOpen(true), 150);
                      }}
                      onMouseLeave={() => {
                        if (customersSubmenuTimeout.current) {
                          clearTimeout(customersSubmenuTimeout.current);
                          customersSubmenuTimeout.current = null;
                        }
                        customersSubmenuTimeout.current = setTimeout(() => setCustomersSubmenuOpen(false), 120);
                      }}
                    >
                      <a
                        href={link.href}
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey) return;
                          e.preventDefault();
                          router.push(link.href);
                          setSidebarOpen(false);
                        }}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors border-s-2 text-sm ${borderClass} ${
                          isActive || customersSubmenuActive
                            ? `${styles.activeBg} text-white font-medium`
                            : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
                        }`}
                      >
                        <Icon size={18} className="shrink-0" />
                        <span className="font-cairo truncate">{link.label}</span>
                      </a>
                      {customersSubmenuOpen && filteredCustomersSubmenu.length > 0 && (
                        <div className="absolute top-full right-0 mt-0.5 w-full min-w-[11rem] py-0.5 bg-gray-700/95 rounded-md shadow-xl border border-gray-600/80 z-20">
                          {filteredCustomersSubmenu.map((sub) => {
                            const SubIcon = sub.icon;
                            const subActive = pathname === sub.href || pathname?.startsWith(sub.href + '/');
                            return (
                              <a
                                key={sub.href}
                                href={sub.href}
                                onClick={(e) => {
                                  if (e.ctrlKey || e.metaKey) return;
                                  e.preventDefault();
                                  router.push(sub.href);
                                  setSidebarOpen(false);
                                  setCustomersSubmenuOpen(false);
                                }}
                                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded transition-colors ${
                                  subActive ? 'bg-gray-600 text-white' : 'text-gray-300 hover:bg-gray-600/80 hover:text-white'
                                }`}
                              >
                                <SubIcon size={14} className="shrink-0" />
                                <span className="font-cairo truncate">{sub.label}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                      {filteredCustomersSubmenu.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCustomersSubmenuOpen((v) => !v);
                          }}
                          className="md:hidden absolute left-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-white"
                          aria-label="فتح قائمة الزبائن"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${customersSubmenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey) return;
                      e.preventDefault();
                      router.push(link.href);
                      setSidebarOpen(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors border-s-2 text-sm ${borderClass} ${
                      isActive
                        ? `${styles.activeBg} text-white font-medium`
                        : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="font-cairo truncate">{link.label}</span>
                  </a>
                );
              })}
              {admin.is_super_admin && (() => {
                const styles = ACCENT_STYLES.amber;
                const isActive = pathname === '/admin/admin-users';
                const borderClass = isActive ? styles.border : styles.borderMuted;
                return (
                  <a
                    href="/admin/admin-users"
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey) return;
                      e.preventDefault();
                      router.push('/admin/admin-users');
                      setSidebarOpen(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors border-s-2 text-sm ${borderClass} ${
                      isActive ? `${styles.activeBg} text-white font-medium` : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
                    }`}
                  >
                    <Shield size={18} className="shrink-0" />
                    <span className="font-cairo truncate">Admin Users</span>
                  </a>
                );
              })()}
            </div>

            {/* Footer: الذهاب الى المتجر + Logout — مفصولان عن القائمة */}
            <div className="mt-auto pt-2.5 border-t border-gray-700/80 space-y-0.5">
              {/* زر حقيقي: ضغطة عادية = نفس التاب، Ctrl/Cmd+ضغطة = تاب جديد */}
              {(() => {
                const styles = ACCENT_STYLES.neutral;
                return (
                  <a
                    href="/"
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        window.open('/', '_blank', 'noopener,noreferrer');
                        setSidebarOpen(false);
                        return;
                      }
                      e.preventDefault();
                      router.push('/');
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors border-s-2 text-sm ${styles.borderMuted} text-gray-300 hover:bg-gray-700/60 hover:text-white text-right`}
                  >
                    <Store size={18} className="shrink-0" />
                    <span className="font-cairo truncate">الذهاب الى المتجر</span>
                  </a>
                );
              })()}
              {(() => {
                const styles = ACCENT_STYLES.red;
                return (
                  <button
                    onClick={handleLogout}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors border-s-2 text-sm ${styles.borderMuted} text-gray-300 hover:bg-gray-700/60 hover:text-white text-right`}
                  >
                    <LogOut size={18} className="shrink-0" />
                    <span className="font-cairo truncate">Logout</span>
                  </button>
                );
              })()}
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div 
        className={pathname === '/admin/pos' ? '' : 'md:mr-52'}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Top Bar */}
        <header className={`sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm ${pathname === '/admin/pos' ? '' : ''}`} dir="rtl">
          <div className="px-4 py-3 flex items-center justify-between">
            {/* Right side (visually left in RTL): Notifications and Menu button on Mobile, Notifications on Desktop */}
            <div className="flex items-center gap-3">
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
              
              {/* Desktop: Notifications and Menu (for POS page) */}
              {pathname === '/admin/pos' ? (
                <div className="hidden lg:flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700 font-cairo">نظام نقطة البيع POS</span>
                  <NotificationCenter />
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Menu size={24} className="text-gray-700" />
                  </button>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <NotificationCenter />
                </div>
              )}
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
        <main className={pathname === '/admin/pos' ? 'p-0' : 'p-4 md:p-6'} dir="rtl">{children}</main>
      </div>
    </div>
  );
}

