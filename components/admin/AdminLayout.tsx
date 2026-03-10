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
  Megaphone,
  Settings
} from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import { ThemeToggle } from './ThemeToggle';

interface AdminLayoutProps {
  children: ReactNode;
  headerAction?: ReactNode;
}

/** Sidebar accent: thin border + subtle active bg for compact professional look */
/** Light/Dark sidebar — active: blue bg, hover: subtle gray */
const ACCENT_STYLES: Record<string, { border: string; borderMuted: string; activeBg: string; activeText?: string }> = {
  slate: { border: 'border-s-slate-500', borderMuted: 'border-s-transparent', activeBg: 'bg-slate-100 dark:bg-slate-800' },
  indigo: { border: 'border-s-indigo-500', borderMuted: 'border-s-transparent', activeBg: 'bg-indigo-50 dark:bg-indigo-900/40', activeText: 'text-indigo-700 dark:text-indigo-300' },
  violet: { border: 'border-s-violet-500', borderMuted: 'border-s-transparent', activeBg: 'bg-violet-50 dark:bg-violet-900/40' },
  emerald: { border: 'border-s-emerald-500', borderMuted: 'border-s-transparent', activeBg: 'bg-emerald-50 dark:bg-emerald-900/40' },
  teal: { border: 'border-s-teal-500', borderMuted: 'border-s-transparent', activeBg: 'bg-teal-50 dark:bg-teal-900/40' },
  cyan: { border: 'border-s-cyan-500', borderMuted: 'border-s-transparent', activeBg: 'bg-cyan-50 dark:bg-cyan-900/40' },
  blue: { border: 'border-s-blue-500', borderMuted: 'border-s-transparent', activeBg: 'bg-blue-50 dark:bg-blue-900/40', activeText: 'text-blue-700 dark:text-blue-300' },
  amber: { border: 'border-s-amber-500', borderMuted: 'border-s-transparent', activeBg: 'bg-amber-50 dark:bg-amber-900/40' },
  rose: { border: 'border-s-rose-500', borderMuted: 'border-s-transparent', activeBg: 'bg-rose-50 dark:bg-rose-900/40' },
  green: { border: 'border-s-green-500', borderMuted: 'border-s-transparent', activeBg: 'bg-green-50 dark:bg-green-900/40' },
  orange: { border: 'border-s-orange-500', borderMuted: 'border-s-transparent', activeBg: 'bg-orange-50 dark:bg-orange-900/40' },
  fuchsia: { border: 'border-s-fuchsia-500', borderMuted: 'border-s-transparent', activeBg: 'bg-fuchsia-50 dark:bg-fuchsia-900/40' },
  sky: { border: 'border-s-sky-500', borderMuted: 'border-s-transparent', activeBg: 'bg-sky-50 dark:bg-sky-900/40' },
  neutral: { border: 'border-s-gray-500 dark:border-s-slate-400', borderMuted: 'border-s-transparent', activeBg: 'bg-gray-100 dark:bg-slate-800' },
  red: { border: 'border-s-red-500', borderMuted: 'border-s-transparent', activeBg: 'bg-red-50 dark:bg-red-900/40' },
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

const invoicesSubmenu = [
  { href: '/admin/shop-sales', label: 'فواتير المحل', icon: FileText, permission: 'accessShopInvoices' as const },
  { href: '/admin/warehouse-sales', label: 'فواتير المخزن', icon: FileText, permission: 'accessWarehouseInvoices' as const },
  { href: '/admin/quotations', label: 'عرض سعر', icon: FileText, permission: 'accessQuotations' as const },
  { href: '/admin/groom-offers', label: 'عروض العرسان', icon: FileText, permission: 'accessQuotations' as const },
  { href: '/admin/orders', label: 'طلبيات اون لاين', icon: ShoppingBag },
];

/** Submenu under "الزبائن": المهام والمتابعات، الشيكات الراجعة، الكمبيالات، الملفات القضائية */
const customersSubmenu = [
  { href: '/admin/tasks', label: 'المهام والمتابعات', icon: ClipboardList, permission: 'viewTasks' as const },
  { href: '/admin/checks', label: 'الشيكات الراجعة', icon: FileText, permission: 'accessChecks' as const },
  { href: '/admin/promissory-notes', label: 'الكمبيالات', icon: FileText, permission: 'accessPromissoryNotes' as const },
  { href: '/admin/legal-cases', label: 'الملفات القضائية', icon: FileText, permission: 'accessLegalCases' as const },
];

const sidebarLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, accent: 'indigo' as const, section: 'main' as const },
  { href: '/admin/products', label: 'المنتجات', icon: Package, accent: 'emerald' as const, hasSubmenu: true as const, section: 'ops' as const },
  { href: '/admin/pos', label: 'نقطة البيع (POS)', icon: CreditCard, accent: 'green' as const, hasSubmenu: true as const, section: 'ops' as const },
  { href: '/admin/shop-sales', label: 'الفواتير', icon: FileText, accent: 'blue' as const, hasSubmenu: true as const, section: 'ops' as const },
  { href: '/admin/shop-finance/cash-box', label: 'صندوق المحل', icon: Wallet, accent: 'green' as const, section: 'finance' as const },
  { href: '/admin/warehouse-finance/cash-box', label: 'صندوق المستودع', icon: Wallet, accent: 'teal' as const, section: 'finance' as const },
  { href: '/admin/maintenance', label: 'الصيانة', icon: Wrench, accent: 'amber' as const, section: 'admin' as const },
  { href: '/admin/customers', label: 'الزبائن', icon: Users, accent: 'indigo' as const, hasSubmenu: true as const, section: 'admin' as const },
  { href: '/admin/articles', label: 'المقالات', icon: FileText, accent: 'fuchsia' as const, section: 'admin' as const },
  { href: '/admin/settings', label: 'الإعدادات', icon: Settings, accent: 'neutral' as const, section: 'admin' as const },
];

const SECTION_LABELS: Record<string, string> = {
  main: 'الرئيسية',
  ops: 'المبيعات والمخزون',
  finance: 'المالية',
  admin: 'الإدارة',
};

export default function AdminLayout({ children, headerAction }: AdminLayoutProps) {
  const { logout } = useShop();
  const { admin, loading: adminLoading, logoutAdmin } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [productsSubmenuOpen, setProductsSubmenuOpen] = useState(false);
  const [posSubmenuOpen, setPosSubmenuOpen] = useState(false);
  const [invoicesSubmenuOpen, setInvoicesSubmenuOpen] = useState(false);
  const [customersSubmenuOpen, setCustomersSubmenuOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!admin && !adminLoading) {
      router.push('/admin/login');
    }
  }, [admin, adminLoading, router]);

  // Auto-expand sidebar submenus based on current path
  useEffect(() => {
    if (!pathname) return;

    if (productsSubmenu.some(item => pathname.startsWith(item.href))) {
      setProductsSubmenuOpen(true);
    }

    if (posSubmenu.some(item => pathname.startsWith(item.href))) {
      setPosSubmenuOpen(true);
    }

    if (invoicesSubmenu.some(item => pathname.startsWith(item.href))) {
      setInvoicesSubmenuOpen(true);
    }

    if (customersSubmenu.some(item => pathname.startsWith(item.href))) {
      setCustomersSubmenuOpen(true);
    }
  }, [pathname]);

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="text-gray-700 dark:text-gray-300">Checking admin session...</div>
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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100" dir="rtl">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className={`fixed inset-0 bg-black/50 z-[60] ${pathname === '/admin/pos' ? 'lg:hidden' : 'md:hidden'}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Floating Sidebar */}
      <aside
        className={`fixed top-4 right-4 h-[calc(100vh-2rem)] w-[260px] bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200 z-[70] transform transition-transform duration-300 shadow-xl border border-gray-200 dark:border-slate-800 rounded-2xl flex flex-col overflow-hidden ${pathname === '/admin/pos'
          ? (sidebarOpen ? 'translate-x-0' : 'translate-x-[calc(100%+2rem)] lg:translate-x-[calc(100%+2rem)]')
          : (sidebarOpen ? 'translate-x-0' : 'translate-x-[calc(100%+2rem)] md:translate-x-0')
          }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-600/20">
                <Store size={20} className="text-white" />
              </div>
              <h1 className="text-base font-bold text-slate-800 dark:text-white tracking-tight font-cairo">Almnar System</h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className={`p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors ${pathname === '/admin/pos' ? 'lg:block' : 'md:hidden'}`}
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation — section headers + links */}
          <nav className="flex-1 p-3 overflow-y-auto overflow-x-hidden flex flex-col" dir="rtl">
            <div className="flex-1 space-y-0.5">
              {sidebarLinks.map((link, idx) => {
                const Icon = link.icon;
                const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
                const showSection = link.section && (idx === 0 || sidebarLinks[idx - 1]?.section !== link.section);
                const sectionHeader = showSection && link.section ? (
                  <div className="pt-2 pb-1 first:pt-0" key={`sec-${link.section}`}>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{SECTION_LABELS[link.section]}</span>
                  </div>
                ) : null;
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

                if (link.href === '/admin/articles') {
                  const canManageArticles = admin.is_super_admin || admin.permissions?.manageArticles === true;
                  if (!canManageArticles) {
                    return null;
                  }
                }

                const styles = ACCENT_STYLES[link.accent] ?? ACCENT_STYLES.neutral;
                const borderClass = isActive ? styles.border : styles.borderMuted;

                // Products: قائمة منبثقة واضحة — سهم يدل على التبعيات، تبعيات مضمنة مع خط ربط
                if (isProductsWithSubmenu) {
                  const submenuActive = pathname?.startsWith('/admin/marketing') || pathname?.startsWith('/admin/labels') || pathname?.startsWith('/admin/serial-numbers');
                  const styles = ACCENT_STYLES[link.accent] ?? ACCENT_STYLES.neutral;
                  const borderClass = (isActive || submenuActive) ? styles.border : styles.borderMuted;
                  return (
                    <div key={link.href} className="space-y-0.5">
                      {sectionHeader}
                      <div className="flex items-center gap-0">
                        <a
                          href={link.href}
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey) return;
                            e.preventDefault();
                            router.push(link.href);
                            setSidebarOpen(false);
                          }}
                          className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border-s-2 text-sm min-w-0 ${borderClass} ${isActive || submenuActive
                            ? `${styles.activeBg} ${styles.activeText || 'text-gray-900 dark:text-gray-100'} font-medium`
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                            }`}
                        >
                          <Icon size={18} className="shrink-0" />
                          <span className="font-cairo truncate">{link.label}</span>
                        </a>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setProductsSubmenuOpen((v) => !v);
                          }}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          aria-label={productsSubmenuOpen ? 'طي التبعيات' : 'عرض التبعيات'}
                        >
                          <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${productsSubmenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {productsSubmenuOpen && (
                        <div className="border-s-2 border-gray-200 mr-3 pr-2 mt-0.5 space-y-0.5">
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
                                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md transition-colors ${subActive ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                                  }`}
                              >
                                <SubIcon size={14} className="shrink-0" />
                                <span className="font-cairo truncate">{sub.label}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // نقطة البيع: قائمة منبثقة مع سهم وتبعيات مضمنة
                if (isPosWithSubmenu) {
                  const canViewCashInvoices = admin.is_super_admin || admin.permissions?.viewCashInvoices === true;
                  const filteredPosSubmenu = posSubmenu.filter((s) => (s.permission ? (s.permission === 'viewCashInvoices' && canViewCashInvoices) : true));
                  const submenuActive = pathname?.startsWith('/admin/invoices');
                  return (
                    <div key={link.href} className="space-y-0.5">
                      {sectionHeader}
                      <div className="flex items-center gap-0">
                        <a
                          href={link.href}
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey) return;
                            e.preventDefault();
                            router.push(link.href);
                            setSidebarOpen(false);
                          }}
                          className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border-s-2 text-sm min-w-0 ${(isActive || submenuActive) ? styles.border : styles.borderMuted} ${isActive || submenuActive
                            ? `${styles.activeBg} ${styles.activeText || 'text-gray-900 dark:text-gray-100'} font-medium`
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                            }`}
                        >
                          <Icon size={18} className="shrink-0" />
                          <span className="font-cairo truncate">{link.label}</span>
                        </a>
                        {filteredPosSubmenu.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPosSubmenuOpen((v) => !v);
                            }}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            aria-label={posSubmenuOpen ? 'طي التبعيات' : 'عرض التبعيات'}
                          >
                            <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${posSubmenuOpen ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>
                      {posSubmenuOpen && filteredPosSubmenu.length > 0 && (
                        <div className="border-s-2 border-gray-200 mr-3 pr-2 mt-0.5 space-y-0.5">
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
                                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md transition-colors ${subActive ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                                  }`}
                              >
                                <SubIcon size={14} className="shrink-0" />
                                <span className="font-cairo truncate">{sub.label}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // الفواتير: قائمة منبثقة مع سهم وتبعيات مضمنة
                if (isInvoicesWithSubmenu) {
                  const hasPerm = (p: string) => admin.is_super_admin || (admin.permissions as Record<string, boolean>)?.[p] === true;
                  const filteredInvoicesSubmenu = invoicesSubmenu.filter((s) => !('permission' in s && s.permission) || hasPerm(s.permission));
                  if (filteredInvoicesSubmenu.length === 0) return null;
                  const invoicesSubmenuActive = pathname?.startsWith('/admin/shop-sales') || pathname?.startsWith('/admin/warehouse-sales') || pathname?.startsWith('/admin/quotations') || pathname?.startsWith('/admin/groom-offers') || pathname?.startsWith('/admin/orders');
                  return (
                    <div key={link.href} className="space-y-0.5">
                      {sectionHeader}
                      <div className="flex items-center gap-0">
                        <a
                          href={link.href}
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey) return;
                            e.preventDefault();
                            router.push(link.href);
                            setSidebarOpen(false);
                          }}
                          className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border-s-2 text-sm min-w-0 ${(isActive || invoicesSubmenuActive) ? styles.border : styles.borderMuted} ${isActive || invoicesSubmenuActive
                            ? `${styles.activeBg} ${styles.activeText || 'text-gray-900 dark:text-gray-100'} font-medium`
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                            }`}
                        >
                          <Icon size={18} className="shrink-0" />
                          <span className="font-cairo truncate">{link.label}</span>
                        </a>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setInvoicesSubmenuOpen((v) => !v);
                          }}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          aria-label={invoicesSubmenuOpen ? 'طي التبعيات' : 'عرض التبعيات'}
                        >
                          <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${invoicesSubmenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {invoicesSubmenuOpen && (
                        <div className="border-s-2 border-gray-200 mr-3 pr-2 mt-0.5 space-y-0.5">
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
                                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md transition-colors ${subActive ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                                  }`}
                              >
                                <SubIcon size={14} className="shrink-0" />
                                <span className="font-cairo truncate">{sub.label}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // الزبائن: قائمة منبثقة مع سهم وتبعيات مضمنة
                if (isCustomersWithSubmenu) {
                  const hasPerm = (p: string) => admin.is_super_admin || (admin.permissions as Record<string, boolean>)?.[p] === true;
                  const filteredCustomersSubmenu = customersSubmenu.filter((s) => {
                    return !('permission' in s && s.permission) || hasPerm(s.permission);
                  });
                  const customersSubmenuActive = pathname?.startsWith('/admin/tasks') || pathname?.startsWith('/admin/checks') || pathname?.startsWith('/admin/promissory-notes');
                  return (
                    <div key={link.href} className="space-y-0.5">
                      {sectionHeader}
                      <div className="flex items-center gap-0">
                        <a
                          href={link.href}
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey) return;
                            e.preventDefault();
                            router.push(link.href);
                            setSidebarOpen(false);
                          }}
                          className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border-s-2 text-sm min-w-0 ${(isActive || customersSubmenuActive) ? styles.border : styles.borderMuted} ${isActive || customersSubmenuActive
                            ? `${styles.activeBg} ${styles.activeText || 'text-gray-900 dark:text-gray-100'} font-medium`
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                            }`}
                        >
                          <Icon size={18} className="shrink-0" />
                          <span className="font-cairo truncate">{link.label}</span>
                        </a>
                        {filteredCustomersSubmenu.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCustomersSubmenuOpen((v) => !v);
                            }}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            aria-label={customersSubmenuOpen ? 'طي التبعيات' : 'عرض التبعيات'}
                          >
                            <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${customersSubmenuOpen ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>
                      {customersSubmenuOpen && filteredCustomersSubmenu.length > 0 && (
                        <div className="border-s-2 border-gray-200 mr-3 pr-2 mt-0.5 space-y-0.5">
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
                                className={`flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md transition-colors ${subActive ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                                  }`}
                              >
                                <SubIcon size={14} className="shrink-0" />
                                <span className="font-cairo truncate">{sub.label}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={link.href} className="space-y-0.5">
                    {sectionHeader}
                    <a
                      href={link.href}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) return;
                        e.preventDefault();
                        router.push(link.href);
                        setSidebarOpen(false);
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border-s-2 text-sm ${isActive ? styles.border : styles.borderMuted} ${isActive
                        ? `${styles.activeBg} ${styles.activeText || 'text-gray-900 dark:text-white'} font-medium`
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                        }`}
                    >
                      <Icon size={18} className="shrink-0" />
                      <span className="font-cairo truncate">{link.label}</span>
                    </a>
                  </div>
                );
              })}
              {admin.is_super_admin && (() => {
                const styles = ACCENT_STYLES.amber;
                const isActive = pathname === '/admin/admin-users';
                const borderClass = isActive ? styles.border : styles.borderMuted;
                return (
                  <div className="space-y-0.5">
                    <div className="pt-2 pb-1">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">النظام</span>
                    </div>
                    <a
                      href="/admin/admin-users"
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) return;
                        e.preventDefault();
                        router.push('/admin/admin-users');
                        setSidebarOpen(false);
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border-s-2 text-sm ${borderClass} ${isActive ? `${styles.activeBg} ${styles.activeText || 'text-gray-900 dark:text-white'} font-medium` : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                        }`}
                    >
                      <Shield size={18} className="shrink-0" />
                      <span className="font-cairo truncate">Admin Users</span>
                    </a>
                  </div>
                );
              })()}
            </div>

            {/* Footer: الذهاب الى المتجر + Logout — مفصولان عن القائمة */}
            <div className="mt-auto pt-3 border-t border-gray-100 dark:border-slate-800 space-y-0.5">
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
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border-s-2 text-sm ${styles.borderMuted} text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 text-right`}
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
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors border-s-2 text-sm ${styles.borderMuted} text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 text-right`}
                  >
                    <LogOut size={18} className="shrink-0" />
                    <span className="font-cairo truncate">تسجيل الخروج</span>
                  </button>
                );
              })()}
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={pathname === '/admin/pos' ? '' : 'md:mr-[280px]'}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Top Bar */}
        <header className={`sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 shadow-sm ${pathname === '/admin/pos' ? '' : ''}`} dir="rtl">
          <div className="px-4 py-3 flex items-center justify-between">
            {/* Right side (visually left in RTL): Notifications, Theme Toggle, and Menu button */}
            <div className="flex items-center gap-3">
              {/* Mobile: Actions and Menu */}
              <div className="flex items-center gap-2 md:hidden">
                <ThemeToggle />
                <NotificationCenter />
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Menu size={24} className="text-gray-700 dark:text-gray-300" />
                </button>
              </div>

              {/* Desktop: Actions (for POS page) */}
              {pathname === '/admin/pos' ? (
                <div className="hidden lg:flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-cairo">نظام نقطة البيع POS</span>
                  <ThemeToggle />
                  <NotificationCenter />
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Menu size={24} className="text-gray-700 dark:text-gray-300" />
                  </button>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <ThemeToggle />
                  <NotificationCenter />
                </div>
              )}
            </div>

            {/* Desktop: Admin name in center */}
            <div className="hidden md:flex items-center gap-3 flex-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {admin.username}
              </span>
              <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-full border border-gray-200 dark:border-slate-700">
                {admin.is_super_admin ? 'Super Admin' : 'Admin'}
              </span>
            </div>

            <div className="flex-1 md:hidden" />

            {/* Left side (visually right in RTL): Admin Name on Mobile */}
            <div className="flex items-center gap-3 md:hidden">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {admin.username}
              </span>
              <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-full border border-gray-200 dark:border-slate-700">
                {admin.is_super_admin ? 'Super Admin' : 'Admin'}
              </span>
            </div>

            {/* Injected Header Action from Parent (e.g. POS Pay Button) */}
            {headerAction && (
              <div className="flex items-center gap-2">
                {headerAction}
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className={pathname === '/admin/pos' ? 'p-0' : 'p-4 md:p-6'} dir="rtl">{children}</main>
      </div>
    </div>
  );
}

